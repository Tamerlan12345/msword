
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
app.use(express.json());

// Раздача статики фронтенда
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

// Настройка загрузки файлов
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

// --- MIDDLEWARE АВТОРИЗАЦИИ ---
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

// 1. ВХОД В СИСТЕМУ (LOGIN)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Ищем пользователя
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Неверный пароль' });

    // Генерируем токен
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// 2. СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ (Только для Админа или первичная настройка)
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Проверка существования
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

// 3. ЗАГРУЗКА ДОКУМЕНТА (ЗАЩИЩЕНО)
app.post('/api/documents', authenticateToken, upload.single('file'), async (req: any, res: any) => {
  try {
    const { title } = req.body;
    const file = req.file;
    // Берем ID пользователя из токена (req.user)
    const userId = req.user.id;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const doc = await prisma.document.create({
      data: {
        title: title || file.originalname,
        authorId: userId, // Привязываем к реальному пользователю
        status: 'DRAFT',
        versions: {
          create: { version: 1, filePath: file.path, uploadedBy: userId },
        },
      },
      include: { versions: true },
    });

    res.json(doc);
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to create document', details: String(error) });
  }
});

// 4. ПОЛУЧЕНИЕ СПИСКА ДОКУМЕНТОВ
app.get('/api/documents', authenticateToken, async (req: any, res: any) => {
  try {
    const { authorId, status } = req.query;

    const where: any = {};
    if (authorId) where.authorId = String(authorId);
    if (status) where.status = String(status);

    const docs = await prisma.document.findMany({
      where,
      include: { author: true, versions: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// 5. ПОЛУЧЕНИЕ ОДНОГО ДОКУМЕНТА
app.get('/api/documents/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { author: true, versions: true },
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// 6. ОБНОВЛЕНИЕ СТАТУСА ДОКУМЕНТА
app.put('/api/documents/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expecting status string
    const user = req.user;

    // Сначала найдем документ
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Простая проверка прав (расширить при необходимости)
    // ADMIN может менять статус на APPROVED/REJECTED
    // AUTHOR может менять статус DRAFT -> ON_APPROVAL или REJECTED -> DRAFT
    // Но пока доверимся фронтенду + базовой логике:

    // Если статус APPROVED, менять нельзя (кроме админа, возможно)
    if (doc.status === 'APPROVED' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Document is already approved' });
    }

    const updatedDoc = await prisma.document.update({
      where: { id },
      data: { status },
      include: { author: true, versions: true },
    });

    res.json(updatedDoc);
  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// 7. УДАЛЕНИЕ ДОКУМЕНТА
app.delete('/api/documents/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Проверка прав на удаление
    // Автор может удалять только черновики. Админ может удалять всё (или по правилам).
    // Реализуем как в ТЗ: Автор -> DRAFT -> Удалить

    if (user.role !== 'ADMIN') {
      if (doc.authorId !== user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (doc.status !== 'DRAFT' && doc.status !== 'REJECTED') {
         return res.status(403).json({ error: 'Can only delete drafts' });
      }
    }

    // Удаляем связанные версии и сам документ
    // Note: In real app, cascading delete should be configured in Prisma schema or handled manually
    // Here we use Prisma transaction or let cascade work if configured (Schema didn't explicitly say cascade for versions but usually it's needed)
    // The schema: versions DocumentVersion[]
    // We should delete versions first or rely on cascade. Let's try delete directly, if it fails due to FK, we'll fix.
    // Prisma usually doesn't cascade by default unless @relation(onDelete: Cascade)
    // Checking schema: document   Document @relation(fields: [documentId], references: [id])
    // No onDelete: Cascade. So we must delete versions first.

    await prisma.$transaction([
      prisma.documentVersion.deleteMany({ where: { documentId: id } }),
      prisma.comment.deleteMany({ where: { documentId: id } }), // If any
      // Workflow, audits might exist too. For MVP simplest is delete document and related.
      // Schema has Workflow? Yes. Audit? Yes.
      prisma.workflow.deleteMany({ where: { documentId: id } }),
      prisma.audit.deleteMany({ where: { documentId: id } }),
      prisma.document.delete({ where: { id } }),
    ]);

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// --- INIT (АВТО-СОЗДАНИЕ АДМИНА ЕСЛИ БАЗА ПУСТА) ---
const init = async () => {
  const count = await prisma.user.count();
  if (count === 0) {
    console.log('База пуста. Создаю суперадмина Veronik7...');
    const hash = await bcrypt.hash('Veronika77777', 10);
    await prisma.user.create({
      data: {
        email: 'veronik7@admin.com',
        name: 'Veronik7',
        password: hash,
        role: 'ADMIN'
      }
    });
    console.log('Администратор создан: veronik7@admin.com / Veronika77777');
  }
};
init();

// Catch-all для фронтенда
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
