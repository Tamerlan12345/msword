import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // НОВЫЕ ДАННЫЕ ПО ТЗ
  const email = 'veronik7@admin.com'; // Используем email для уникальности
  const name = 'Veronik7';
  const passwordRaw = 'Veronika77777';

  // Хешируем новый пароль
  const hashedPassword = await bcrypt.hash(passwordRaw, 10);

  const admin = await prisma.user.upsert({
    where: { email: email },
    update: {
      // Если пользователь уже есть, обновим пароль и имя на новые
      password: hashedPassword,
      name: name,
      role: Role.ADMIN,
    },
    create: {
      email: email,
      name: name,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Пользователь создан/обновлен: ${admin.name} (${admin.email})`);
  console.log(`Пароль: ${passwordRaw}`);
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
