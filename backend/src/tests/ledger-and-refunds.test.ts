import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app';
import { pool, query } from '../config/database';

const app = createApp();

describe('Double-Entry Ledger & Refunds Test', () => {
  let token: string;
  let merchantId: string;
  let paymentId: string;
  const paymentAmountPaise = 20000; // ₹200.00

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `ledger_${Date.now()}@payguard.dev`,
        password: 'Password123!',
        fullName: 'Ledger Tester',
        role: 'merchant'
      });
    token = regRes.body.data.token;

    const mRes = await request(app)
      .post('/api/merchants')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Ledger Audit Store' });
    merchantId = mRes.body.data.merchant.id;

    // Create a captured payment
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        merchantId,
        amountPaise: paymentAmountPaise,
        currency: 'INR',
        simulateOutcome: 'success'
      });

    paymentId = payRes.body.data.payment.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('1. Confirms double-entry ledger debit equals credit', async () => {
    const ledgerRes = await request(app)
      .get('/api/ledger/entries')
      .set('Authorization', `Bearer ${token}`);

    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data.trialBalance.isBalanced).toBe(true);
    expect(BigInt(ledgerRes.body.data.trialBalance.totalDebitsPaise)).toBe(
      BigInt(ledgerRes.body.data.trialBalance.totalCreditsPaise)
    );
  });

  it('2. Processes partial refund successfully', async () => {
    const refundAmount = 5000; // ₹50.00
    const refRes = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentId,
        amountPaise: refundAmount,
        reason: 'Customer return part order'
      });

    expect(refRes.status).toBe(201);
    expect(refRes.body.data.newPaymentStatus).toBe('PARTIALLY_REFUNDED');
  });

  it('3. Rejects refund exceeding remaining balance with HTTP 400', async () => {
    // Already refunded 5,000 paise out of 20,000 paise. Remaining is 15,000.
    // Attempting to refund 16,000 should fail!
    const excessiveRefund = 16000;
    const failRes = await request(app)
      .post('/api/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentId,
        amountPaise: excessiveRefund,
        reason: 'Excessive refund attempt'
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.error.message).toContain('Refund amount exceeds remaining captured balance');
  });
});
