import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { GoogleDriveService } from './services/googleDriveService';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-it';
const ONLYOFFICE_API_URL = process.env.ONLYOFFICE_API_URL || 'http://localhost:8081';
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'secret123';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://host.docker.internal:3000/api/onlyoffice/callback';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// --- MIDDLEWARE ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// 1. LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Неверный пароль' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// 2. CREATE USER (Admin only or setup)
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Basic protection could be added here

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email уже занят' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || 'APPROVER' }
    });

    res.json({ id: user.id, email: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
});

// GET USERS (For approver selection)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 3. UPLOAD DOCUMENT
app.post('/api/documents', authenticateToken, upload.single('file'), async (req: any, res: any) => {
  try {
    const { title } = req.body;
    const userId = req.user.id;

    // Allow creating document without file (just editor)
    // If file is present, create version. If not, just create doc.
    const file = req.file;

    const data: any = {
        title: title || (file ? file.originalname : 'Новый документ'),
        authorId: userId,
        status: 'DRAFT',
        content: '', // Start empty or default
    };

    if (file) {
        data.versions = {
          create: { version: 1, filePath: file.path },
        };
    }

    const doc = await prisma.document.create({
      data,
      include: { versions: true },
    });

    res.json(doc);
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to create document', details: String(error) });
  }
});

// 4. GET DOCUMENTS
app.get('/api/documents', authenticateToken, async (req: any, res: any) => {
  try {
    const { authorId, status } = req.query;

    const where: any = {};
    if (authorId) where.authorId = String(authorId);
    if (status) where.status = String(status);

    const docs = await prisma.document.findMany({
      where,
      include: { author: true, versions: true, approvers: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// 5. GET DOCUMENT DETAIL
app.get('/api/documents/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
          author: true,
          versions: true,
          approvers: { include: { user: true } }, // Include approver details
          comments: { include: { author: true } }
      },
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// GOOGLE DOCS INTEGRATION

// 1. INIT GOOGLE SESSION (Upload & Permissions)
app.post('/api/documents/:id/google/init', authenticateToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({
            where: { id },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });

        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // If already has googleFileId, return it (check if it exists on Drive?)
        // Ideally we check if it is still valid, but for now just return it.
        if (doc.googleFileId) {
             return res.json({ googleFileId: doc.googleFileId });
        }

        const latestVersion = doc.versions[0];
        if (!latestVersion) return res.status(400).json({ error: 'No file to edit' });

        const filePath = latestVersion.filePath; // Absolute or relative? "uploads/..."
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
             // Try to resolve relative to root or current dir
             // The upload middleware saves to 'uploads' relative to CWD.
             // Current CWD in backend is usually root of backend app.
        }

        console.log(`Uploading to Google Drive: ${doc.title}`);
        const result = await GoogleDriveService.uploadFile(absolutePath, doc.title);

        if (!result.id) throw new Error("Failed to get file ID from Google");

        // Grant access
        await GoogleDriveService.grantAccess(result.id);

        // Save ID to DB
        await prisma.document.update({
            where: { id },
            data: { googleFileId: result.id }
        });

        res.json({ googleFileId: result.id });
    } catch (e) {
        console.error("Google Init Error:", e);
        res.status(500).json({ error: 'Failed to init Google Docs session' });
    }
});

// 2. SYNC GOOGLE DOC (Download & Update Local)
app.post('/api/documents/:id/google/sync', authenticateToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({
            where: { id },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });

        if (!doc || !doc.googleFileId) return res.status(404).json({ error: 'Document or Google Session not found' });

        console.log(`Syncing from Google Drive: ${doc.googleFileId}`);
        const buffer = await GoogleDriveService.exportFile(doc.googleFileId);

        // Update local file
        const latestVersion = doc.versions[0];
        if (latestVersion) {
            fs.writeFileSync(latestVersion.filePath, buffer);
        } else {
             // Should not happen if we uploaded it, but handle case?
             // Create new file?
        }

        // Update timestamp
        await prisma.document.update({
            where: { id },
            data: { updatedAt: new Date() }
        });

        res.json({ message: 'Synced successfully' });
    } catch (e) {
        console.error("Google Sync Error:", e);
        res.status(500).json({ error: 'Failed to sync document' });
    }
});

// 3. CLEANUP (Delete from Drive)
app.post('/api/documents/:id/google/cleanup', authenticateToken, async (req: any, res: any) => {
     try {
        const { id } = req.params;
        const doc = await prisma.document.findUnique({ where: { id } });

        if (!doc || !doc.googleFileId) return res.json({ message: 'Nothing to clean' });

        console.log(`Deleting from Google Drive: ${doc.googleFileId}`);
        await GoogleDriveService.deleteFile(doc.googleFileId);

        await prisma.document.update({
            where: { id },
            data: { googleFileId: null }
        });

        res.json({ message: 'Cleanup complete' });
     } catch (e) {
        console.error("Google Cleanup Error:", e);
        // Even if delete fails, maybe we should clear the ID?
        // Or keep it to retry? Let's clear it to avoid stuck state if file is gone.
        // But if file is not gone, we leak it.
        // Let's return error but not clear ID?
        res.status(500).json({ error: 'Cleanup failed' });
     }
});

// ONLYOFFICE INTEGRATION

// 1. GENERATE CONFIG
app.get('/api/documents/:id/onlyoffice/config', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const latestVersion = doc.versions[0];
    if (!latestVersion) return res.status(400).json({ error: 'No file to edit' });

    // File info
    const filePath = latestVersion.filePath;
    const fileName = path.basename(filePath);
    const fileExt = path.extname(fileName).replace('.', '');
    // Deterministic key for collaborative editing: ID + Version + Timestamp
    const key = `${id}-${latestVersion.version}-${new Date(latestVersion.createdAt).getTime()}`;

    // Determine permissions based on logic
    // For now allow edit if not rejected? Or follows app logic.
    // TZ doesn't specify permissions logic, so default to allow edit.
    // Maybe check if user is author or approver?
    const canEdit = true; // Simplified

    // URL to download the file. ONLYOFFICE needs to reach this.
    // We assume backend is reachable via host.docker.internal:3000 based on CALLBACK_URL hint
    // Extract base from CALLBACK_URL
    const baseUrl = CALLBACK_URL.replace('/api/onlyoffice/callback', '');
    const fileUrl = `${baseUrl}/uploads/${fileName}`;

    const config = {
      document: {
        fileType: fileExt,
        key: key,
        title: doc.title,
        url: fileUrl,
        permissions: {
          download: true,
          edit: canEdit,
          print: true,
          review: true, // Enable review mode
        },
      },
      editorConfig: {
        callbackUrl: CALLBACK_URL,
        user: {
          id: user.id,
          name: user.name,
        },
        mode: canEdit ? 'edit' : 'view',
        lang: 'ru', // Default to Russian as per TZ language
      },
      type: 'desktop', // or mobile
      height: '100%',
      width: '100%',
    };

    // Sign token
    const token = jwt.sign(config, ONLYOFFICE_JWT_SECRET);

    res.json({ ...config, token });
  } catch (error) {
    console.error('OnlyOffice Config Error:', error);
    res.status(500).json({ error: 'Failed to generate config' });
  }
});

