import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../config/database';

const app = createApp();

describe('Auth Module Integration Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  const testEmail = `test_${Date.now()}@payguard.dev`;

  it('1. Should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        fullName: 'Test Developer',
        role: 'customer'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testEmail);
  });

  it('2. Should reject duplicate email registration with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        fullName: 'Test Developer'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('3. Should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('4. Should reject login with invalid password with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(401);
  });

  it('5. Should reject unauthenticated requests to protected routes', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
