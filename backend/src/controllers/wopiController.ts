import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || 'https://dmbp1.up.railway.app';
const INTERNAL_WOPI_URL = process.env.INTERNAL_WOPI_URL || 'http://backend:3000';
const COLLABORA_PUBLIC_URL = process.env.COLLABORA_PUBLIC_URL || 'http://localhost:9980';

// Helper: Generate WOPI Token
export const generateWopiToken = async (userId: string, documentId: string) => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 4); // Short-lived (4 hours)

  const tokenEntry = await prisma.wopiToken.create({
    data: {
      userId,
      documentId,
      expiresAt,
    },
  });

  return tokenEntry.token;
};

// Helper: Validate WOPI Token
export const validateWopiToken = async (req: Request) => {
  let token = req.query.access_token;
  if (Array.isArray(token)) token = token[0];
  token = token as string;

  if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
      }
  }

  // Get document ID from params if available
  const documentId = req.params.id;

  if (!token) return null;

  const wopiToken = await prisma.wopiToken.findUnique({
    where: { token },
    include: { user: true, document: true },
  });

  if (!wopiToken) return null;

  if (wopiToken.expiresAt < new Date()) {
    // Token expired
    await prisma.wopiToken.delete({ where: { token } });
    return null;
  }

  // Security Check: Ensure token belongs to the requested document
  if (documentId && wopiToken.documentId !== documentId) {
      console.warn(`WOPI Token mismatch: Token doc ${wopiToken.documentId} vs Req doc ${documentId}`);
      return null;
  }

  return wopiToken;
};

// Helper: Cleanup Expired Tokens
export const cleanupTokens = async () => {
    try {
        const deleted = await prisma.wopiToken.deleteMany({
            where: {
                expiresAt: { lt: new Date() }
            }
        });
        if (deleted.count > 0) {
            console.log(`Cleaned up ${deleted.count} expired WOPI tokens.`);
        }
    } catch (e) {
        console.error("Cleanup tokens error:", e);
    }
};

// Endpoint: Get Iframe URL
export const getIframeUrl = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // This route is called by frontend with user's JWT in Authorization header
    const authHeader = req.headers['authorization'];
    const jwtToken = authHeader && authHeader.split(' ')[1];

    if (!jwtToken) return res.status(401).json({ error: 'Unauthorized' });

    let user: any;
    try {
        user = jwt.verify(jwtToken, JWT_SECRET);
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify document exists
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'File not found' });

    // Generate WOPI token
    const wopiToken = await generateWopiToken(user.id, id);

    // WOPISrc - MUST use BACKEND_PUBLIC_URL so Collabora can reach us from outside
    const wopiSrc = `${BACKEND_PUBLIC_URL}/api/wopi/files/${id}`;

    // Construct full iframe URL
    // WOPISrc must be encoded
    // The iframe src uses the PUBLIC Collabora URL so the user's browser can load it.
    const url = `${COLLABORA_PUBLIC_URL}/browser/dist/cool.html?WOPISrc=${encodeURIComponent(wopiSrc)}&access_token=${wopiToken}&lang=ru`;

    res.json({ url });
  } catch (error) {
    console.error('Iframe URL Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Helper: Get File Path and Doc Info
const getDocInfo = async (id: string) => {
    const doc = await prisma.document.findUnique({
        where: { id },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 }, author: true, approvers: true }
    });

    if (!doc || !doc.versions[0]) return null;
    return { doc, version: doc.versions[0], filePath: path.resolve(doc.versions[0].filePath) };
};