// 2. CALLBACK HANDLER
app.post('/api/onlyoffice/callback', async (req: any, res: any) => {
  try {
    let payload = req.body;

    // 1. Validate Token (Strict Check)
    const token = payload.token || req.headers['authorization']?.split(' ')[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, ONLYOFFICE_JWT_SECRET);
        payload = decoded.payload || decoded;
      } catch (err) {
         console.error("Callback Token Invalid:", err);
         return res.json({ error: 1, message: "Invalid token" });
      }
    } else {
        // Option: Enforce token presence
        // return res.json({ error: 1, message: "Token missing" });
    }

    const { status, url, key } = payload;

    // Status 2: Ready for saving, 6: Force save
    if (status === 2 || status === 6) {
        if (!url) {
            return res.json({ error: 0 });
        }

        // Parse key: ID-Version-Timestamp
        // Extract ID by removing the last two segments (Version, Timestamp)
        const parts = key.split('-');
        if (parts.length < 3) {
             console.error("Invalid key format:", key);
             return res.json({ error: 0 }); // Don't break OO loop, just log
        }
        const docId = parts.slice(0, parts.length - 2).join('-');

        console.log(`Processing callback for DocID: ${docId}, Status: ${status}`);

        const doc = await prisma.document.findUnique({
            where: { id: docId },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });

        if (doc && doc.versions.length > 0) {
            const latestVersion = doc.versions[0];
            const destPath = path.resolve(latestVersion.filePath);

            console.log(`Downloading update from ${url} to ${destPath}`);

            try {
                const response = await axios({
                    method: 'GET',
                    url: url,
                    responseType: 'stream'
                });

                const writer = fs.createWriteStream(destPath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve(true));
                    writer.on('error', reject);
                });

                // Update timestamp
                await prisma.document.update({
                    where: { id: docId },
                    data: { updatedAt: new Date() }
                });

                console.log(`File saved successfully.`);
            } catch (downloadErr) {
                console.error("Download failed:", downloadErr);
                return res.json({ error: 1 });
            }
        } else {
             console.error("Document not found for callback:", docId);
             // Return error 0 to stop OO from retrying if doc is gone
             return res.json({ error: 0 });
        }
    }

    // Always return error: 0 to satisfy ONLYOFFICE
    res.json({ error: 0 });
  } catch (error) {
    console.error("OnlyOffice Callback Error:", error);
    res.json({ error: 0 }); // Fallback to success to avoid loops
  }
});


