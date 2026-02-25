import { Request, Response } from 'express';

// Mock @prisma/client with a factory that exposes the mock instance
jest.mock('@prisma/client', () => {
    const mPrisma = {
        document: {
            findMany: jest.fn(),
        },
        documentApprover: {
            findMany: jest.fn(),
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
import { getMetrics } from '../src/controllers/metricsController';
import { requireAdmin } from '../src/routes/metricsRoutes';

// Get the reference to the mock instance
const mPrisma = (PrismaClient as any).mockInstance;

describe('Metrics Endpoint Tests', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;
    let json: jest.Mock;
    let status: jest.Mock;

    beforeEach(() => {
        json = jest.fn();
        status = jest.fn().mockReturnValue({ json });
        next = jest.fn();
        res = { json, status };
        jest.clearAllMocks();
    });

    // --- 1. Middleware Tests ---
    describe('Admin Access Middleware (requireAdmin)', () => {
        test('should allow ADMIN user', () => {
            req = { user: { role: 'ADMIN' } } as any;
            requireAdmin(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(status).not.toHaveBeenCalled();
        });

        test('should block non-ADMIN user with 403', () => {
            req = { user: { role: 'USER' } } as any;
            requireAdmin(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(status).toHaveBeenCalledWith(403);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Access denied' }));
        });

        test('should block user without role', () => {
            req = { user: {} } as any;
            requireAdmin(req, res, next);
            expect(status).toHaveBeenCalledWith(403);
        });
    });

    // --- 2. Controller Logic Tests ---
    describe('getMetrics Controller', () => {
        beforeEach(() => {
            req = { query: { start: '2023-01-01', end: '2023-01-31' } };
        });

        test('should return correct summary and department metrics', async () => {
            // Mock Data
            const mockDocs = [
                { id: '1', status: 'APPROVED', createdAt: new Date('2023-01-10') },
                { id: '2', status: 'REJECTED', createdAt: new Date('2023-01-15') },
                { id: '3', status: 'ON_APPROVAL', createdAt: new Date('2023-01-20') },
            ];

            const mockApprovals = [
                {
                    status: 'APPROVED',
                    assignedAt: new Date('2023-01-10T10:00:00Z'),
                    actionDate: new Date('2023-01-10T11:00:00Z'), // 1 hour
                    user: { id: 'u1', name: 'Alice', surname: 'A', department: 'IT' }
                },
                {
                    status: 'REJECTED',
                    assignedAt: new Date('2023-01-15T10:00:00Z'),
                    actionDate: new Date('2023-01-15T12:00:00Z'), // 2 hours
                    user: { id: 'u2', name: 'Bob', surname: 'B', department: 'HR' }
                },
                {
                    status: 'APPROVED',
                    assignedAt: new Date('2023-01-16T10:00:00Z'),
                    actionDate: new Date('2023-01-16T11:00:00Z'), // 1 hour
                    user: { id: 'u1', name: 'Alice', surname: 'A', department: 'IT' }
                }
            ];

            const mockBottlenecks = [
                {
                    status: 'PENDING',
                    isCurrent: true,
                    user: { id: 'u3', name: 'Charlie', department: 'Sales' },
                    document: { title: 'Doc X' }
                }
            ];

            // Set Mocks
            mPrisma.document.findMany.mockResolvedValue(mockDocs);
            // First call for completedApprovals, second for bottlenecks
            mPrisma.documentApprover.findMany
                .mockResolvedValueOnce(mockApprovals)
                .mockResolvedValueOnce(mockBottlenecks);

            await getMetrics(req as Request, res as Response);

            // Assertions
            expect(res.json).toHaveBeenCalled();
            const data = (res.json as jest.Mock).mock.calls[0][0];

            // Summary
            expect(data.summary.totalSent).toBe(3);
            expect(data.summary.approved).toBe(1);
            expect(data.summary.rejected).toBe(1);
            expect(data.summary.onApproval).toBe(1);

            // Departments
            expect(data.departments).toHaveLength(2); // IT, HR
            const itDept = data.departments.find((d: any) => d.name === 'IT');
            expect(itDept).toBeDefined();
            expect(itDept.total).toBe(2);
            expect(itDept.avgTime).toBe(3600000); // 1 hour in ms

            // Users
            const alice = itDept.users.find((u: any) => u.id === 'u1');
            expect(alice).toBeDefined();
            expect(alice.total).toBe(2);
            expect(alice.avgTime).toBe(3600000);

            // Bottlenecks
            expect(data.bottlenecks).toHaveLength(1);
            expect(data.bottlenecks[0].id).toBe('u3');
            expect(data.bottlenecks[0].count).toBe(1);
        });

        test('should handle invalid dates gracefully', async () => {
            req.query = { start: 'invalid', end: 'date' };
            await getMetrics(req as Request, res as Response);
            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid date format' }));
        });
    });
});
