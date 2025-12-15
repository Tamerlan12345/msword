// Файл: backend/prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Данные администратора
  const email = 'veronika@admin.com'; // Используем email как логин
  const passwordRaw = 'Verkonika7777';
  const name = 'Veronika';

  // Хешируем пароль для безопасности
  const hashedPassword = await bcrypt.hash(passwordRaw, 10);

  // Используем upsert: если пользователь есть - ничего не делаем, если нет - создаем
  const admin = await prisma.user.upsert({
    where: { email: email },
    update: {},
    create: {
      email: email,
      name: name,
      password: hashedPassword,
      role: Role.ADMIN, // Роль из Enum в schema.prisma
    },
  });

  console.log(`Администратор создан или уже существует: ${admin.name} (${admin.email})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
