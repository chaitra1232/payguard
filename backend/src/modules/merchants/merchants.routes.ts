import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../../config/database';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

const createMerchantSchema = z.object({
  businessName: z.string().min(2),
  webhookUrl: z.string().url().optional()
});

// POST /api/merchants - Register merchant profile for authenticated user
router.post('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createMerchantSchema.parse(req.body);
    const userId = req.user!.id;

    // Check if user already has a merchant profile
    const existing = await query('SELECT id FROM merchants WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      throw new AppError('Merchant profile already exists for this user', 409);
    }

    const apiKey = `pg_live_${crypto.randomBytes(24).toString('hex')}`;
    const webhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const result = await query(
      `INSERT INTO merchants (user_id, business_name, api_key, webhook_url, webhook_secret)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, business_name, api_key, webhook_url, is_active, created_at`,
      [userId, data.businessName, apiKey, data.webhookUrl || null, webhookSecret]
    );

    // Also auto-provision primary merchant ledger account
    const merchant = result.rows[0];
    await query(
      `INSERT INTO ledger_accounts (merchant_id, account_number, account_type, account_name, balance_paise)
       VALUES ($1, $2, 'LIABILITY', $3, 0)`,
      [merchant.id, `ACC-MERCHANT-${merchant.id.slice(0, 8).toUpperCase()}`, `${data.businessName} Settlement Account`]
    );

    res.status(201).json({
      success: true,
      data: {
        merchant,
        webhookSecret
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/merchants/me - Get current user's merchant profile
router.get('/me', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT id, business_name, api_key, webhook_url, is_active, created_at FROM merchants WHERE user_id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Merchant profile not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        merchant: result.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/merchants - List all merchants (admin only)
router.get('/', authenticateJWT, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT m.id, m.business_name, m.api_key, m.webhook_url, m.is_active, m.created_at, u.email as owner_email
       FROM merchants m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC`
    );

    res.status(200).json({
      success: true,
      data: {
        merchants: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
