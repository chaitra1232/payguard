import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool, query } from '../../config/database';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { circuitBreaker } from '../providers/circuit-breaker';
import { fraudService } from '../fraud/fraud.service';

const router = Router();

const createPaymentSchema = z.object({
  merchantId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  amountPaise: z.coerce.number().int().positive('Amount in paise must be positive'),
  currency: z.string().default('INR'),
  paymentMethod: z.enum(['card', 'upi', 'netbanking']).default('card'),
  providerName: z.enum(['MockPay', 'FastPay']).default('MockPay'),
  simulateOutcome: z.enum(['success', 'failure', 'timeout']).default('success'),
  description: z.string().optional()
});

// POST /api/payments - Initiate payment with Idempotency, Fraud check, Circuit Breaker & Double-Entry Ledger
router.post('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) {
    res.status(400).json({
      success: false,
      error: { message: 'Idempotency-Key header is required for payment creation' }
    });
    return;
  }

  const userId = req.user!.id;
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  const requestPath = req.originalUrl;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Concurrency-Safe Idempotency Check with pessimistic row lock
    let existingKeyRes = await client.query(
      `SELECT * FROM idempotency_keys WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE`,
      [userId, idempotencyKey]
    );

    if (existingKeyRes.rows.length === 0) {
      // Attempt atomic reservation with ON CONFLICT DO NOTHING
      const insertRes = await client.query(
        `INSERT INTO idempotency_keys (user_id, idempotency_key, request_path, request_hash, status, expires_at)
         VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [userId, idempotencyKey, requestPath, payloadHash, expiresAt]
      );

      // If another parallel thread won the race, fetch its row
      if (insertRes.rows.length === 0) {
        existingKeyRes = await client.query(
          `SELECT * FROM idempotency_keys WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE`,
          [userId, idempotencyKey]
        );
      }
    }

    if (existingKeyRes.rows.length > 0) {
      const existing = existingKeyRes.rows[0];
      if (existing.request_hash !== payloadHash) {
        await client.query('ROLLBACK');
        res.status(409).json({
          success: false,
          error: {
            message: 'Idempotency-Key conflict: A request with this key already exists with different payload parameters'
          }
        });
        return;
      }

      if (existing.status === 'RESOLVED' && existing.response_body) {
        await client.query('COMMIT');
        res.status(existing.response_code || 200).json(existing.response_body);
        return;
      }

      if (existing.status === 'IN_PROGRESS') {
        await client.query('COMMIT');
        res.status(202).json({
          success: true,
          message: 'Payment is currently being processed by another concurrent request',
          idempotencyKey
        });
        return;
      }
    }

    const data = createPaymentSchema.parse(req.body);

    // 2. Check Circuit Breaker for chosen provider (reusing transaction client to prevent connection pool exhaustion)
    const circuitState = await circuitBreaker.getState(data.providerName, client);
    if (circuitState === 'OPEN') {
      await client.query('ROLLBACK');
      res.status(503).json({
        success: false,
        error: {
          code: 'CIRCUIT_BREAKER_OPEN',
          message: `Provider [${data.providerName}] is currently unavailable due to high error rates. Circuit Breaker is OPEN.`
        }
      });
      return;
    }

    // 3. Rule-Based Fraud Risk Evaluation (reusing transaction client)
    const fraudEvaluation = await fraudService.evaluateTransaction({
      userId,
      amountPaise: data.amountPaise
    }, client);

    if (fraudEvaluation.decision === 'DECLINE') {
      await client.query('ROLLBACK');
      res.status(403).json({
        success: false,
        error: {
          code: 'FRAUD_DECLINE',
          message: 'Transaction declined by automated risk scoring engine.',
          riskScore: fraudEvaluation.riskScore,
          triggeredRules: fraudEvaluation.triggeredRules
        }
      });
      return;
    }

    // Verify merchant exists
    const merchantRes = await client.query('SELECT id, business_name FROM merchants WHERE id = $1', [data.merchantId]);
    if (merchantRes.rows.length === 0) {
      throw new AppError('Merchant not found', 404);
    }

    // 4. Order verification or automatic placeholder order
    let orderId = data.orderId;
    if (!orderId) {
      const orderRef = `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const newOrder = await client.query(
        `INSERT INTO orders (merchant_id, customer_id, order_reference, amount_paise, status, customer_email, customer_name, description)
         VALUES ($1, $2, $3, $4, 'CREATED', $5, $6, $7)
         RETURNING id`,
        [data.merchantId, userId, orderRef, data.amountPaise, req.user!.email, 'PayGuard Customer', data.description || 'Checkout Payment']
      );
      orderId = newOrder.rows[0].id;
    }

    // 5. Create Payment record in PROCESSING state
    const paymentRef = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const paymentInsert = await client.query(
      `INSERT INTO payments (order_id, merchant_id, payment_reference, amount_paise, currency, status, payment_method, provider_name)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING', $6, $7)
       RETURNING id, payment_reference, amount_paise, currency, status, created_at`,
      [orderId, data.merchantId, paymentRef, data.amountPaise, data.currency, data.paymentMethod, data.providerName]
    );
    const payment = paymentInsert.rows[0];

    // Record fraud assessment within the same transaction
    await fraudService.recordAssessment(payment.id, fraudEvaluation, client);

    // 6. Provider simulation execution
    const startTime = Date.now();
    let finalStatus: 'CAPTURED' | 'FAILED' = 'CAPTURED';
    let providerTxId: string | null = `sim_tx_${crypto.randomBytes(8).toString('hex')}`;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    if (data.simulateOutcome === 'failure') {
      finalStatus = 'FAILED';
      providerTxId = null;
      errorCode = 'INSUFFICIENT_FUNDS';
      errorMessage = 'Simulated card decline: Insufficient balance';
      await circuitBreaker.recordFailure(data.providerName, client);
    } else if (data.simulateOutcome === 'timeout') {
      finalStatus = 'FAILED';
      providerTxId = null;
      errorCode = 'PROVIDER_TIMEOUT';
      errorMessage = 'Simulated gateway timeout waiting for upstream provider';
      await circuitBreaker.recordFailure(data.providerName, client);
    } else {
      await circuitBreaker.recordSuccess(data.providerName, client);
    }

    const latencyMs = Date.now() - startTime + 40;

    // Log attempt
    await client.query(
      `INSERT INTO payment_attempts (payment_id, attempt_number, provider_name, status, raw_request, raw_response, latency_ms, error_message)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7)`,
      [
        payment.id,
        data.providerName,
        finalStatus,
        JSON.stringify({ amount: data.amountPaise, currency: data.currency }),
        JSON.stringify({ status: finalStatus, providerTxId }),
        latencyMs,
        errorMessage
      ]
    );

    // Update payment record with explicit casts for PostgreSQL type inference
    const updatedPaymentRes = await client.query(
      `UPDATE payments
       SET status = $1::varchar, provider_transaction_id = $2, error_code = $3, error_message = $4,
           captured_at = CASE WHEN $1::varchar = 'CAPTURED' THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [finalStatus, providerTxId, errorCode, errorMessage, payment.id]
    );
    const updatedPayment = updatedPaymentRes.rows[0];

    // 7. Atomic Double-Entry Ledger & Outbox if CAPTURED
    if (finalStatus === 'CAPTURED') {
      await client.query(`UPDATE orders SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);

      // Ensure merchant ledger account exists
      let merchantAccountRes = await client.query(
        `SELECT id FROM ledger_accounts WHERE merchant_id = $1`,
        [data.merchantId]
      );

      let merchantAccountId = merchantAccountRes.rows[0]?.id;
      if (!merchantAccountId) {
        const newAcc = await client.query(
          `INSERT INTO ledger_accounts (merchant_id, account_number, account_type, account_name, balance_paise)
           VALUES ($1, $2, 'LIABILITY', 'Merchant Settlement Account', 0)
           RETURNING id`,
          [data.merchantId, `ACC-${data.merchantId.slice(0, 8)}`]
        );
        merchantAccountId = newAcc.rows[0].id;
      }

      // Ensure gateway clearing asset account exists
      let clearingAccountRes = await client.query(
        `SELECT id FROM ledger_accounts WHERE account_number = 'ACC-GATEWAY-CLEARING'`
      );
      let clearingAccountId = clearingAccountRes.rows[0]?.id;
      if (!clearingAccountId) {
        const clearingAcc = await client.query(
          `INSERT INTO ledger_accounts (account_number, account_type, account_name, balance_paise)
           VALUES ('ACC-GATEWAY-CLEARING', 'ASSET', 'PayGuard Gateway Clearing Account', 0)
           RETURNING id`
        );
        clearingAccountId = clearingAcc.rows[0].id;
      }

      // Atomic Journal Entry: Balanced Debit & Credit
      const journalId = crypto.randomUUID();
      // Entry 1: DEBIT Gateway Clearing (Asset increases)
      await client.query(
        `INSERT INTO ledger_entries (journal_id, account_id, entry_type, amount_paise, description, reference_id, reference_type)
         VALUES ($1, $2, 'DEBIT', $3, $4, $5, 'PAYMENT')`,
        [journalId, clearingAccountId, data.amountPaise, `Customer Payment ${paymentRef}`, payment.id]
      );
      // Entry 2: CREDIT Merchant Settlement (Liability increases to merchant)
      await client.query(
        `INSERT INTO ledger_entries (journal_id, account_id, entry_type, amount_paise, description, reference_id, reference_type)
         VALUES ($1, $2, 'CREDIT', $3, $4, $5, 'PAYMENT')`,
        [journalId, merchantAccountId, data.amountPaise, `Settlement Credit for ${paymentRef}`, payment.id]
      );

      // Update Account Balances
      await client.query(
        `UPDATE ledger_accounts SET balance_paise = balance_paise + $1 WHERE id = $2`,
        [data.amountPaise, clearingAccountId]
      );
      await client.query(
        `UPDATE ledger_accounts SET balance_paise = balance_paise + $1 WHERE id = $2`,
        [data.amountPaise, merchantAccountId]
      );

      // 8. Transactional Outbox Pattern: Insert webhook event
      await client.query(
        `INSERT INTO outbox_events (event_type, payload, status)
         VALUES ('payment.captured', $1, 'PENDING')`,
        [JSON.stringify({ event: 'payment.captured', payment: updatedPayment })]
      );

      await client.query(
        `INSERT INTO webhook_events (merchant_id, event_type, payload)
         VALUES ($1, 'payment.captured', $2)`,
        [data.merchantId, JSON.stringify({ event: 'payment.captured', payment: updatedPayment })]
      );
    }

    // Response object
    const responsePayload = {
      success: finalStatus === 'CAPTURED',
      data: {
        payment: updatedPayment,
        fraudRisk: {
          score: fraudEvaluation.riskScore,
          level: fraudEvaluation.riskLevel
        }
      }
    };

    // Resolve idempotency key with response
    await client.query(
      `UPDATE idempotency_keys
       SET status = 'RESOLVED', response_code = $1, response_body = $2
       WHERE user_id = $3 AND idempotency_key = $4`,
      [201, JSON.stringify(responsePayload), userId, idempotencyKey]
    );

    await client.query('COMMIT');
    res.status(201).json(responsePayload);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/payments - List payments
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const result = await query(
      `SELECT p.*, o.order_reference, m.business_name
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       JOIN merchants m ON p.merchant_id = m.id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        payments: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id - Get payment details
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT p.*, o.order_reference, o.customer_email, m.business_name
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       JOIN merchants m ON p.merchant_id = m.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const attempts = await query(
      `SELECT * FROM payment_attempts WHERE payment_id = $1 ORDER BY attempt_number ASC`,
      [req.params.id]
    );

    const fraudRes = await query(
      `SELECT * FROM risk_assessments WHERE payment_id = $1`,
      [req.params.id]
    );

    res.status(200).json({
      success: true,
      data: {
        payment: result.rows[0],
        attempts: attempts.rows,
        fraudAssessment: fraudRes.rows[0] || null
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
