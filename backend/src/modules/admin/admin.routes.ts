import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/admin/users - List registered platform users
router.get('/users', authenticateJWT, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 50`
    );

    res.status(200).json({
      success: true,
      data: {
        users: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/overview - System-wide health and totals
router.get('/overview', authenticateJWT, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userCount = await query('SELECT COUNT(*) FROM users');
    const merchantCount = await query('SELECT COUNT(*) FROM merchants');
    const orderCount = await query('SELECT COUNT(*) FROM orders');
    const paymentCount = await query('SELECT COUNT(*) FROM payments');
    const auditCount = await query('SELECT COUNT(*) FROM audit_logs');

    res.status(200).json({
      success: true,
      data: {
        totalUsers: Number(userCount.rows[0].count),
        totalMerchants: Number(merchantCount.rows[0].count),
        totalOrders: Number(orderCount.rows[0].count),
        totalPayments: Number(paymentCount.rows[0].count),
        totalAuditLogs: Number(auditCount.rows[0].count)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
