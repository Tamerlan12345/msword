import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// GET /api/users/me
export const getProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        firstname: true,
        patronymic: true,
        department: true,
        role: true,
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// PUT /api/users/profile
export const updateProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { surname, firstname, patronymic, department } = req.body;

    // Validate mandatory fields
    if (!firstname) {
      return res.status(400).json({ error: 'Firstname is required' });
    }

    // Update name for backward compatibility
    // Format: "Surname Firstname" or just "Firstname"
    const fullName = `${surname ? surname + ' ' : ''}${firstname}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        surname,
        firstname,
        patronymic,
        department,
        name: fullName
      },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        firstname: true,
        patronymic: true,
        department: true,
        role: true,
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// PUT /api/users/password
export const changePassword = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both old and new passwords are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// GET /api/users (List for approvers)
export const getAllUsers = async (req: any, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        surname: true,
        firstname: true,
        patronymic: true,
        department: true
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
