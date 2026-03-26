import request from 'supertest';
import app from '../src/index';

describe('Security Headers (Helmet) and CORS', () => {
  it('should have basic security headers from Helmet', async () => {
    const response = await request(app).get('/');
    
    // Helmet headers
    expect(response.headers['x-dns-prefetch-control']).toBeDefined();
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBeDefined();
  });

  it('should handle CORS correctly', async () => {
    const response = await request(app)
      .options('/')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should reject CORS from unauthorized origin', async () => {
    const response = await request(app)
      .get('/')
      .set('Origin', 'http://evil.com');
    
    // If not in allowed list, it shouldn't return the header or should return a different one
    // Depending on cors middleware config, it might just not return Access-Control-Allow-Origin
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Rate Limiting', () => {
  it('should have rate limiting on auth routes (simulated)', async () => {
    // We won't trigger the limit here usually in a single test, 
    // but we can check if the headers exist if standardHeaders: true is set
    const response = await request(app).post('/api/auth/login').send({ email: 'test@test.com', password: 'password' });
    
    expect(response.headers['ratelimit-limit']).toBeDefined();
    expect(response.headers['ratelimit-remaining']).toBeDefined();
  });
});
