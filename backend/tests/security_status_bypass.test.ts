import { Request, Response } from 'express';

// Mock @prisma/client
const mPrisma = {
    document: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn(() => mPrisma)
    };
});

// Import after mocking
import { updateDocument } from '../src/controllers/documentController';

describe('Security: Status Bypass Prevention', () => {
    let req: Partial<Request> = {};
    let res: Partial<Response> = {};
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status };
        req = {};
        jest.clearAllMocks();
    });

    it('should PREVENT Author from setting status to APPROVED directly from DRAFT', async () => {
        (req as any) = {
            params: { id: 'doc-1' },
            body: { status: 'APPROVED' },
            user: { id: 'author-1', role: 'USER' } // Author
        };

        const mockDoc = {
            id: 'doc-1',
            authorId: 'author-1',
            status: 'DRAFT'
        };

        (mPrisma.document.findUnique as jest.Mock).mockResolvedValue(mockDoc);

        await updateDocument(req as Request, res as Response);

        // Expect Forbidden (403) or Bad Request (400)
        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringMatching(/Cannot approve document before review completion/i)
        }));

        // Verify update was NOT called
        expect(mPrisma.document.update).not.toHaveBeenCalled();
    });

    it('should ALLOW Author to set status to APPROVED from REVIEW_REQUIRED', async () => {
        (req as any) = {
            params: { id: 'doc-1' },
            body: { status: 'APPROVED' },
            user: { id: 'author-1', role: 'USER' }
        };

        const mockDoc = {
            id: 'doc-1',
            authorId: 'author-1',
            status: 'REVIEW_REQUIRED'
        };

        (mPrisma.document.findUnique as jest.Mock).mockResolvedValue(mockDoc);
        (mPrisma.document.update as jest.Mock).mockResolvedValue({ ...mockDoc, status: 'APPROVED' });

        await updateDocument(req as Request, res as Response);

        expect(mPrisma.document.update).toHaveBeenCalledWith({
            where: { id: 'doc-1' },
            data: { status: 'APPROVED' }
        });
    });

    it('should ALLOW Author to set status to DRAFT from REJECTED', async () => {
        (req as any) = {
            params: { id: 'doc-1' },
            body: { status: 'DRAFT' },
            user: { id: 'author-1', role: 'USER' }
        };

        const mockDoc = {
            id: 'doc-1',
            authorId: 'author-1',
            status: 'REJECTED'
        };

        (mPrisma.document.findUnique as jest.Mock).mockResolvedValue(mockDoc);
        (mPrisma.document.update as jest.Mock).mockResolvedValue({ ...mockDoc, status: 'DRAFT' });

        await updateDocument(req as Request, res as Response);

         expect(mPrisma.document.update).toHaveBeenCalledWith({
            where: { id: 'doc-1' },
            data: { status: 'DRAFT' }
        });
    });

    it('should PREVENT Author from setting status to ON_APPROVAL directly', async () => {
        (req as any) = {
            params: { id: 'doc-1' },
            body: { status: 'ON_APPROVAL' },
            user: { id: 'author-1', role: 'USER' }
        };

        const mockDoc = {
            id: 'doc-1',
            authorId: 'author-1',
            status: 'DRAFT'
        };

        (mPrisma.document.findUnique as jest.Mock).mockResolvedValue(mockDoc);

        await updateDocument(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(403);
        expect(mPrisma.document.update).not.toHaveBeenCalled();
    });
});
