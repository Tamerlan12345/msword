import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getDocuments = async (req: any, res: Response) => {
  try {
    const user = req.user;
    let where: any = {};

    if (user.role !== 'ADMIN') {
        where = {
            OR: [
                { authorId: user.id },
                {
                    approvers: {
                        some: {
                            userId: user.id
                        }
                    }
                }
            ]
        };
    }

    const docs = await prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        approvers: {
          select: {
            userId: true,
            status: true
          }
        },
        versions: {
          select: {
            id: true,
            version: true,
            createdAt: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};
