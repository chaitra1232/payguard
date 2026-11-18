import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { circuitBreaker } from './circuit-breaker';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/providers/health - Get status of all providers
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = ['MockPay', 'FastPay'];
    const statuses = await Promise.all(
      providers.map(async (name) => {
        const state = await circuitBreaker.getState(name);
        const dbRes = await query('SELECT * FROM provider_health WHERE provider_name = $1', [name]);
        return {
          providerName: name,
          circuitState: state,
          details: dbRes.rows[0] || null
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        providers: statuses
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/providers/reset/:name - Reset circuit breaker for provider (Admin)
router.post('/reset/:name', authenticateJWT, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerName = req.params.name;
    await circuitBreaker.reset(providerName);
    res.status(200).json({
      success: true,
      message: `Circuit breaker for ${providerName} reset to CLOSED`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
