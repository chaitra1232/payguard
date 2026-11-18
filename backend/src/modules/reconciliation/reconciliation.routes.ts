import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { reconciliationService } from './reconciliation.service';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

// POST /api/reconciliation/run-now - Trigger reconciliation run
router.post('/run-now', authenticateJWT, requireRole('admin', 'merchant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = (req.body.providerName as string) || 'MockPay';
    const result = await reconciliationService.runReconciliation(provider);

    res.status(201).json({
      success: true,
      data: {
        run: result
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reconciliation/runs - List reconciliation runs
router.get('/runs', authenticateJWT, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT * FROM reconciliation_runs ORDER BY created_at DESC LIMIT 20`
    );

    res.status(200).json({
      success: true,
      data: {
        runs: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reconciliation/runs/:id/items - Get items of a run
router.get('/runs/:id/items', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT * FROM reconciliation_items WHERE run_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.status(200).json({
      success: true,
      data: {
        items: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reconciliation/items/:id/resolve - Resolve discrepancy
router.patch('/items/:id/resolve', authenticateJWT, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = req.body.notes || 'Resolved by administrator';
    const result = await query(
      `UPDATE reconciliation_items
       SET resolution_status = 'MANUALLY_RESOLVED', resolved_by = $1, resolution_notes = $2
       WHERE id = $3
       RETURNING *`,
      [req.user!.id, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Reconciliation item not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        item: result.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
