import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-it';

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

// ONLYOFFICE CONFIG
app.get('/api/documents/:id/onlyoffice-config', authenticateToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { review } = req.query;
        const user = req.user;

        const doc = await prisma.document.findUnique({
            where: { id },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
        });

        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Use the latest version or empty. If no version exists (created without file), we might need to handle it.
        // Assuming we only use ONLYOFFICE for documents with files.
        const latestVersion = doc.versions[0];
        if (!latestVersion) {
            return res.status(400).json({ error: 'No file associated with this document' });
        }

        const fileName = path.basename(latestVersion.filePath);
        // Ensure this URL is accessible by the ONLYOFFICE container
        // In dev (docker-compose), use host.docker.internal or configured IP.
        const backendUrl = process.env.BACKEND_URL || 'http://host.docker.internal:3000';
        const fileUrl = `${backendUrl}/uploads/${fileName}`;
        const callbackUrl = `${backendUrl}/api/documents/track?docId=${id}&userId=${user.id}`; // Passing query params for tracking context if needed

        const isReviewMode = review === 'true';

        const config = {
            document: {
                fileType: "docx",
                key: `${id}-${latestVersion.version}-${new Date(latestVersion.createdAt).getTime()}`, // Unique key for caching
                title: doc.title,
                url: fileUrl,
                permissions: {
                    edit: doc.status === 'DRAFT' || doc.status === 'ON_APPROVAL', // Allow edit in draft or approval? Usually only draft.
                    // User requirements say: "Режим правки... Включение режима 'Track Changes' ... Идентификация"
                    // If ON_APPROVAL, maybe only review?
                    // For simplicity, let's allow edit based on status or user role logic later.
                    // Assuming Draft = Edit.
                    comment: true,
                    download: true,
                    print: true,
                    review: true // Enable review mode
                },
            },
            editorConfig: {
                callbackUrl: callbackUrl,
                user: {
                    id: user.id,
                    name: user.name
                },
                customization: {
                    forcesave: true, // Force save to hit callback more often
                    review: isReviewMode, // Enable review mode based on request
                },
                mode: doc.status === 'DRAFT' ? 'edit' : 'view', // Or 'edit' with review mode forced
            },
            token: ''
        };

        // Sign config
        config.token = jwt.sign(config, 'secret123'); // MUST match ONLYOFFICE JWT_SECRET

        res.json(config);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Config generation failed' });
    }
});

// ONLYOFFICE TRACKING CALLBACK
app.post('/api/documents/track', async (req: any, res: any) => {
    // This endpoint is called by ONLYOFFICE.
    // We MUST verify the token for security.

    try {
        const { status, url, token } = req.body;
        // Also check authorization header if provided
        const authHeader = req.headers['authorization'];
        const jwtToken = token || (authHeader && authHeader.split(' ')[1]);

        if (!jwtToken) {
            return res.status(403).json({ error: 1, message: "No token provided" });
        }

        try {
             jwt.verify(jwtToken, 'secret123'); // MUST match ONLYOFFICE JWT_SECRET
        } catch (err) {
             console.error("JWT verification failed:", err);
             return res.status(403).json({ error: 1, message: "Invalid token" });
        }

        const { docId, userId } = req.query; // We passed this in callbackUrl

        // 2 = Ready for saving, 6 = Force save
        if (status === 2 || status === 6) {
             if (!url) return res.json({ error: 0 });

             // Download the new file
             const response = await fetch(url);
             if (!response.ok) throw new Error('Failed to download from ONLYOFFICE');

             const arrayBuffer = await response.arrayBuffer();
             const buffer = Buffer.from(arrayBuffer);

             // Create a new version or overwrite?
             // Usually better to create a new version or overwrite current.
             // Let's overwrite existing file for simplicity or update the DocumentVersion logic.
             // Finding the document to get the path.
             const doc = await prisma.document.findUnique({
                 where: { id: docId as string },
                 include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
             });

             if (doc && doc.versions[0]) {
                 const oldPath = doc.versions[0].filePath;
                 // We can overwrite the file
                 fs.writeFileSync(oldPath, buffer);

                 // Update updatedAt
                 await prisma.document.update({
                     where: { id: docId as string },
                     data: { updatedAt: new Date() }
                 });
             }
        }

        res.json({ error: 0 });
    } catch (e) {
        console.error("Track error:", e);
        res.json({ error: 1 });
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
