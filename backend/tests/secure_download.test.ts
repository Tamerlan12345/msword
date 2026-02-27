import request from 'supertest';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import app from '../src/index';

// Mock DB interactions for downloadDocument
jest.mock('../src/lib/prisma', () => {
    return {
        prisma: {
            user: {
                findUnique: jest.fn(),
                create: jest.fn(),
                count: jest.fn(),
            },
            wopiToken: {
                 create: jest.fn(),
                 findUnique: jest.fn(),
                 deleteMany: jest.fn(),
            },
            document: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                findMany: jest.fn(),
            },
            documentApprover: {
                findUnique: jest.fn(),
                update: jest.fn(),
                findFirst: jest.fn(),
                deleteMany: jest.fn(),
                create: jest.fn(),
            },
            wopiLock: {
                deleteMany: jest.fn(),
            },
            documentVersion: {
                deleteMany: jest.fn(),
            },
            comment: {
                deleteMany: jest.fn(),
            },
            $transaction: jest.fn((promises) => Promise.all(promises)),
        }
    };
});

import { prisma } from '../src/lib/prisma';

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const TEST_FILE = 'secure_test.txt';
const TEST_FILE_PATH = path.join(UPLOAD_DIR, TEST_FILE);
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

describe('Secure Download Verification', () => {
    let authToken: string;
    let userId = 'user-1';

    beforeAll(() => {
        // Create dummy file
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        fs.writeFileSync(TEST_FILE_PATH, 'Secure Content');

        // Generate Token
        authToken = jwt.sign({ id: userId, email: 'test@example.com', role: 'USER', name: 'Test User' }, JWT_SECRET);
    });

    afterAll(() => {
        if (fs.existsSync(TEST_FILE_PATH)) {
            fs.unlinkSync(TEST_FILE_PATH);
        }
    });

    test('1. Public access to /uploads should be BLOCKED (404)', async () => {
        const res = await request(app).get(`/uploads/${TEST_FILE}`);
        // Express static is removed, so it should return 404 (Cannot GET /uploads/...)
        expect(res.status).toBe(404);
    });

    test('2. Authenticated Author should be able to download via API', async () => {
        // Mock DB response for document check
        (prisma.document.findUnique as jest.Mock).mockResolvedValue({
            id: 'doc-1',
            authorId: userId,
            title: 'Test Doc',
            versions: [{ version: 1, filePath: TEST_FILE_PATH }],
            approvers: []
        });

        const res = await request(app)
            .get('/api/documents/doc-1/download')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toBe('Secure Content');
        expect(res.header['content-disposition']).toContain(TEST_FILE);
    });

    test('3. Unauthorized user should be BLOCKED (403)', async () => {
        // Mock DB response: Document owned by someone else
        (prisma.document.findUnique as jest.Mock).mockResolvedValue({
            id: 'doc-2',
            authorId: 'other-user',
            title: 'Secret Doc',
            versions: [{ version: 1, filePath: TEST_FILE_PATH }],
            approvers: []
        });

        const res = await request(app)
            .get('/api/documents/doc-2/download')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(403);
    });

    test('4. Admin should be able to download any document', async () => {
        const adminToken = jwt.sign({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN', name: 'Admin' }, JWT_SECRET);

         (prisma.document.findUnique as jest.Mock).mockResolvedValue({
            id: 'doc-3',
            authorId: 'other-user',
            title: 'Any Doc',
            versions: [{ version: 1, filePath: TEST_FILE_PATH }],
            approvers: []
        });

        const res = await request(app)
            .get('/api/documents/doc-3/download')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });
});
