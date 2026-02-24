import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Mock @prisma/client with a factory that exposes the mock instance
jest.mock('@prisma/client', () => {
    const mPrisma = {
        wopiToken: {
            findUnique: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
            deleteMany: jest.fn(),
        },
        document: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        documentVersion: {
            create: jest.fn(),
        },
        wopiLock: {
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            delete: jest.fn()
        }
    };
    const MockPrismaClient = jest.fn(() => mPrisma);
    // Attach the mock instance to the constructor so we can access it in tests
    (MockPrismaClient as any).mockInstance = mPrisma;
    return {
        PrismaClient: MockPrismaClient
    };
});

// Import after mock
import { PrismaClient } from '@prisma/client';
import { checkFileInfo, validateWopiToken, putFile } from '../src/controllers/wopiController';

// Get the reference to the mock instance
const mPrisma = (PrismaClient as any).mockInstance;

jest.mock('fs', () => ({
    statSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    promises: {
        access: jest.fn(),
        writeFile: jest.fn(),
        stat: jest.fn()
    },
    constants: {
        F_OK: 0
    }
}));

jest.mock('path', () => {
    const original = jest.requireActual('path') as any;
    return {
        ...original,
        resolve: jest.fn((p) => p),
        dirname: jest.fn((p) => '/tmp'),
    };
});

describe('WOPI Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status, download: jest.fn(), setHeader: jest.fn(), sendStatus: jest.fn() };
        req = {
            params: { id: 'doc1' },
            query: { access_token: 'token1' },
            headers: {},
        };
        jest.clearAllMocks();
        // Default existsSync to true for happy paths (legacy/other endpoints)
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        // Default async mocks for checkFileInfo
        (fs.promises.access as jest.Mock).mockResolvedValue(undefined); // File exists
        (fs.promises.stat as jest.Mock).mockResolvedValue({ size: 100 });
    });

    test('validateWopiToken checks Authorization header', async () => {
        req.query = {};
        req.headers = { authorization: 'Bearer token1' };

        mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'user1' },
            documentId: 'doc1'
        });

        const token = await validateWopiToken(req as Request);
        expect(token).toBeTruthy();
        expect(token?.token).toBe('token1');
    });

    test('checkFileInfo returns 401 when token is invalid', async () => {
        req.query = { access_token: 'invalid_token' };
        mPrisma.wopiToken.findUnique.mockResolvedValue(null); // Token not found

        await checkFileInfo(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith({ error: 'Unauthorized WOPI host' });
    });

    test('checkFileInfo returns 404 when document is not found', async () => {
        // Valid token
        mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'user1' },
            documentId: 'doc1'
        });

        // Document not found
        mPrisma.document.findUnique.mockResolvedValue(null);

        await checkFileInfo(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ error: 'File not found' });
    });

    test('checkFileInfo returns 404 when file on disk is not found', async () => {
         // Valid token
         mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'user1' },
            documentId: 'doc1'
        });

        // Document found
        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'user1',
            status: 'DRAFT',
            versions: [{ version: 1, filePath: '/tmp/file.docx' }],
            approvers: [],
            updatedAt: new Date(),
        });

        // File does not exist on disk
        (fs.promises.access as jest.Mock).mockRejectedValue(new Error('No entry'));
        (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.stat as jest.Mock).mockRejectedValue(new Error('File not found'));

        await checkFileInfo(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ error: 'File on disk not found' });
    });

     test('checkFileInfo returns 500 on server error', async () => {
         // Simulate error in validateWopiToken or DB access
         mPrisma.wopiToken.findUnique.mockRejectedValue(new Error('DB Error'));

         await checkFileInfo(req as Request, res as Response);

         expect(status).toHaveBeenCalledWith(500);
         expect(json).toHaveBeenCalledWith({ error: 'Server Error' });
     });

    test('checkFileInfo permissions - Admin has full access', async () => {
        mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'admin1', role: 'ADMIN', name: 'Admin User' },
            documentId: 'doc1'
        });

        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'user2',
            status: 'ON_APPROVAL',
            versions: [{ version: 1, filePath: '/tmp/file.docx' }],
            approvers: [],
            updatedAt: new Date(),
        });

        // Mocks setup in beforeEach are sufficient

        await checkFileInfo(req as Request, res as Response);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            UserCanWrite: true,
            UserCanReview: true,
            ReadOnly: false,
            UserFriendlyName: 'Admin User',
        }));
    });

    test('checkFileInfo permissions - Author/Draft', async () => {
        mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'author1', role: 'USER', name: 'Author User' },
            documentId: 'doc1'
        });

        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'author1',
            status: 'DRAFT',
            versions: [{ version: 1, filePath: '/tmp/file.docx' }],
            approvers: [],
            updatedAt: new Date(),
        });

        await checkFileInfo(req as Request, res as Response);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            UserCanWrite: true,
            UserCanReview: false,
            ReadOnly: false,
            UserFriendlyName: 'Author User',
        }));
    });

    test('checkFileInfo permissions - Approver/OnApproval', async () => {
         mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'approver1', role: 'APPROVER', name: 'Approver User' },
            documentId: 'doc1'
        });

        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'author1',
            status: 'ON_APPROVAL',
            versions: [{ version: 1, filePath: '/tmp/file.docx' }],
            approvers: [{ userId: 'approver1', isCurrent: true }],
            updatedAt: new Date(),
        });

        await checkFileInfo(req as Request, res as Response);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            UserCanWrite: true,
            UserCanReview: true,
            ReadOnly: false,
            UserFriendlyName: 'Approver User',
        }));
    });

    test('checkFileInfo permissions - Approved (ReadOnly)', async () => {
         mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            user: { id: 'anyUser', role: 'ADMIN', name: 'Any User' },
            documentId: 'doc1'
        });

        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'author1',
            status: 'APPROVED',
            versions: [{ version: 1, filePath: '/tmp/file.docx' }],
            approvers: [],
            updatedAt: new Date(),
        });

        await checkFileInfo(req as Request, res as Response);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            UserCanWrite: false,
            UserCanReview: false,
            ReadOnly: true,
            SupportsReviewing: true
        }));
    });

    test('putFile versioning - Author can update', async () => {
        const fileContent = Buffer.from('new content');
        req.body = fileContent;
        // Mock validateWopiToken by checking Authorization header directly in test logic isn't enough,
        // we need to mock the prisma call inside validateWopiToken.
        req.headers = { authorization: 'Bearer token1' };

        mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            userId: 'author1',
            user: { id: 'author1', role: 'USER' },
            documentId: 'doc1'
        });

        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: 'author1',
            status: 'DRAFT',
            versions: [{ version: 1, filePath: '/tmp/file_v1.docx' }],
            approvers: [],
            updatedAt: new Date(),
        });

        mPrisma.documentVersion.create.mockResolvedValue({ id: 'ver2' });
        mPrisma.document.update.mockResolvedValue({ id: 'doc1' });

        (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

        await putFile(req as Request, res as Response);

        expect(fs.promises.writeFile).toHaveBeenCalledWith('/tmp/file_v2.docx', fileContent);
        expect(mPrisma.documentVersion.create).toHaveBeenCalledWith({
            data: {
                documentId: 'doc1',
                version: 2,
                filePath: '/tmp/file_v2.docx'
            }
        });
        expect(mPrisma.document.update).toHaveBeenCalledWith({
            where: { id: 'doc1' },
            data: {
                updatedAt: expect.any(Date),
                lastEditorId: 'author1'
            }
        });
        expect(json).toHaveBeenCalledWith({ ItemVersion: 'v2' });
    });
});
