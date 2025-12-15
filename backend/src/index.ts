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
app.post('/api/documents', upload.single('file'), async (req: any, res: any) => {
  try {
    const { title } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ИСПРАВЛЕНИЕ:
    // 1. Сначала ищем нашего администратора (которого создали через seed)
    let user = await prisma.user.findUnique({
      where: { email: 'veronika@admin.com' }
    });

    // 2. Если конкретного админа нет, берем любого первого пользователя из базы
    if (!user) {
      user = await prisma.user.findFirst();
    }

    // 3. Если в базе вообще нет пользователей — возвращаем понятную ошибку, а не падаем
    if (!user) {
      console.error('Ошибка: В базе данных нет пользователей. Запустите npx prisma db seed');
      return res.status(500).json({ error: 'No users found in database. Please run seed script.' });
    }

    // Теперь мы уверены, что user.id существует
    const doc = await prisma.document.create({
      data: {
        title: title || file.originalname,
        authorId: user.id, // Привязываем к найденному пользователю
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
    console.error('Upload error details:', error); // Логируем полную ошибку в консоль
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