// 6. UPDATE DOCUMENT CONTENT (Editor save)
app.put('/api/documents/:id/content', authenticateToken, async (req: any, res: any) => {
  const { id } = req.params;
  const { content } = req.body; // JSON string

  try {
    const doc = await prisma.document.update({
      where: { id },
      data: { content }
    });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// 7. ASSIGN APPROVERS
app.post('/api/documents/:id/approvers', authenticateToken, async (req: any, res: any) => {
  const { id } = req.params;
  const { userIds } = req.body; // ["uuid1", "uuid2"]

  try {
    // Remove old pending approvers
    await prisma.documentApprover.deleteMany({
      where: { documentId: id, status: 'PENDING' }
    });

    // Add new ones
    const promises = userIds.map((userId: string) =>
      prisma.documentApprover.create({
        data: {
          documentId: id,
          userId: userId,
          status: 'PENDING'
        }
      })
    );

    await Promise.all(promises);

    // Update doc status
    await prisma.document.update({
      where: { id },
      data: { status: 'ON_APPROVAL' }
    });

    res.json({ message: 'Согласующие назначены' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка назначения' });
  }
});

// 8. APPROVE/REJECT
app.put('/api/documents/:id/approve', authenticateToken, async (req: any, res: any) => {
  const { id } = req.params;
  const { status, comment } = req.body; // APPROVED or REJECTED
  const userId = req.user.id;

  try {
    // Update approver status
    await prisma.documentApprover.update({
      where: { documentId_userId: { documentId: id, userId } },
      data: { status, comment }
    });

    // Check if all approved
    if (status === 'APPROVED') {
      const allApprovers = await prisma.documentApprover.findMany({
        where: { documentId: id }
      });

      const allApproved = allApprovers.every(a => a.status === 'APPROVED');

      if (allApproved) {
        await prisma.document.update({
          where: { id },
          data: { status: 'APPROVED' }
        });
      }
    } else if (status === 'REJECTED') {
      // If one rejects, document is rejected
      await prisma.document.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
    }

    res.json({ message: 'Голос учтен' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка голосования' });
  }
});

// 9. GENERAL UPDATE (Legacy/Status manual change)
app.put('/api/documents/:id', authenticateToken, async (req: any, res: any) => {
    // Keeps existing logic for manual status updates if needed
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status) {
             const doc = await prisma.document.update({
                where: { id },
                data: { status }
            });
            return res.json(doc);
        }
        res.json({message: "Nothing to update"});
    } catch (e) {
        res.status(500).json({error: "Update failed"});
    }
});


// 10. DELETE DOCUMENT
app.delete('/api/documents/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (user.role !== 'ADMIN') {
      if (doc.authorId !== user.id) return res.status(403).json({ error: 'Not authorized' });
      // Allow author to delete if DRAFT or REJECTED
      if (doc.status !== 'DRAFT' && doc.status !== 'REJECTED') {
         return res.status(403).json({ error: 'Can only delete drafts' });
      }
    }

    // Delete related
    await prisma.$transaction([
      prisma.documentVersion.deleteMany({ where: { documentId: id } }),
      prisma.comment.deleteMany({ where: { documentId: id } }),
      prisma.documentApprover.deleteMany({ where: { documentId: id } }),
      prisma.document.delete({ where: { id } }),
    ]);

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// INIT ADMIN
const init = async () => {
    try {
        const count = await prisma.user.count();
        if (count === 0) {
            console.log('Creating default admin...');
            const hash = await bcrypt.hash('Veronika77777', 10);
            await prisma.user.create({
            data: {
                email: 'veronik7@admin.com',
                name: 'Veronik7',
                password: hash,
                role: 'ADMIN'
            }
            });
            console.log('Admin created.');
        }
    } catch (e) {
        console.log('Init skipped or failed (db might be down)');
    }
};
init();

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
