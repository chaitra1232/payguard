import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  Lock,
  RefreshCw,
  BookOpen,
  AlertTriangle,
  Server,
  ArrowRight,
  Activity,
  Layers,
  Database
} from 'lucide-react';
import { api } from '../services/api';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    database: string;
    gateway: string;
  };
}

export const LandingPage: React.FC<{ onEnterDashboard: () => void }> = ({ onEnterDashboard }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await api.get('/health');
        setHealth(response.data);
      } catch (err) {
        setHealth({
          status: 'OFFLINE',
          timestamp: new Date().toISOString(),
          services: { database: 'DISCONNECTED', gateway: 'OFFLINE' }
        });
      } finally {
        setLoading(false);
      }
    };
    checkBackend();
  }, []);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px 80px' }}>
      {/* Navigation Header */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
          }}>
            <ShieldCheck size={26} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>PAYGUARD</span>
            <span style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>Transaction Safety Platform</span>
          </div>
        </div>

        {/* Live Backend Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(20, 29, 51, 0.8)',
            padding: '6px 14px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '13px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: health?.status === 'UP' ? 'var(--success)' : 'var(--danger)',
              boxShadow: health?.status === 'UP' ? '0 0 8px var(--success)' : '0 0 8px var(--danger)'
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              Backend: <strong style={{ color: health?.status === 'UP' ? 'var(--success)' : 'var(--danger)' }}>
                {loading ? 'Checking...' : health?.status === 'UP' ? 'Online (PostgreSQL 16)' : 'Offline'}
              </strong>
            </span>
          </div>

          <button className="btn btn-primary" onClick={onEnterDashboard}>
            Launch Console <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', padding: '90px 20px 60px' }}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '999px',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          marginBottom: '28px'
        }}>
          <Zap size={15} color="#A855F7" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#C4B5FD' }}>
            Production-Grade Distributed Payment Simulation
          </span>
        </div>

        <h1 style={{
          fontSize: '56px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: '1.15',
          maxWidth: '900px',
          margin: '0 auto 24px'
        }}>
          Secure Every Transaction. <br />
          <span className="gradient-text">Trust Every Payment.</span>
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          maxWidth: '720px',
          margin: '0 auto 36px',
          lineHeight: '1.6'
        }}>
          An intelligent payment gateway engineered with deterministic idempotency, concurrency-safe PostgreSQL row locking, double-entry ledger accounting, and rule-based fraud detection.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '15px' }} onClick={onEnterDashboard}>
            Open Gateway Console <ArrowRight size={18} />
          </button>
          <a
            href="http://localhost:5000/api/health"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ padding: '14px 24px', fontSize: '15px' }}
          >
            <Server size={18} /> Inspect API Health
          </a>
        </div>
      </motion.section>

      {/* Metrics Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          margin: '30px 0 80px'
        }}
      >
        <div className="card glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Idempotency Accuracy</span>
            <Lock size={20} color="var(--cyan-accent)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>100.0%</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            SHA-256 payload lock + DB constraint
          </div>
        </div>

        <div className="card glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Concurrency Stress</span>
            <Layers size={20} color="var(--primary-purple)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>100 Req</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Zero double charges under burst retries
          </div>
        </div>

        <div className="card glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ledger Precision</span>
            <Database size={20} color="var(--success)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>₹0 Drift</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Strict double-entry (Debit = Credit)
          </div>
        </div>

        <div className="card glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Provider Availability</span>
            <Activity size={20} color="var(--electric-violet)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>Circuit Breaker</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Closed / Open / Half-Open state machine
          </div>
        </div>
      </motion.div>

      {/* Core Engineering Features */}
      <section style={{ margin: '60px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Production Architecture Highlights
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Engineered to overcome common real-world failures in payment gateway systems.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          <div className="card">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Lock size={22} color="var(--primary-purple)" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Pessimistic Idempotency</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Every payment request carries an <span className="code-pill">Idempotency-Key</span>. A SHA-256 hash of the request is locked with <span className="code-pill">SELECT FOR UPDATE</span> to prevent concurrent duplicate deductions.
            </p>
          </div>

          <div className="card">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(34, 211, 238, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <BookOpen size={22} color="var(--cyan-accent)" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Double-Entry Ledger</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Financial operations create atomic debit and credit entries stored as 64-bit integers in paise. The gateway verifies that total debits equal total credits on every transaction.
            </p>
          </div>

          <div className="card">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={22} color="var(--danger)" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Rule-Based Fraud Scoring</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Transactions undergo immediate velocity, volume, and card failure analysis. High-risk actions trigger manual review holds before provider execution.
            </p>
          </div>

          <div className="card">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <RefreshCw size={22} color="var(--success)" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Provider Circuit Breakers</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Simulated upstream providers (<span className="code-pill">MockPay</span> and <span className="code-pill">FastPay</span>) monitor error rates. When thresholds trip, requests fail fast to prevent connection pool exhaustion.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        marginTop: '100px',
        paddingTop: '30px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        <div>PayGuard © 2026. Educational Fintech Simulation for Computer Science Engineering.</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>PostgreSQL 16</span>
          <span>Express.js & TypeScript</span>
          <span>React & Vite</span>
        </div>
      </footer>
    </div>
  );
};
