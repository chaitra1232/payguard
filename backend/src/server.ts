import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { pool, testConnection } from './config/database';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('Initializing PayGuard Payment Gateway Server...');

  // Verify database connectivity
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error('CRITICAL: Unable to establish PostgreSQL connection at startup. Exiting.');
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(`🚀 PayGuard API Server running on http://localhost:${env.PORT} in [${env.NODE_ENV}] mode`);
    logger.info(`🛡️  Health check endpoint available at http://localhost:${env.PORT}/api/health`);
  });

  // Graceful Shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await pool.end();
        logger.info('PostgreSQL connection pool closed.');
        process.exit(0);
      } catch (err) {
        logger.error('Error closing database pool:', err);
        process.exit(1);
      }
    });

    // Force close after 10s if hanging
    setTimeout(() => {
      logger.error('Forcefully terminating process after shutdown timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

bootstrap();
