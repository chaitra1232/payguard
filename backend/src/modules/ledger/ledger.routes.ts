import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/ledger/accounts - List ledger accounts
router.get('/accounts', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT a.*, m.business_name
       FROM ledger_accounts a
       LEFT JOIN merchants m ON a.merchant_id = m.id
       ORDER BY a.created_at ASC`
    );

    res.status(200).json({
      success: true,
      data: {
        accounts: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ledger/entries - List journal entries
router.get('/entries', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const result = await query(
      `SELECT e.*, a.account_name, a.account_number, a.account_type
       FROM ledger_entries e
       JOIN ledger_accounts a ON e.account_id = a.id
       ORDER BY e.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Calculate trial balance check
    const balanceCheck = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END), 0) as total_debits,
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END), 0) as total_credits
       FROM ledger_entries`
    );

    const debits = BigInt(balanceCheck.rows[0].total_debits);
    const credits = BigInt(balanceCheck.rows[0].total_credits);
    const isBalanced = debits === credits;

    res.status(200).json({
      success: true,
      data: {
        entries: result.rows,
        trialBalance: {
          totalDebitsPaise: debits.toString(),
          totalCreditsPaise: credits.toString(),
          isBalanced
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
