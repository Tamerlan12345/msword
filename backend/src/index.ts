import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import wopiRoutes from './routes/wopiRoutes';
import userRoutes from './routes/userRoutes';
import metricsRoutes from './routes/metricsRoutes';
import { cleanupTokens, canUserWrite, generateWopiToken } from './controllers/wopiController';
import { getDocuments, updateDocument, rejectDocument, deleteDocument, downloadDocument } from './controllers/documentController';
import { upload as standardUpload } from './middleware/uploadMiddleware';

dotenv.config();

const app = express();
// const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const ONLYOFFICE_API_URL = process.env.ONLYOFFICE_API_URL || 'http://localhost:8081';
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'secret123';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://host.docker.internal:3000/api/onlyoffice/callback';

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow OnlyOffice/Collabora frames
  contentSecurityPolicy: false, // OnlyOffice requires specific CSP or disabled for simplicity in dev
}));

// Rate limiting for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://collabora-production-1557.up.railway.app',
    'https://dmbp1.up.railway.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb to 10mb for better protection

// Serve frontend static files
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));
// Security: Disabled public static serving of uploads
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// WOPI Routes
app.use('/api/wopi', wopiRoutes);

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Используем абсолютный путь, чтобы точно попасть в примонтированный volume
    // Если задана переменная окружения UPLOAD_DIR - используем её
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
    
    // Создаем папку, если её нет (важно при первом запуске)
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 1. Исправляем кодировку (чтобы русские названия не превращались в кракозябры)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // 2. Генерируем уникальный номер
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    
    // 3. Sanitized filename: <Timestamp>-<RandomID>.<Extension>
    const ext = path.extname(originalName);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

// --- MIDDLEWARE ---
app.get('/api/config', (req, res) => {
  // Возвращаем переменную окружения, которую зададим в Railway
  res.json({
    collaboraUrl: process.env.COLLABORA_PUBLIC_URL || ''
  });
});

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
app.post('/api/auth/login', authLimiter, async (req: Request, res: any) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Неверные учетные данные' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Неверные учетные данные' });

    if (!JWT_SECRET || JWT_SECRET === 'secret123') {
        console.warn("WARNING: Using insecure JWT_SECRET");
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// 2. CREATE USER (Admin only)
app.post('/api/users', authenticateToken, async (req: any, res: any) => {
  try {
    // Check for Admin role
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can create users' });
    }

    const { name, email, password, role } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email уже занят' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || 'APPROVER' }
    });

    res.json({ id: user.id, email: user.email });
  } catch (e) {
    console.error('User creation error:', e);
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
});

// GET USERS (For approver selection) & PROFILE
app.use('/api/users', authenticateToken, userRoutes);

// METRICS (Admin only)
app.use('/api/metrics', authenticateToken, metricsRoutes);

// 3. UPLOAD DOCUMENT
app.post('/api/documents', authenticateToken, standardUpload.single('file'), async (req: any, res: any) => {
  try {
    const { title } = req.body;
    const userId = req.user.id;
    const file = req.file;

    const data: any = {
        title: title || (file ? Buffer.from(file.originalname, 'latin1').toString('utf8') : 'Новый документ'),
        authorId: userId,
        status: 'DRAFT',
        content: '',
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
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// 4. GET DOCUMENTS
app.get('/api/documents', authenticateToken, getDocuments);

// 4.5 DOWNLOAD DOCUMENT (Secure)
app.get('/api/documents/:id/download', authenticateToken, downloadDocument);

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

// GOOGLE DOCS INTEGRATION REMOVED (UNIFIED CLEANUP)

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

    // Security: Use WOPI GetFile endpoint instead of public uploads
    const wopiToken = await generateWopiToken(user.id, id);
    // Use configured BACKEND_PUBLIC_URL if available, otherwise infer from callback or localhost
    const publicUrl = process.env.BACKEND_PUBLIC_URL || baseUrl;
    const fileUrl = `${publicUrl}/api/wopi/files/${id}/contents?access_token=${wopiToken}`;

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
    const doc = await prisma.document.findUnique({
        where: { id },
        include: { approvers: true }
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (!canUserWrite(doc, req.user)) {
        return res.status(403).json({ error: 'Read Only: Permission denied' });
    }

    const updatedDoc = await prisma.document.update({
      where: { id },
      data: { content }
    });
    res.json(updatedDoc);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// 7. ASSIGN APPROVERS
app.post('/api/documents/:id/approvers', authenticateToken, async (req: any, res: any) => {
  const { id } = req.params;
  const { userIds } = req.body; // ["uuid1", "uuid2"]
  const user = req.user;

  try {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (user.role !== 'ADMIN' && doc.authorId !== user.id) {
        return res.status(403).json({ error: 'Only Author or Admin can assign approvers' });
    }

    // Clear existing approvers (start fresh)
    await prisma.documentApprover.deleteMany({
      where: { documentId: id }
    });

    // Add new ones with sequence
    for (let i = 0; i < userIds.length; i++) {
        await prisma.documentApprover.create({
            data: {
                documentId: id,
                userId: userIds[i],
                status: 'PENDING',
                serialNumber: i,
                isCurrent: i === 0 // First one is active
            }
        });
    }

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

// 8. FORWARD (Pass the baton)
app.put('/api/documents/:id/forward', authenticateToken, async (req: any, res: any) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = req.user.id;

  try {
    const currentApprover = await prisma.documentApprover.findUnique({
      where: { documentId_userId: { documentId: id, userId } }
    });

    if (!currentApprover || !currentApprover.isCurrent) {
        return res.status(403).json({ error: 'Не ваша очередь' });
    }

    // Mark current as done
    await prisma.documentApprover.update({
      where: { id: currentApprover.id },
      data: {
          isCurrent: false,
          status: 'APPROVED',
          comment: comment || '',
          actionDate: new Date()
      }
    });

    // Find next
    const nextApprover = await prisma.documentApprover.findFirst({
        where: { documentId: id, serialNumber: currentApprover.serialNumber + 1 }
    });

    if (nextApprover) {
        // Activate next
        await prisma.documentApprover.update({
            where: { id: nextApprover.id },
            data: { isCurrent: true }
        });
    } else {
        // End of chain -> REVIEW_REQUIRED
        await prisma.document.update({
            where: { id },
            data: { status: 'REVIEW_REQUIRED' }
        });
    }

    res.json({ message: 'Передано дальше' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// 8.5 REJECT (Stop workflow)
app.put('/api/documents/:id/reject', authenticateToken, rejectDocument);

// 9. GENERAL UPDATE (Legacy/Status manual change)
app.put('/api/documents/:id', authenticateToken, updateDocument);


// 10. DELETE DOCUMENT
app.delete('/api/documents/:id', authenticateToken, deleteDocument);

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Cleanup tokens every hour
    setInterval(cleanupTokens, 60 * 60 * 1000);
  });
}

export default app;
