import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { testConnection } from './config/database';
import { errorHandler } from './middleware/error.middleware';

// Import route modules
import authRoutes from './modules/auth/auth.routes';
import merchantsRoutes from './modules/merchants/merchants.routes';
import ordersRoutes from './modules/orders/orders.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import refundsRoutes from './modules/refunds/refunds.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import webhooksRoutes from './modules/webhooks/webhooks.routes';
import auditRoutes from './modules/audit/audit.routes';
import providerRoutes from './modules/providers/provider.routes';
import fraudRoutes from './modules/fraud/fraud.routes';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import adminRoutes from './modules/admin/admin.routes';

export const createApp = (): Application => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
    })
  );

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: 'Too many requests from this IP, please try again later.' }
    }
  });
  app.use(limiter);

  // Body Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Root welcome route
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'PayGuard API Gateway',
      version: '1.0.0',
      status: 'OPERATIONAL',
      tagline: 'Secure Every Transaction. Trust Every Payment.'
    });
  });

  // Health check endpoint
  app.get('/api/health', async (_req: Request, res: Response) => {
    const isDbConnected = await testConnection();
    res.status(isDbConnected ? 200 : 503).json({
      status: isDbConnected ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      services: {
        database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
        gateway: 'HEALTHY'
      }
    });
  });

  // Route Modules
  app.use('/api/auth', authRoutes);
  app.use('/api/merchants', merchantsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/refunds', refundsRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/providers', providerRoutes);
  app.use('/api/fraud', fraudRoutes);
  app.use('/api/reconciliation', reconciliationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Cannot ${req.method} ${req.originalUrl}`
      }
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
