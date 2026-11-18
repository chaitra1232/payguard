import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { authenticateJWT } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/analytics/overview - Overall dashboard statistics
router.get('/overview', authenticateJWT, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Core KPIs
    const kpiRes = await query(`
      SELECT
        COUNT(*) as total_payments,
        COALESCE(SUM(CASE WHEN status = 'CAPTURED' THEN amount_paise ELSE 0 END), 0) as total_captured_paise,
        COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) as captured_count,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'PENDING' OR status = 'PROCESSING' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'REFUNDED' OR status = 'PARTIALLY_REFUNDED' THEN 1 END) as refund_count
      FROM payments
    `);

    // 2. Method breakdown
    const methodRes = await query(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount_paise), 0) as volume_paise
      FROM payments
      GROUP BY payment_method
    `);

    // 3. Provider breakdown
    const providerRes = await query(`
      SELECT provider_name,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) as captured,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
      FROM payments
      GROUP BY provider_name
    `);

    // 4. Daily volume trend (last 7 days)
    const trendRes = await query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD') as day,
        COUNT(*) as transactions,
        COALESCE(SUM(CASE WHEN status = 'CAPTURED' THEN amount_paise ELSE 0 END), 0) as volume_paise
      FROM payments
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY day ASC
    `);

    // 5. Fraud alerts count
    const fraudRes = await query(`
      SELECT
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) as critical_count,
        COUNT(CASE WHEN risk_level = 'HIGH' THEN 1 END) as high_count,
        COUNT(CASE WHEN review_status = 'PENDING_REVIEW' THEN 1 END) as pending_reviews
      FROM risk_assessments
    `);

    res.status(200).json({
      success: true,
      data: {
        kpis: kpiRes.rows[0],
        methodBreakdown: methodRes.rows,
        providerBreakdown: providerRes.rows,
        dailyTrend: trendRes.rows,
        fraudSummary: fraudRes.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
