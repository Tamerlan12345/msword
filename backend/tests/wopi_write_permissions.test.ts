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
    (MockPrismaClient as any).mockInstance = mPrisma;
    return {
        PrismaClient: MockPrismaClient
    };
});

// Import after mock
import { PrismaClient } from '@prisma/client';
import { putFile } from '../src/controllers/wopiController';

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

describe('WOPI Write Permissions Security', () => {
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
            headers: { authorization: 'Bearer token1' },
            body: Buffer.from('test content')
        };
        jest.clearAllMocks();
        (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    // Helper to setup mock state
    const setupState = (userRole: string, docStatus: string, isAuthor: boolean, isCurrentApprover: boolean) => {
        const userId = 'user1';
        const authorId = isAuthor ? 'user1' : 'author_other';

        // Mock Token
        mPrisma.wopiToken.findUnique.mockResolvedValue({
            token: 'token1',
            expiresAt: new Date(Date.now() + 10000),
            userId: userId,
            user: { id: userId, role: userRole, name: 'Test User' },
            documentId: 'doc1'
        });

        // Mock Document
        const approvers = [];
        if (!isAuthor && userRole !== 'ADMIN') {
            // If not author/admin, assume approver role for simplicity in this helper
            // or just a user. If isCurrentApprover is true, add them.
             approvers.push({ userId: userId, isCurrent: isCurrentApprover });
        }

        mPrisma.document.findUnique.mockResolvedValue({
            id: 'doc1',
            authorId: authorId,
            status: docStatus,
            versions: [{ version: 1, filePath: '/tmp/file_v1.docx' }],
            approvers: approvers,
            updatedAt: new Date(),
        });

        // Version create mock
        mPrisma.documentVersion.create.mockResolvedValue({ id: 'ver2' });
        mPrisma.document.update.mockResolvedValue({ id: 'doc1' });
    };

    test('SECURITY FAIL: Author editing ON_APPROVAL document should be BLOCKED', async () => {
        // Author, Status ON_APPROVAL. Should be Read Only.
        setupState('USER', 'ON_APPROVAL', true, false);

        await putFile(req as Request, res as Response);

        // EXPECTATION: Should FAIL (return 403).
        // CURRENT REALITY: It will PASS (return 200) because validation is missing.
        // We assert what we WANT.
        if (status.mock.calls.length > 0 && status.mock.calls[0][0] === 403) {
             // Pass
        } else {
             // If it didn't fail with 403, we fail the test explicitly or expect 200 for now to prove vulnerability?
             // To "Reproduce" the vulnerability, we can assert that it currently SUCCESSES (200),
             // but usually we write the test for the desired state (403).
             // Since I need to prove it FAILS now, I will assert 403.
             expect(status).toHaveBeenCalledWith(403);
        }
    });

    test('SECURITY FAIL: Past Approver editing ON_APPROVAL document should be BLOCKED', async () => {
        // Approver (isCurrent=false), Status ON_APPROVAL. Should be Read Only.
        setupState('APPROVER', 'ON_APPROVAL', false, false);

        await putFile(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(403);
    });

    test('SECURITY FAIL: Author editing APPROVED document should be BLOCKED', async () => {
        // Author, Status APPROVED. Should be Read Only.
        setupState('USER', 'APPROVED', true, false);

        await putFile(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(403);
    });

    test('VALID: Current Approver editing ON_APPROVAL document should be ALLOWED', async () => {
        // Approver (isCurrent=true), Status ON_APPROVAL. Write allowed.
        setupState('APPROVER', 'ON_APPROVAL', false, true);

        await putFile(req as Request, res as Response);

        // Expect success (200 or json response)
        // putFile returns json({ ItemVersion: ... }) or status(200).
        // It calls res.status(200).json(...)
        expect(status).toHaveBeenCalledWith(200);
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test('VALID: Author editing DRAFT document should be ALLOWED', async () => {
        setupState('USER', 'DRAFT', true, false);

        await putFile(req as Request, res as Response);

        expect(status).toHaveBeenCalledWith(200);
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });
});
