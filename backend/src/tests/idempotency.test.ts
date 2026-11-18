import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app';
import { pool } from '../config/database';

const app = createApp();

describe('Idempotency Engine Integration Tests', () => {
  let token: string;
  let merchantId: string;

  beforeAll(async () => {
    // Register test merchant
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `merchant_${Date.now()}@payguard.dev`,
        password: 'Password123!',
        fullName: 'Idempotency Merchant',
        role: 'merchant'
      });
    token = regRes.body.data.token;

    const mRes = await request(app)
      .post('/api/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Idempotency Test Store' });
    merchantId = mRes.body.data.merchant.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('1. Rejects payment without Idempotency-Key header', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchantId,
        amountPaise: 50000,
        currency: 'INR'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Idempotency-Key header is required');
  });

  it('2. Processes initial payment with new Idempotency-Key', async () => {
    const key = crypto.randomUUID();
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        merchantId,
        amountPaise: 50000,
        currency: 'INR',
        simulateOutcome: 'success'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.status).toBe('CAPTURED');
  });

  it('3. Returns identical cached response when same key and same payload are submitted', async () => {
    const key = crypto.randomUUID();
    const payload = {
      merchantId,
      amountPaise: 75000,
      currency: 'INR',
      simulateOutcome: 'success'
    };

    // First request
    const firstRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(firstRes.status).toBe(201);
    const paymentRef = firstRes.body.data.payment.payment_reference;

    // Second duplicate request
    const secondRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.payment.payment_reference).toBe(paymentRef);
  });

  it('4. Rejects with 409 Conflict when same key is used with a different payload', async () => {
    const key = crypto.randomUUID();

    // First request
    await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        merchantId,
        amountPaise: 10000,
        currency: 'INR'
      });

    // Tampered payload with different amount
    const conflictRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        merchantId,
        amountPaise: 99999, // Tampered amount
        currency: 'INR'
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.message).toContain('Idempotency-Key conflict');
  });
});
