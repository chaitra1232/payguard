import { PoolClient } from 'pg';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private failureThreshold = 3;
  private recoveryTimeMs = 15000;
  private successThreshold = 2;

  async getState(providerName: string, dbClient?: PoolClient): Promise<CircuitState> {
    const runner = dbClient ? dbClient.query.bind(dbClient) : query;
    const res = await runner(
      `SELECT * FROM provider_health WHERE provider_name = $1`,
      [providerName]
    );

    if (res.rows.length === 0) {
      await runner(
        `INSERT INTO provider_health (provider_name, state, consecutive_failures, consecutive_successes)
         VALUES ($1, 'CLOSED', 0, 0)
         ON CONFLICT (provider_name) DO NOTHING`,
        [providerName]
      );
      return 'CLOSED';
    }

    const record = res.rows[0];
    const now = Date.now();

    if (record.state === 'OPEN') {
      const lastChange = new Date(record.last_state_change_at).getTime();
      if (now - lastChange > this.recoveryTimeMs) {
        logger.warn(`Circuit Breaker for [${providerName}] transitioning from OPEN to HALF_OPEN`);
        await runner(
          `UPDATE provider_health
           SET state = 'HALF_OPEN', consecutive_successes = 0, last_state_change_at = CURRENT_TIMESTAMP
           WHERE provider_name = $1`,
          [providerName]
        );
        return 'HALF_OPEN';
      }
    }

    return record.state as CircuitState;
  }

  async recordSuccess(providerName: string, dbClient?: PoolClient): Promise<void> {
    const runner = dbClient ? dbClient.query.bind(dbClient) : query;
    const res = await runner(`SELECT * FROM provider_health WHERE provider_name = $1`, [providerName]);
    if (res.rows.length === 0) return;

    const record = res.rows[0];
    if (record.state === 'HALF_OPEN') {
      const successes = record.consecutive_successes + 1;
      if (successes >= this.successThreshold) {
        await runner(
          `UPDATE provider_health
           SET state = 'CLOSED', consecutive_failures = 0, consecutive_successes = 0, last_state_change_at = CURRENT_TIMESTAMP
           WHERE provider_name = $1`,
          [providerName]
        );
        return;
      }
      await runner(
        `UPDATE provider_health SET consecutive_successes = $1 WHERE provider_name = $2`,
        [successes, providerName]
      );
    } else {
      await runner(
        `UPDATE provider_health SET consecutive_failures = 0 WHERE provider_name = $1`,
        [providerName]
      );
    }
  }

  async recordFailure(providerName: string, dbClient?: PoolClient): Promise<void> {
    const runner = dbClient ? dbClient.query.bind(dbClient) : query;
    const res = await runner(`SELECT * FROM provider_health WHERE provider_name = $1`, [providerName]);
    const record = res.rows[0];
    const failures = (record?.consecutive_failures || 0) + 1;

    if (failures >= this.failureThreshold || record?.state === 'HALF_OPEN') {
      await runner(
        `INSERT INTO provider_health (provider_name, state, consecutive_failures, last_failure_at, last_state_change_at)
         VALUES ($1, 'OPEN', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (provider_name) DO UPDATE
         SET state = 'OPEN', consecutive_failures = $2, last_failure_at = CURRENT_TIMESTAMP, last_state_change_at = CURRENT_TIMESTAMP`,
        [providerName, failures]
      );
    } else {
      await runner(
        `UPDATE provider_health
         SET consecutive_failures = $1, last_failure_at = CURRENT_TIMESTAMP
         WHERE provider_name = $2`,
        [failures, providerName]
      );
    }
  }

  async reset(providerName: string, dbClient?: PoolClient): Promise<void> {
    const runner = dbClient ? dbClient.query.bind(dbClient) : query;
    await runner(
      `INSERT INTO provider_health (provider_name, state, consecutive_failures, consecutive_successes, last_state_change_at)
       VALUES ($1, 'CLOSED', 0, 0, CURRENT_TIMESTAMP)
       ON CONFLICT (provider_name) DO UPDATE
       SET state = 'CLOSED', consecutive_failures = 0, consecutive_successes = 0, last_state_change_at = CURRENT_TIMESTAMP`,
      [providerName]
    );
  }
}

export const circuitBreaker = new CircuitBreaker();
