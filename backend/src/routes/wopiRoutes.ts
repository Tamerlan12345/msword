import express from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const BACKEND_URL = process.env.BACKEND_URL || 'https://dmbp.up.railway.app';

// Helper to extract user
const getUserFromRequest = (req: any) => {
  const token = req.query.access_token || req.headers['authorization']?.split(' ')[1];
  if (!token) return { id: 'anonymous' };
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (e) {
    return { id: 'anonymous' };
  }
};

// Helper to get file path
const getFilePath = async (id: string) => {
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 }, author: true }
  });

  if (!doc || !doc.versions[0]) return null;
  return { doc, filePath: path.resolve(doc.versions[0].filePath) };
};

// CheckFileInfo
router.get('/files/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user = getUserFromRequest(req);

    const result = await getFilePath(id);
    if (!result) return res.status(404).json({ error: 'File not found' });
    const { doc, filePath } = result;

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (e) {
      return res.status(404).json({ error: 'File on disk not found' });
    }

    const fileInfo = {
      BaseFileName: path.basename(filePath),
      OwnerId: "admin",
      UserId: user.id,
      Size: stats.size,
      UserCanWrite: true,
      PostMessageOrigin: BACKEND_URL,
      LastModifiedTime: doc.updatedAt.toISOString(),
    };

    res.json(fileInfo);
  } catch (error) {
    console.error('CheckFileInfo Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GetFile
router.get('/files/:id/contents', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    // Validate token if needed, but usually WOPI handles it via signature or token in URL

    const result = await getFilePath(id);
    if (!result) return res.status(404).json({ error: 'File not found' });
    const { filePath } = result;

    res.download(filePath);
  } catch (error) {
    console.error('GetFile Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// PutFile
// Note: Middleware for raw body
router.post('/files/:id/contents', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req: any, res: any) => {
   try {
    const { id } = req.params;
    const result = await getFilePath(id);
    if (!result) return res.status(404).json({ error: 'File not found' });
    const { filePath } = result;

    // Write body to file
    // express.raw puts body in req.body as Buffer
    if (!req.body || !Buffer.isBuffer(req.body)) {
        // Fallback checks if body is empty or not parsed correctly
        if (req.body && Object.keys(req.body).length === 0) {
             // might be empty file?
        } else {
             return res.status(400).json({ error: 'Invalid body or not binary' });
        }
    }

    fs.writeFileSync(filePath, req.body);

    await prisma.document.update({
        where: { id },
        data: { updatedAt: new Date() }
    });

    res.status(200).json({ ItemVersion: new Date().toISOString() });
   } catch (error) {
    console.error('PutFile Error:', error);
    res.status(500).json({ error: 'Save failed' });
   }
});

export default router;
