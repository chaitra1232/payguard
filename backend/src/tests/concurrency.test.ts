import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app';
import { pool, query } from '../config/database';

const app = createApp();

describe('Concurrency Safety: Simultaneous Requests Test', () => {
  let token: string;
  let merchantId: string;

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `concurrency_${Date.now()}@payguard.dev`,
        password: 'Password123!',
        fullName: 'Concurrency Tester',
        role: 'merchant'
      });
    token = regRes.body.data.token;

    const mRes = await request(app)
      .post('/api/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Burst Traffic Store' });
    merchantId = mRes.body.data.merchant.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('Sends concurrent requests with the SAME Idempotency-Key and creates EXACTLY ONE payment', async () => {
    const sharedKey = `burst-test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const payload = {
      merchantId,
      amountPaise: 125000, // ₹1,250.00
      currency: 'INR',
      paymentMethod: 'card',
      providerName: 'MockPay',
      simulateOutcome: 'success',
      description: 'Concurrent burst request stress test'
    };

    const CONCURRENT_REQUESTS = 100;
    console.log(`⚡ Dispatching ${CONCURRENT_REQUESTS} simultaneous requests with key [${sharedKey}]...`);

    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', sharedKey)
        .send(payload)
    );

    const responses = await Promise.all(promises);

    // Verify response status codes: must be either 201 (Created/Resolved) or 202 (In Progress)
    const validStatuses = responses.every((r) => r.status === 201 || r.status === 202 || r.status === 200);
    expect(validStatuses).toBe(true);

    // Query database directly to count actual physical payments created
    const dbPayments = await query(
      `SELECT COUNT(*) as count FROM payments WHERE amount_paise = 125000 AND merchant_id = $1`,
      [merchantId]
    );

    const physicalPaymentCount = Number(dbPayments.rows[0].count);
    console.log(`✅ Concurrency test completed. Total database payments created: ${physicalPaymentCount}`);

    // Exactly one payment must exist!
    expect(physicalPaymentCount).toBe(1);
  }, 60000);
});
