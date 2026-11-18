import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

// GET /api/fraud/assessments - List risk assessments (admin and merchant)
router.get('/assessments', authenticateJWT, requireRole('admin', 'merchant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const result = await query(
      `SELECT r.*, p.payment_reference, p.amount_paise, p.provider_name, p.status as payment_status
       FROM risk_assessments r
       JOIN payments p ON r.payment_id = p.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        assessments: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  action: z.enum(['APPROVED_BY_ADMIN', 'REJECTED_BY_ADMIN']),
  notes: z.string().min(3)
});

// POST /api/fraud/review/:id - Manually approve or decline a flagged transaction
router.post('/review/:id', authenticateJWT, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = reviewSchema.parse(req.body);
    const assessmentId = req.params.id;

    const assessmentRes = await query('SELECT * FROM risk_assessments WHERE id = $1', [assessmentId]);
    if (assessmentRes.rows.length === 0) {
      throw new AppError('Risk assessment record not found', 404);
    }

    const updated = await query(
      `UPDATE risk_assessments
       SET review_status = $1, reviewed_by = $2, review_notes = $3
       WHERE id = $4
       RETURNING *`,
      [data.action, req.user!.id, data.notes, assessmentId]
    );

    res.status(200).json({
      success: true,
      data: {
        assessment: updated.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