// Endpoint: CheckFileInfo
export const checkFileInfo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const wopiToken = await validateWopiToken(req);
        if (!wopiToken) return res.status(401).json({ error: 'Unauthorized WOPI host' });

        const user = wopiToken.user;
        const result = await getDocInfo(id);

        if (!result) return res.status(404).json({ error: 'File not found' });
        const { doc, filePath } = result;

        // Ensure file exists (create stub if missing)
        if (!fs.existsSync(filePath)) {
            try {
                fs.writeFileSync(filePath, Buffer.from(''));
            } catch (e) {
                console.error("Failed to create stub file:", e);
            }
        }

        let stats;
        try {
            stats = fs.statSync(filePath);
        } catch (e) {
            return res.status(404).json({ error: 'File on disk not found' });
        }

        const isAuthor = doc.authorId === user.id;
        // Check if user is approver
        const approver = doc.approvers.find((a: any) => a.userId === user.id);
        const isApprover = !!approver;
        const isAdmin = user.role === 'ADMIN';

        let userCanWrite = false;
        let userCanReview = false;
        let readOnly = false;

        // Permissions Matrix Logic
        // Status: APPROVED, REJECTED -> Archive (Read Only)
        if (doc.status === 'APPROVED' || doc.status === 'REJECTED') {
            // Final status: Read Only for everyone
            userCanWrite = false;
            userCanReview = false;
            readOnly = true;
        } else if (isAdmin) {
            // Admin: Full access in active statuses
            userCanWrite = true;
            userCanReview = true;
        } else if (doc.status === 'DRAFT') {
            // Draft: Author can edit
            if (isAuthor) {
                userCanWrite = true;
                userCanReview = false;
            } else {
                readOnly = true;
            }
        } else if (doc.status === 'ON_APPROVAL') {
            // On Approval: Approver can review
            if (isApprover) {
                userCanWrite = true;
                userCanReview = true;
            } else {
                // Author and others: Read Only
                userCanWrite = false;
                userCanReview = false;
                readOnly = true;
            }
        } else {
             // Fallback
             readOnly = true;
        }

        let userFriendlyName = user.name || user.email;

        if (user.surname && user.firstname) {
            const f = user.firstname[0].toUpperCase() + '.';
            const p = user.patronymic ? user.patronymic[0].toUpperCase() + '.' : '';
            const dept = user.department ? ` (${user.department})` : '';
            userFriendlyName = `${user.surname} ${f}${p}${dept}`;
        } else if (user.name) {
             const dept = user.department ? ` (${user.department})` : '';
             userFriendlyName = `${user.name}${dept}`;
        }

        const fileInfo = {
            BaseFileName: path.basename(filePath),
            OwnerId: doc.authorId,
            UserId: user.id,
            UserFriendlyName: userFriendlyName,
            Size: stats.size,
            UserCanWrite: userCanWrite,
            UserCanReview: userCanReview,
            ReadOnly: readOnly,
            UserCanNotWriteRelative: true,
            SupportsUpdate: true,
            SupportsLocks: true,
            SupportsReviewing: true,
            DisableChangeTrackingRecord: false,
            PostMessageOrigin: BACKEND_PUBLIC_URL,
            LastModifiedTime: doc.updatedAt.toISOString(),
        };

        res.json(fileInfo);
    } catch (error) {
        console.error('CheckFileInfo Error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Endpoint: GetFile
export const getFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const wopiToken = await validateWopiToken(req);
        if (!wopiToken) return res.status(401).json({ error: 'Unauthorized WOPI host' });

        const result = await getDocInfo(id);
        if (!result) return res.status(404).json({ error: 'File not found' });
        const { filePath } = result;

        res.download(filePath);
    } catch (error) {
        console.error('GetFile Error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Endpoint: PutFile
export const putFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const wopiToken = await validateWopiToken(req);
        if (!wopiToken) return res.status(401).json({ error: 'Unauthorized WOPI host' });

        // Strict Check: Body must be Buffer
        if (!req.body || !Buffer.isBuffer(req.body)) {
             return res.status(400).json({ error: 'Invalid body or not binary' });
        }

        const result = await getDocInfo(id);
        if (!result) return res.status(404).json({ error: 'File not found' });
        const { doc, version } = result;

        // Versioning Logic
        const ext = path.extname(version.filePath);
        let baseName = path.basename(version.filePath, ext);
        if (baseName.includes('_v')) {
            baseName = baseName.split('_v')[0];
        }

        const nextVersionNum = version.version + 1;
        const newFileName = `${baseName}_v${nextVersionNum}${ext}`;
        const dir = path.dirname(version.filePath);
        const newFilePath = path.join(dir, newFileName);

        // Write file
        fs.writeFileSync(newFilePath, req.body);

        // Create DB entry
        await prisma.documentVersion.create({
            data: {
                documentId: id,
                version: nextVersionNum,
                filePath: newFilePath
            }
        });

        // Update Document
        await prisma.document.update({
            where: { id },
            data: {
                updatedAt: new Date(),
                lastEditorId: wopiToken.userId
            }
        });

        res.status(200).json({ ItemVersion: `v${nextVersionNum}` });

    } catch (error) {
        console.error('PutFile Error:', error);
        res.status(500).json({ error: 'Save failed' });
    }
};

// Endpoint: Handle Lock
export const handleLock = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const wopiToken = await validateWopiToken(req);
        if (!wopiToken) return res.status(401).json({ error: 'Unauthorized WOPI host' });

        const override = req.header('X-WOPI-Override');
        const lockId = req.header('X-WOPI-Lock');

        if (!override) {
             return res.status(400).json({ error: 'Missing X-WOPI-Override' });
        }

        const currentLock = await prisma.wopiLock.findUnique({
            where: { documentId: id }
        });

        if (override === 'GET_LOCK') {
             if (currentLock && currentLock.expiresAt > new Date()) {
                 res.setHeader('X-WOPI-Lock', currentLock.lockId);
                 return res.sendStatus(200);
             } else {
                 res.setHeader('X-WOPI-Lock', '');
                 return res.sendStatus(200);
             }
        }

        if (override === 'LOCK' || override === 'REFRESH_LOCK') {
             if (!lockId) return res.status(400).json({ error: 'Missing Lock ID' });

             if (currentLock && currentLock.expiresAt > new Date()) {
                 if (currentLock.lockId === lockId) {
                     // Refresh
                     await prisma.wopiLock.update({
                         where: { documentId: id },
                         data: { expiresAt: new Date(Date.now() + 30 * 60 * 1000) } // 30 mins
                     });
                     return res.sendStatus(200);
                 } else {
                     // Conflict
                     res.setHeader('X-WOPI-Lock', currentLock.lockId);
                     return res.sendStatus(409);
                 }
             } else {
                 // Create new lock (or overwrite expired)
                 if (override === 'REFRESH_LOCK') {
                     res.setHeader('X-WOPI-Lock', '');
                     return res.sendStatus(409);
                 }

                 // LOCK
                 if (currentLock) {
                     await prisma.wopiLock.update({
                         where: { documentId: id },
                         data: { lockId, expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
                     });
                 } else {
                     await prisma.wopiLock.create({
                         data: { documentId: id, lockId, expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
                     });
                 }
                 return res.sendStatus(200);
             }
        }

        if (override === 'UNLOCK') {
             if (!lockId) return res.status(400).json({ error: 'Missing Lock ID' });

             if (currentLock && currentLock.expiresAt > new Date()) {
                 if (currentLock.lockId === lockId) {
                     await prisma.wopiLock.delete({ where: { documentId: id } });
                     return res.sendStatus(200);
                 } else {
                     res.setHeader('X-WOPI-Lock', currentLock.lockId);
                     return res.sendStatus(409);
                 }
             } else {
                 res.setHeader('X-WOPI-Lock', '');
                 return res.sendStatus(409);
             }
        }

        return res.status(501).json({ error: 'Not Implemented' });

    } catch (error) {
        console.error('Lock Error:', error);
        res.status(500).json({ error: 'Lock failed' });
    }
};
