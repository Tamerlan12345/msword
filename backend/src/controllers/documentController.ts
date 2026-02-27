import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import path from 'path';

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

export const updateDocument = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user = req.user;

        if (status) {
             const doc = await prisma.document.findUnique({ where: { id } });
             if (!doc) return res.status(404).json({ error: 'Document not found' });

             if (user.role !== 'ADMIN' && doc.authorId !== user.id) {
                 return res.status(403).json({ error: 'Not authorized' });
             }

             // Security: Validate status transitions for non-admins
             if (user.role !== 'ADMIN') {
                 // Prevent bypassing approval workflow
                 if (status === 'APPROVED' && doc.status !== 'REVIEW_REQUIRED') {
                     return res.status(403).json({ error: 'Cannot approve document before review completion' });
                 }
                 // Prevent manually setting internal statuses
                 if (status === 'ON_APPROVAL') {
                      return res.status(403).json({ error: 'Use assign approvers endpoint to start approval' });
                 }
                 if (status === 'REVIEW_REQUIRED' || status === 'REJECTED') {
                      return res.status(403).json({ error: 'Cannot manually set this status' });
                 }
             }

             const updatedDoc = await prisma.document.update({
                where: { id },
                data: { status }
            });
            return res.json(updatedDoc);
        }
        res.json({message: "Nothing to update"});
    } catch (e) {
        res.status(500).json({error: "Update failed"});
    }
};

export const rejectDocument = async (req: any, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = req.user.id;

  try {
    const currentApprover = await prisma.documentApprover.findUnique({
      where: { documentId_userId: { documentId: id, userId } }
    });

    if (!currentApprover || !currentApprover.isCurrent) {
        return res.status(403).json({ error: 'Не ваша очередь или вы не являетесь согласующим' });
    }

    // Mark current as REJECTED
    await prisma.documentApprover.update({
      where: { id: currentApprover.id },
      data: {
          isCurrent: false,
          status: 'REJECTED',
          comment: comment || '',
          actionDate: new Date()
      }
    });

    // Mark document as REJECTED
    const updatedDoc = await prisma.document.update({
        where: { id },
        data: { status: 'REJECTED' }
    });

    res.json(updatedDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка отклонения документа' });
  }
};

export const deleteDocument = async (req: any, res: Response) => {
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
      prisma.wopiToken.deleteMany({ where: { documentId: id } }),
      prisma.wopiLock.deleteMany({ where: { documentId: id } }),
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
};

export const downloadDocument = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const doc = await prisma.document.findUnique({
            where: { id },
            include: {
                versions: { orderBy: { version: 'desc' }, take: 1 },
                approvers: true
            }
        });

        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Check permissions: Admin, Author, or Approver
        const isApprover = doc.approvers.some((a: any) => a.userId === user.id);
        if (user.role !== 'ADMIN' && doc.authorId !== user.id && !isApprover) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const latestVersion = doc.versions[0];
        if (!latestVersion) return res.status(404).json({ error: 'No file to download' });

        const filePath = path.resolve(latestVersion.filePath);
        res.download(filePath, path.basename(filePath));

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ error: 'Failed to download document' });
    }
};
