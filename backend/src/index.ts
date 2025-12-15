import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Важно: импортируем bcrypt для создания пароля на лету
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

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

    // --- ЛОГИКА АВТОМАТИЧЕСКОГО СОЗДАНИЯ ПОЛЬЗОВАТЕЛЯ (ТЗ) ---
    const TARGET_EMAIL = 'veronik7@admin.com';

    // 1. Ищем конкретного пользователя Veronik7
    let user = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL }
    });

    // 2. Если его нет — пробуем найти любого другого (чтобы не дублировать, если seed был другим)
    if (!user) {
      user = await prisma.user.findFirst();
    }

    // 3. Если база совсем пустая или нужного юзера нет — СОЗДАЕМ АВТОМАТИЧЕСКИ
    if (!user) {
      console.log('База пуста. Автоматическое создание пользователя Veronik7...');
      const hashedPassword = await bcrypt.hash('Veronika77777', 10);

      user = await prisma.user.create({
        data: {
          email: TARGET_EMAIL,
          name: 'Veronik7',
          password: hashedPassword,
          role: 'ADMIN' // Используем строковое значение или enum, если импортирован
        }
      });
      console.log('Пользователь Veronik7 успешно создан.');
    }
    // ---------------------------------------------------------

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
    console.error('Upload error details:', error);
    res.status(500).json({ error: 'Failed to create document', details: String(error) });
  }
});

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
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
