import { Request, Response } from 'express';

// Mock @prisma/client with a factory that exposes the mock instance
jest.mock('@prisma/client', () => {
    const mPrisma = {
        document: {
            findMany: jest.fn(),
        },
    };
    const MockPrismaClient = jest.fn(() => mPrisma);
    (MockPrismaClient as any).mockInstance = mPrisma;
    return {
        PrismaClient: MockPrismaClient
    };
});

import { PrismaClient } from '@prisma/client';
import { getDocuments } from '../src/controllers/documentController';

const mPrisma = (PrismaClient as any).mockInstance;

describe('Document Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        res = { json, status };
        req = {
            user: { id: 'user1', role: 'USER' } // Mock user from auth middleware
        } as any;
        jest.clearAllMocks();
    });

    test('getDocuments uses select to optimize query', async () => {
        mPrisma.document.findMany.mockResolvedValue([]);

        await getDocuments(req as Request, res as Response);

        expect(mPrisma.document.findMany).toHaveBeenCalledTimes(1);
        const args = mPrisma.document.findMany.mock.calls[0][0];

        // Assert select is used instead of include
        expect(args).toHaveProperty('select');
        expect(args).not.toHaveProperty('include');

        // Assert specific fields
        expect(args.select).toHaveProperty('id');
        expect(args.select).toHaveProperty('title');
        expect(args.select).toHaveProperty('status');
        expect(args.select).not.toHaveProperty('content'); // Crucial

        // Assert versions is selected with specific fields (not full include)
        expect(args.select).toHaveProperty('versions');
        expect(args.select.versions).toHaveProperty('select');
        expect(args.select.versions.select).toHaveProperty('id');
        expect(args.select.versions.select).toHaveProperty('version');
        expect(args.select.versions.select).toHaveProperty('createdAt');

        // Assert related fields selection
        expect(args.select.author).toHaveProperty('select');
        expect(args.select.approvers).toHaveProperty('select');
    });

    test('getDocuments filters correctly for non-admin', async () => {
        (req as any).user = { id: 'user1', role: 'USER' };
        mPrisma.document.findMany.mockResolvedValue([]);

        await getDocuments(req as Request, res as Response);

        const args = mPrisma.document.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
            OR: [
                { authorId: 'user1' },
                {
                    approvers: {
                        some: {
                            userId: 'user1'
                        }
                    }
                }
            ]
        });
    });

    test('getDocuments returns all docs for admin', async () => {
        (req as any).user = { id: 'admin1', role: 'ADMIN' };
        mPrisma.document.findMany.mockResolvedValue([]);

        await getDocuments(req as Request, res as Response);

        const args = mPrisma.document.findMany.mock.calls[0][0];
        // For admin, where is empty object (or check implementation logic)
        expect(args.where).toEqual({});
    });
});
