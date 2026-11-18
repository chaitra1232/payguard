import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../../config/database';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

const createOrderSchema = z.object({
  merchantId: z.string().uuid(),
  amountPaise: z.coerce.number().int().positive('Amount in paise must be positive'),
  currency: z.string().default('INR'),
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  description: z.string().optional()
});

// POST /api/orders - Create an authorized order
router.post('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const orderRef = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Verify merchant
    const merchant = await query('SELECT id FROM merchants WHERE id = $1', [data.merchantId]);
    if (merchant.rows.length === 0) {
      throw new AppError('Merchant not found', 404);
    }

    const result = await query(
      `INSERT INTO orders (merchant_id, customer_id, order_reference, currency, amount_paise, status, customer_email, customer_name, description)
       VALUES ($1, $2, $3, $4, $5, 'CREATED', $6, $7, $8)
       RETURNING *`,
      [
        data.merchantId,
        req.user!.id,
        orderRef,
        data.currency,
        data.amountPaise,
        data.customerEmail,
        data.customerName,
        data.description || 'Order purchase'
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        order: result.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders - List orders with search and status filtering
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    let queryText = `
      SELECT o.*, m.business_name,
        (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.id) as payment_attempts_count
      FROM orders o
      JOIN merchants m ON o.merchant_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      queryText += ` AND o.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (o.order_reference ILIKE $${params.length} OR o.customer_email ILIKE $${params.length})`;
    }

    queryText += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.status(200).json({
      success: true,
      data: {
        orders: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id - Get order details with payment history
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderRes = await query(
      `SELECT o.*, m.business_name, m.api_key
       FROM orders o
       JOIN merchants m ON o.merchant_id = m.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderRes.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const paymentsRes = await query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.status(200).json({
      success: true,
      data: {
        order: orderRes.rows[0],
        payments: paymentsRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
