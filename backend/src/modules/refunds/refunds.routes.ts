import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool, query } from '../../config/database';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

const createRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amountPaise: z.coerce.number().int().positive('Refund amount must be positive'),
  reason: z.string().min(3)
});

// POST /api/refunds - Request a full or partial refund
router.post('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  const data = createRefundSchema.parse(req.body);
  const idempotencyKey = (req.headers['idempotency-key'] as string) || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock payment row for update to prevent concurrent over-refunding
    const paymentRes = await client.query(
      `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
      [data.paymentId]
    );

    if (paymentRes.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const payment = paymentRes.rows[0];

    if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
      throw new AppError(`Cannot refund payment in '${payment.status}' status. Only CAPTURED payments are refundable.`, 400);
    }

    // 2. Calculate existing successful refunds for this payment
    const existingRefundsRes = await client.query(
      `SELECT COALESCE(SUM(amount_paise), 0) as total_refunded
       FROM refunds
       WHERE payment_id = $1 AND status = 'SUCCESS'`,
      [data.paymentId]
    );

    const alreadyRefundedPaise = BigInt(existingRefundsRes.rows[0].total_refunded);
    const paymentAmountPaise = BigInt(payment.amount_paise);
    const requestedRefundPaise = BigInt(data.amountPaise);

    if (alreadyRefundedPaise + requestedRefundPaise > paymentAmountPaise) {
      const remainingPaise = paymentAmountPaise - alreadyRefundedPaise;
      throw new AppError(
        `Refund amount exceeds remaining captured balance. Maximum refundable amount is ${remainingPaise} paise.`,
        400
      );
    }

    // 3. Create Refund record
    const refundRef = `REF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const refundRes = await client.query(
      `INSERT INTO refunds (payment_id, refund_reference, amount_paise, reason, status, idempotency_key)
       VALUES ($1, $2, $3, $4, 'SUCCESS', $5)
       RETURNING *`,
      [data.paymentId, refundRef, data.amountPaise, data.reason, idempotencyKey]
    );
    const refund = refundRes.rows[0];

    // 4. Update Payment status
    const newTotalRefunded = alreadyRefundedPaise + requestedRefundPaise;
    const newPaymentStatus = newTotalRefunded === paymentAmountPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await client.query(
      `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPaymentStatus, data.paymentId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        refund,
        newPaymentStatus
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/refunds - List all refunds
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT r.*, p.payment_reference, p.amount_paise as original_amount_paise
       FROM refunds r
       JOIN payments p ON r.payment_id = p.id
       ORDER BY r.created_at DESC`
    );

    res.status(200).json({
      success: true,
      data: {
        refunds: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/refunds/:id - Get single refund
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT r.*, p.payment_reference, p.amount_paise as original_amount_paise
       FROM refunds r
       JOIN payments p ON r.payment_id = p.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Refund record not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        refund: result.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
