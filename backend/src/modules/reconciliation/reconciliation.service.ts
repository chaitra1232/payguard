import { pool, query } from '../../config/database';
import { logger } from '../../utils/logger';

export class ReconciliationService {
  async runReconciliation(providerName = 'MockPay'): Promise<any> {
    logger.info(`Starting reconciliation run for provider [${providerName}]`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch internal payments for this provider in last 7 days
      const internalPaymentsRes = await client.query(
        `SELECT id, payment_reference, provider_transaction_id, amount_paise, status
         FROM payments
         WHERE provider_name = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
        [providerName]
      );
      const internalPayments = internalPaymentsRes.rows;

      // 2. Generate simulated provider settlement records with some matching and deliberate discrepancies
      // Discrepancy simulations test real-world bank settlement drift
      const providerSettlementRecords = internalPayments.map((p, index) => {
        // Every 5th record simulates a slight discrepancy for demonstration
        if (index === 2 && internalPayments.length > 2) {
          return {
            providerRef: p.provider_transaction_id || `sim_p_${p.id.slice(0, 8)}`,
            paymentRef: p.payment_reference,
            amountPaise: Number(p.amount_paise) + 100, // Amount mismatch (+₹1)
            status: p.status
          };
        }
        if (index === 4 && internalPayments.length > 4) {
          return {
            providerRef: p.provider_transaction_id || `sim_p_${p.id.slice(0, 8)}`,
            paymentRef: p.payment_reference,
            amountPaise: Number(p.amount_paise),
            status: p.status === 'CAPTURED' ? 'FAILED' : 'CAPTURED' // Status mismatch
          };
        }
        return {
          providerRef: p.provider_transaction_id || `sim_p_${p.id.slice(0, 8)}`,
          paymentRef: p.payment_reference,
          amountPaise: Number(p.amount_paise),
          status: p.status
        };
      });

      // 3. Create reconciliation run
      const runDate = new Date().toISOString().split('T')[0];
      const runInsert = await client.query(
        `INSERT INTO reconciliation_runs (provider_name, run_date, total_records, status)
         VALUES ($1, $2, $3, 'IN_PROGRESS')
         RETURNING id`,
        [providerName, runDate, internalPayments.length]
      );
      const runId = runInsert.rows[0].id;

      let matchedCount = 0;
      let mismatchedCount = 0;

      // 4. Compare records
      for (const pRecord of providerSettlementRecords) {
        const internal = internalPayments.find((i) => i.payment_reference === pRecord.paymentRef);

        let discrepancyType: 'NONE' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH' | 'MISSING_INTERNAL' = 'NONE';
        let resolutionStatus: 'UNRESOLVED' | 'MANUALLY_RESOLVED' = 'UNRESOLVED';

        if (!internal) {
          discrepancyType = 'MISSING_INTERNAL';
          mismatchedCount++;
        } else if (BigInt(internal.amount_paise) !== BigInt(pRecord.amountPaise)) {
          discrepancyType = 'AMOUNT_MISMATCH';
          mismatchedCount++;
        } else if (internal.status !== pRecord.status) {
          discrepancyType = 'STATUS_MISMATCH';
          mismatchedCount++;
        } else {
          matchedCount++;
          resolutionStatus = 'MANUALLY_RESOLVED'; // None discrepancy is clean
        }

        await client.query(
          `INSERT INTO reconciliation_items
           (run_id, payment_reference, provider_reference, internal_amount_paise, provider_amount_paise, internal_status, provider_status, discrepancy_type, resolution_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            runId,
            pRecord.paymentRef,
            pRecord.providerRef,
            internal ? internal.amount_paise : null,
            pRecord.amountPaise,
            internal ? internal.status : null,
            pRecord.status,
            discrepancyType,
            discrepancyType === 'NONE' ? 'MANUALLY_RESOLVED' : 'UNRESOLVED'
          ]
        );
      }

      // 5. Update run summary
      const updatedRun = await client.query(
        `UPDATE reconciliation_runs
         SET total_records = $1, matched_records = $2, mismatched_records = $3, status = 'COMPLETED',
             summary = $4
         WHERE id = $5
         RETURNING *`,
        [
          providerSettlementRecords.length,
          matchedCount,
          mismatchedCount,
          JSON.stringify({ matchPercentage: providerSettlementRecords.length > 0 ? ((matchedCount / providerSettlementRecords.length) * 100).toFixed(1) : 100 }),
          runId
        ]
      );

      await client.query('COMMIT');
      return updatedRun.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Reconciliation run error:', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const reconciliationService = new ReconciliationService();
