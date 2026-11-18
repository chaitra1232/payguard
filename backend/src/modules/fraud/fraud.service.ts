import { PoolClient } from 'pg';
import { query } from '../../config/database';

export interface FraudEvaluationResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggeredRules: Array<{ rule: string; scoreAdded: number; description: string }>;
  decision: 'APPROVE' | 'MANUAL_REVIEW' | 'DECLINE';
}

export class FraudService {
  async evaluateTransaction(
    params: {
      userId: string;
      amountPaise: number;
    },
    dbClient?: PoolClient
  ): Promise<FraudEvaluationResult> {
    const { userId, amountPaise } = params;
    const runner = dbClient ? dbClient.query.bind(dbClient) : query;
    let score = 0;
    const triggeredRules: Array<{ rule: string; scoreAdded: number; description: string }> = [];

    // Rule 1: High Velocity Check (attempts in last 10 minutes)
    const velocityRes = await runner(
      `SELECT COUNT(*) as count FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE o.customer_id = $1 AND p.created_at >= NOW() - INTERVAL '10 minutes'`,
      [userId]
    );
    const recentAttempts = Number(velocityRes.rows[0].count);
    if (recentAttempts >= 3) {
      score += 35;
      triggeredRules.push({
        rule: 'HIGH_VELOCITY_RECENT_ATTEMPTS',
        scoreAdded: 35,
        description: `Customer initiated ${recentAttempts} payment attempts in the last 10 minutes.`
      });
    }

    // Rule 2: Large Transaction Threshold (> ₹1,00,000 / 10,000,000 paise)
    if (amountPaise >= 10000000) {
      score += 40;
      triggeredRules.push({
        rule: 'UNUSUALLY_HIGH_AMOUNT',
        scoreAdded: 40,
        description: `Transaction amount (₹${amountPaise / 100}) exceeds standard velocity threshold.`
      });
    }

    // Rule 3: Repeated Recent Failures
    const failureRes = await runner(
      `SELECT COUNT(*) as count FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE o.customer_id = $1 AND p.status = 'FAILED' AND p.created_at >= NOW() - INTERVAL '15 minutes'`,
      [userId]
    );
    const recentFailures = Number(failureRes.rows[0].count);
    if (recentFailures >= 2) {
      score += 30;
      triggeredRules.push({
        rule: 'REPEATED_CARD_DECLINES',
        scoreAdded: 30,
        description: `Customer encountered ${recentFailures} failed payment attempts recently.`
      });
    }

    // Normalize max score to 100
    const finalScore = Math.min(score, 100);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let decision: 'APPROVE' | 'MANUAL_REVIEW' | 'DECLINE' = 'APPROVE';

    if (finalScore >= 75) {
      riskLevel = 'CRITICAL';
      decision = 'DECLINE';
    } else if (finalScore >= 45) {
      riskLevel = 'HIGH';
      decision = 'MANUAL_REVIEW';
    } else if (finalScore >= 25) {
      riskLevel = 'MEDIUM';
      decision = 'MANUAL_REVIEW';
    }

    return {
      riskScore: finalScore,
      riskLevel,
      triggeredRules,
      decision
    };
  }

  async recordAssessment(
    paymentId: string,
    evaluation: FraudEvaluationResult,
    dbClient?: PoolClient
  ): Promise<void> {
    const executor = dbClient ? dbClient.query.bind(dbClient) : query;
    await executor(
      `INSERT INTO risk_assessments (payment_id, risk_score, risk_level, triggered_rules, decision, review_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        paymentId,
        evaluation.riskScore,
        evaluation.riskLevel,
        JSON.stringify(evaluation.triggeredRules),
        evaluation.decision,
        evaluation.decision === 'MANUAL_REVIEW' ? 'PENDING_REVIEW' : 'AUTO_PROCESSED'
      ]
    );
  }
}

export const fraudService = new FraudService();
