import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ИСПРАВЛЕНИЕ:
// 1. Выходим из 'dist' (..) и из 'backend' (..), чтобы попасть в корень
// 2. Заходим во 'frontend/dist' (стандартная папка сборки Vite)
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');

app.use(express.static(frontendBuildPath));

// Upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create Document (Upload)
app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    const { title, authorId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Ensure author exists (for demo purposes create if not exists or use existing)
    // In real app, we get authorId from JWT
    let user = await prisma.user.findFirst();
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: 'admin@example.com',
                name: 'Admin',
                password: 'hashed_password', // TODO: hash
                role: 'ADMIN'
            }
        });
    }

    const doc = await prisma.document.create({
      data: {
        title: title || file.originalname,
        authorId: user.id,
        status: 'DRAFT',
        versions: {
          create: {
            version: 1,
            filePath: file.path,
            uploadedBy: user.id,
          },
        },
      },
      include: {
        versions: true,
      },
    });

    res.json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// List Documents
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await prisma.document.findMany({
      include: {
        author: true,
        versions: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ИСПРАВЛЕНИЕ: Используем переменную пути, определенную выше
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
