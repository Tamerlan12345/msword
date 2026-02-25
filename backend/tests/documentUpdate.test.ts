import { Request, Response } from 'express';

// Mock @prisma/client
jest.mock('@prisma/client', () => {
    const mPrisma = {
        document: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };
    return {
        PrismaClient: jest.fn(() => mPrisma)
    };
});

import { updateDocument } from '../src/controllers/documentController';
import { prisma } from '../src/lib/prisma';

describe('Document Controller - Update Access Control', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status };
        req = {};
        jest.clearAllMocks();
    });

    test('should prevent non-admin from updating another user document', async () => {
        // Setup User B (Attacker)
        (req as any) = {
            params: { id: 'doc-1' },
            body: { status: 'APPROVED' },
            user: { id: 'user-b', role: 'USER' }
        };

        // Setup Document owned by User A (Victim)
        const mockDoc = {
            id: 'doc-1',
            authorId: 'user-a',
            status: 'DRAFT'
        };

        (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDoc);
        // Mock update to succeed if called (simulating the bug)
        (prisma.document.update as jest.Mock).mockResolvedValue({ ...mockDoc, status: 'APPROVED' });

        await updateDocument(req as Request, res as Response);

        // EXPECTATION: Should be 403 Forbidden
        expect(status).toHaveBeenCalledWith(403);

        // Ensure update was NOT called
        expect(prisma.document.update).not.toHaveBeenCalled();
    });

    test('should allow author to update their own document', async () => {
        (req as any) = {
            params: { id: 'doc-1' },
            body: { status: 'ON_APPROVAL' },
            user: { id: 'user-a', role: 'USER' }
        };

        const mockDoc = {
            id: 'doc-1',
            authorId: 'user-a',
            status: 'DRAFT'
        };

        (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDoc);
        (prisma.document.update as jest.Mock).mockResolvedValue({ ...mockDoc, status: 'ON_APPROVAL' });

        await updateDocument(req as Request, res as Response);
    });
});
