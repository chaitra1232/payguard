import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { authenticateJWT } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/webhooks/events - List recorded webhook events
router.get('/events', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT e.*, m.business_name
       FROM webhook_events e
       JOIN merchants m ON e.merchant_id = m.id
       ORDER BY e.created_at DESC
       LIMIT 50`
    );

    res.status(200).json({
      success: true,
      data: {
        events: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/webhooks/deliveries - List webhook delivery attempts
router.get('/deliveries', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT d.*, e.event_type
       FROM webhook_deliveries d
       JOIN webhook_events e ON d.event_id = e.id
       ORDER BY d.created_at DESC
       LIMIT 50`
    );

    res.status(200).json({
      success: true,
      data: {
        deliveries: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
