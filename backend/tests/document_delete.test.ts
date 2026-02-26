import { Request, Response } from 'express';

// Mock @prisma/client
jest.mock('@prisma/client', () => {
    const mPrisma = {
        document: {
            findUnique: jest.fn(),
            delete: jest.fn(),
        },
        documentVersion: {
            deleteMany: jest.fn(),
        },
        comment: {
            deleteMany: jest.fn(),
        },
        documentApprover: {
            deleteMany: jest.fn(),
        },
        wopiToken: {
            deleteMany: jest.fn(),
        },
        wopiLock: {
            deleteMany: jest.fn(),
        },
        $transaction: jest.fn((promises) => Promise.all(promises)),
    };
    const MockPrismaClient = jest.fn(() => mPrisma);
    (MockPrismaClient as any).mockInstance = mPrisma;
    return {
        PrismaClient: MockPrismaClient
    };
});

import { PrismaClient } from '@prisma/client';
import { deleteDocument } from '../src/controllers/documentController';

// Get the reference to the mock instance
const mPrisma = (PrismaClient as any).mockInstance;

describe('Document Delete Controller', () => {
    let req: any;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status };
        req = {
            params: { id: 'doc1' },
            user: { id: 'user1', role: 'USER' }
        };
        jest.clearAllMocks();
    });

    test('should delete document and all related entities including WOPI tokens and locks', async () => {
        // Setup mock doc
        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'user1',
            status: 'DRAFT'
        });

        mPrisma.documentVersion.deleteMany.mockResolvedValue({ count: 1 });
        mPrisma.comment.deleteMany.mockResolvedValue({ count: 0 });
        mPrisma.documentApprover.deleteMany.mockResolvedValue({ count: 0 });
        mPrisma.document.delete.mockResolvedValue({ id: 'doc1' });
        // Assume these are NOT called in the buggy version
        mPrisma.wopiToken.deleteMany.mockResolvedValue({ count: 1 });
        mPrisma.wopiLock.deleteMany.mockResolvedValue({ count: 0 });

        await deleteDocument(req as Request, res as Response);

        // Verify Author check passed
        expect(status).not.toHaveBeenCalledWith(403);
        expect(status).not.toHaveBeenCalledWith(404);

        // Verify transaction was called
        expect(mPrisma.$transaction).toHaveBeenCalled();

        // Verify standard deletions
        expect(mPrisma.documentVersion.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });
        expect(mPrisma.comment.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });
        expect(mPrisma.documentApprover.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });
        expect(mPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc1' } });

        // Verify CRITICAL FIX deletions (tokens/locks)
        // This assertion is expected to FAIL until fixed
        expect(mPrisma.wopiToken.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });
        expect(mPrisma.wopiLock.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });

        // Verify success response
        expect(json).toHaveBeenCalledWith({ message: 'Document deleted' });
    });
});
