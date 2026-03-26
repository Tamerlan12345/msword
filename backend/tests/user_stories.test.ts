const mPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
  },
  document: {
    create: jest.fn(),
  },
  wopiToken: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  }
};

jest.mock('../src/lib/prisma', () => ({
  prisma: mPrisma
}));

import request from 'supertest';
import app from '../src/index';
import bcrypt from 'bcrypt';

describe('Core User Story: Security and Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fail to create a user without admin token', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        name: 'New User',
        email: 'newuser@test.com',
        password: 'password123',
        role: 'APPROVER'
      });
    
    expect(response.status).toBe(401); // Unauthorized (missing token)
  });

  it('should fail login with wrong credentials', async () => {
    mPrisma.user.findUnique.mockResolvedValue(null); // User not found

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'wrong'
      });
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Неверные учетные данные');
  });

  it('should return 401 if password does not match', async () => {
    mPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      password: 'hashed_password'
    });
    
    // bcrypt.compare is hard to mock correctly if it's imported directly in index.ts
    // but here index.ts uses bcrypt.compare, so we can mock bcrypt if needed.
    // For now, let's just use the real bcrypt with a mismatch.
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'wrong_password'
      });
    
    expect(response.status).toBe(401);
  });
});
