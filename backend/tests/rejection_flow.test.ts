import { Request, Response } from 'express';

// Mock @prisma/client
jest.mock('@prisma/client', () => {
    const mPrisma = {
        document: {
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
        documentApprover: {
            findUnique: jest.fn(),
            update: jest.fn(),
        }
    };
    return {
        PrismaClient: jest.fn(() => mPrisma)
    };
});

import { rejectDocument } from '../src/controllers/documentController';
import { prisma } from '../src/lib/prisma';

describe('Document Controller - Rejection Flow', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status } as any;
        req = {};
        jest.clearAllMocks();
    });

    test('should allow current approver to reject document', async () => {
        const userId = 'approver-1';
        const docId = 'doc-1';
        const comment = 'Bad doc';

        (req as any) = {
            params: { id: docId },
            body: { comment },
            user: { id: userId, role: 'USER' }
        };

        const mockApprover = {
            id: 'appr-1',
            documentId: docId,
            userId: userId,
            isCurrent: true, // IS CURRENT
            status: 'PENDING'
        };

        // Mock findUnique for DocumentApprover
        (prisma.documentApprover.findUnique as jest.Mock).mockResolvedValue(mockApprover);

        // Mock update for DocumentApprover
        (prisma.documentApprover.update as jest.Mock).mockResolvedValue({
            ...mockApprover,
            status: 'REJECTED',
            isCurrent: false
        });

        // Mock update for Document
        (prisma.document.update as jest.Mock).mockResolvedValue({
            id: docId,
            status: 'REJECTED'
        });

        await rejectDocument(req as Request, res as Response);

        // Verify
        expect(prisma.documentApprover.findUnique).toHaveBeenCalledWith({
            where: { documentId_userId: { documentId: docId, userId } }
        });

        expect(prisma.documentApprover.update).toHaveBeenCalledWith({
            where: { id: mockApprover.id },
            data: {
                isCurrent: false,
                status: 'REJECTED',
                comment: comment,
                actionDate: expect.any(Date)
            }
        });

        expect(prisma.document.update).toHaveBeenCalledWith({
            where: { id: docId },
            data: { status: 'REJECTED' }
        });
    });

    test('should prevent non-current approver from rejecting', async () => {
        const userId = 'approver-2';
        const docId = 'doc-1';

        (req as any) = {
            params: { id: docId },
            body: { comment: 'No' },
            user: { id: userId }
        };

        const mockApprover = {
            id: 'appr-2',
            isCurrent: false, // NOT CURRENT
            status: 'PENDING'
        };

        (prisma.documentApprover.findUnique as jest.Mock).mockResolvedValue(mockApprover);

        await rejectDocument(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(403);
        expect(prisma.documentApprover.update).not.toHaveBeenCalled();
        expect(prisma.document.update).not.toHaveBeenCalled();
    });
});
