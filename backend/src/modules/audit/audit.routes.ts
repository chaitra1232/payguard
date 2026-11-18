import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/audit-logs - List audit logs (admin and merchant)
router.get('/', authenticateJWT, requireRole('admin', 'merchant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const result = await query(
      `SELECT a.*, u.email as user_email, u.role as user_role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        auditLogs: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
