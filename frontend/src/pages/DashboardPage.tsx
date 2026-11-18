import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ArrowLeft,
  RefreshCw,
  Send,
  Copy,
  Check,
  ShieldAlert,
  BookOpen,
  Activity,
  Layers,
  FileText,
  RotateCcw,
  HelpCircle,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { api } from '../services/api';

type TabType =
  | 'overview'
  | 'terminal'
  | 'orders'
  | 'ledger'
  | 'fraud'
  | 'reconciliation'
  | 'providers'
  | 'webhooks'
  | 'audit';

export const DashboardPage: React.FC<{ onBackToHome: () => void }> = ({ onBackToHome }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'merchant' | 'admin'>('merchant');

  // Overview / Analytics data
  const [analytics, setAnalytics] = useState<any>(null);

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [newOrderAmount, setNewOrderAmount] = useState<number>(1499);
  const [newOrderEmail, setNewOrderEmail] = useState<string>('customer@example.com');
  const [newOrderDesc, setNewOrderDesc] = useState<string>('Pro Developer Subscription');

  // Payments & Terminal
  const [payments, setPayments] = useState<any[]>([]);
  const [amountRupees, setAmountRupees] = useState<number>(499);
  const [provider, setProvider] = useState<string>('MockPay');
  const [method, setMethod] = useState<string>('card');
  const [outcome, setOutcome] = useState<string>('success');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [copied, setCopied] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  // Ledger & Refunds
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [refundPaymentId, setRefundPaymentId] = useState<string>('');
  const [refundAmountRupees, setRefundAmountRupees] = useState<number>(100);
  const [refundReason, setRefundReason] = useState<string>('Customer requested refund');
  const [refundMessage, setRefundMessage] = useState<string | null>(null);

  // Fraud
  const [fraudAssessments, setFraudAssessments] = useState<any[]>([]);

  // Reconciliation
  const [reconciliationRuns, setReconciliationRuns] = useState<any[]>([]);
  const [reconciliationItems, setReconciliationItems] = useState<any[]>([]);

  // Providers
  const [providerStatuses, setProviderStatuses] = useState<any[]>([]);

  // Webhooks & Outbox
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Authenticate or get merchant ID
  const ensureAuth = async () => {
    let token = localStorage.getItem('payguard_token');
    let merchantId = localStorage.getItem('payguard_default_merchant');

    if (!token || !merchantId) {
      try {
        const regRes = await api.post('/auth/register', {
          email: `merchant_${Date.now()}@payguard.dev`,
          password: 'Password123!',
          fullName: 'Demo Enterprise Merchant',
          role: 'merchant'
        });
        token = regRes.data.data.token;
        if (token) localStorage.setItem('payguard_token', token);

        const mRes = await api.post('/merchants', {
          businessName: 'Nova Commerce Global',
          webhookUrl: 'https://webhook.site/payguard-demo'
        });
        merchantId = mRes.data.data.merchant.id;
        if (merchantId) localStorage.setItem('payguard_default_merchant', merchantId);
      } catch (e) {
        console.error('Auth setup error:', e);
      }
    }
  };

  const loadDataForTab = async (tab: TabType) => {
    setLoading(true);
    await ensureAuth();

    try {
      if (tab === 'overview') {
        const res = await api.get('/analytics/overview');
        setAnalytics(res.data.data);
      } else if (tab === 'terminal') {
        const res = await api.get('/payments');
        setPayments(res.data.data.payments);
      } else if (tab === 'orders') {
        const res = await api.get(`/orders?search=${encodeURIComponent(orderSearch)}`);
        setOrders(res.data.data.orders);
      } else if (tab === 'ledger') {
        const accRes = await api.get('/ledger/accounts');
        const entRes = await api.get('/ledger/entries');
        setLedgerAccounts(accRes.data.data.accounts);
        setLedgerEntries(entRes.data.data.entries);
        setTrialBalance(entRes.data.data.trialBalance);
      } else if (tab === 'fraud') {
        const res = await api.get('/fraud/assessments');
        setFraudAssessments(res.data.data.assessments);
      } else if (tab === 'reconciliation') {
        const runsRes = await api.get('/reconciliation/runs');
        setReconciliationRuns(runsRes.data.data.runs);
        if (runsRes.data.data.runs.length > 0) {
          const firstId = runsRes.data.data.runs[0].id;
          const itemsRes = await api.get(`/reconciliation/runs/${firstId}/items`);
          setReconciliationItems(itemsRes.data.data.items);
        }
      } else if (tab === 'providers') {
        const res = await api.get('/providers/health');
        setProviderStatuses(res.data.data.providers);
      } else if (tab === 'webhooks') {
        const res = await api.get('/webhooks/events');
        setWebhookEvents(res.data.data.events);
      } else if (tab === 'audit') {
        const res = await api.get('/audit-logs');
        setAuditLogs(res.data.data.auditLogs);
      }
    } catch (err) {
      console.error(`Error loading data for ${tab}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataForTab(activeTab);
  }, [activeTab]);

  // Terminal Handlers
  const handleCopyKey = () => {
    navigator.clipboard.writeText(idempotencyKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNewKey = () => {
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setLastResponse(null);

    try {
      const merchantId = localStorage.getItem('payguard_default_merchant');
      const amountPaise = Math.round(amountRupees * 100);

      const res = await api.post(
        '/payments',
        {
          merchantId,
          amountPaise,
          currency: 'INR',
          paymentMethod: method,
          providerName: provider,
          simulateOutcome: outcome,
          description: `Order Purchase via ${provider}`
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        }
      );

      setLastResponse({
        status: res.status,
        data: res.data
      });
      loadDataForTab('terminal');
    } catch (err: any) {
      setLastResponse({
        status: err.response?.status || 500,
        data: err.response?.data || { error: err.message }
      });
    } finally {
      setProcessing(false);
    }
  };

  // Create Order Handler
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const merchantId = localStorage.getItem('payguard_default_merchant');
      await api.post('/orders', {
        merchantId,
        amountPaise: Math.round(newOrderAmount * 100),
        currency: 'INR',
        customerEmail: newOrderEmail,
        customerName: 'PayGuard Customer',
        description: newOrderDesc
      });
      loadDataForTab('orders');
    } catch (err) {
      console.error('Order creation error:', err);
    }
  };

  // Refund Handler
  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundMessage(null);
    try {
      const res = await api.post('/refunds', {
        paymentId: refundPaymentId,
        amountPaise: Math.round(refundAmountRupees * 100),
        reason: refundReason
      });
      setRefundMessage(`✅ Refund of ₹${refundAmountRupees} processed successfully! New status: ${res.data.data.newPaymentStatus}`);
      loadDataForTab('ledger');
    } catch (err: any) {
      setRefundMessage(`❌ Refund failed: ${err.response?.data?.error?.message || err.message}`);
    }
  };

  // Trigger Reconciliation Run
  const handleTriggerReconciliation = async () => {
    try {
      setLoading(true);
      await api.post('/reconciliation/run-now', { providerName: 'MockPay' });
      await loadDataForTab('reconciliation');
    } catch (err) {
      console.error('Reconciliation run error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset Circuit Breaker
  const handleResetCircuitBreaker = async (pName: string) => {
    try {
      await api.post(`/providers/reset/${pName}`);
      loadDataForTab('providers');
    } catch (err) {
      console.error('Error resetting breaker:', err);
    }
  };

  // Review Fraud Assessment
  const handleReviewFraud = async (assessmentId: string, action: 'APPROVED_BY_ADMIN' | 'REJECTED_BY_ADMIN') => {
    try {
      await api.post(`/fraud/review/${assessmentId}`, {
        action,
        notes: `Decision applied via Admin Console`
      });
      loadDataForTab('fraud');
    } catch (err) {
      console.error('Fraud review error:', err);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 16px'
      }}>
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 24px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
            }}>
              <ShieldCheck size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>PAYGUARD</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Console v1.0</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('overview')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'overview' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'overview' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'overview' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <BarChart3 size={17} /> Overview & Analytics
            </button>

            <button
              onClick={() => setActiveTab('terminal')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'terminal' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'terminal' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'terminal' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <CreditCard size={17} /> Payment Terminal
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'orders' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'orders' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'orders' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <FileText size={17} /> Orders Subsystem
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'ledger' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'ledger' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'ledger' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <BookOpen size={17} /> Double-Entry Ledger
            </button>

            <button
              onClick={() => setActiveTab('fraud')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'fraud' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'fraud' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'fraud' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <ShieldAlert size={17} /> Fraud Detection
            </button>

            <button
              onClick={() => setActiveTab('reconciliation')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'reconciliation' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'reconciliation' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'reconciliation' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <RotateCcw size={17} /> Reconciliation Center
            </button>

            <button
              onClick={() => setActiveTab('providers')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'providers' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'providers' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'providers' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <Activity size={17} /> Provider Health
            </button>

            <button
              onClick={() => setActiveTab('webhooks')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'webhooks' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'webhooks' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'webhooks' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <Layers size={17} /> Webhooks & Outbox
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: activeTab === 'audit' ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: activeTab === 'audit' ? '#C4B5FD' : 'var(--text-secondary)',
                border: activeTab === 'audit' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent'
              }}
            >
              <HelpCircle size={17} /> Audit Logs
            </button>
          </nav>
        </div>

        {/* Bottom Role Switcher & Back Button */}
        <div>
          <div style={{
            background: 'var(--bg-card)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ACTIVE ROLE</span>
              <span className="badge badge-cyan">{userRole.toUpperCase()}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setUserRole('merchant')}
                className={`btn ${userRole === 'merchant' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '6px' }}
              >
                Merchant
              </button>
              <button
                type="button"
                onClick={() => setUserRole('admin')}
                className={`btn ${userRole === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '6px' }}
              >
                Admin
              </button>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={onBackToHome} style={{ width: '100%' }}>
            <ArrowLeft size={15} /> Exit Console
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxHeight: '100vh' }}>
        {/* Top Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, textTransform: 'capitalize' }}>
              {activeTab.replace('-', ' ')}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              PayGuard Financial Infrastructure Simulation
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => loadDataForTab(activeTab)}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </header>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && (
          <div>
            {/* KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              <div className="card">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Settled Volume</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{analytics ? (Number(analytics.kpis.total_captured_paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>Strict integer paise math</div>
              </div>

              <div className="card">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Transactions Processed</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--cyan-accent)' }}>
                  {analytics?.kpis.total_payments || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {analytics?.kpis.captured_count || 0} Captured / {analytics?.kpis.failed_count || 0} Failed
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Fraud Alerts</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--danger)' }}>
                  {analytics?.fraudSummary.total_alerts || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {analytics?.fraudSummary.pending_reviews || 0} pending review
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Refunds Processed</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--warning)' }}>
                  {analytics?.kpis.refund_count || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Zero over-refund violations</div>
              </div>
            </div>

            {/* Daily Trend Chart */}
            <div className="card glass-card" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Settlement Volume (Past 7 Days)</h3>
                <span className="badge badge-purple">LIVE DATABASE AGGREGATE</span>
              </div>
              <div style={{ height: '240px' }}>
                {analytics?.dailyTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.dailyTrend}>
                      <defs>
                        <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#64748B" fontSize={12} />
                      <YAxis stroke="#64748B" fontSize={12} tickFormatter={(v) => `₹${v/100}`} />
                      <Tooltip contentStyle={{ background: '#101629', borderColor: '#8B5CF6', color: '#F8FAFC' }} />
                      <Area type="monotone" dataKey="volume_paise" stroke="#8B5CF6" fillOpacity={1} fill="url(#volumeGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '100px', color: 'var(--text-muted)' }}>
                    Execute transactions in the Payment Terminal to generate live trend metrics!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENT TERMINAL & IDEMPOTENCY TESTER */}
        {activeTab === 'terminal' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '36px' }}>
              {/* Terminal Form */}
              <div className="card glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <CreditCard size={20} color="var(--primary-purple)" />
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Interactive Payment Terminal</h2>
                </div>

                <form onSubmit={handleExecutePayment}>
                  {/* Idempotency Key */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Idempotency-Key (Header)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={handleCopyKey} style={{ background: 'none', border: 'none', color: 'var(--cyan-accent)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button type="button" onClick={handleGenerateNewKey} style={{ background: 'none', border: 'none', color: 'var(--primary-purple)', cursor: 'pointer', fontSize: '12px' }}>
                          Regenerate
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={idempotencyKey}
                      onChange={(e) => setIdempotencyKey(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--cyan-accent)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px'
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      💡 Click "Process Payment" twice with the same key to verify exact-once idempotency deduplication!
                    </span>
                  </div>

                  {/* Amount */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Amount (INR ₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '15px',
                        fontWeight: 600
                      }}
                    />
                  </div>

                  {/* Provider & Method */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Simulated Provider
                      </label>
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <option value="MockPay">MockPay (Primary)</option>
                        <option value="FastPay">FastPay (High Speed)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Payment Method
                      </label>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <option value="card">Credit / Debit Card</option>
                        <option value="upi">UPI Instant</option>
                        <option value="netbanking">Net Banking</option>
                      </select>
                    </div>
                  </div>

                  {/* Outcome */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Simulated Gateway Outcome
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setOutcome('success')}
                        className={`btn ${outcome === 'success' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '8px' }}
                      >
                        Success
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutcome('failure')}
                        className={`btn ${outcome === 'failure' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '8px' }}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutcome('timeout')}
                        className={`btn ${outcome === 'timeout' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12px', padding: '8px' }}
                      >
                        Timeout
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processing}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                  >
                    {processing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Transacting...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Process Payment
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Response Inspector */}
              <div className="card glass-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Gateway Response Inspector</h2>
                  {lastResponse && (
                    <span className={`badge ${lastResponse.status === 201 || lastResponse.status === 200 ? 'badge-success' : 'badge-danger'}`}>
                      HTTP {lastResponse.status}
                    </span>
                  )}
                </div>

                <div style={{
                  background: '#04060E',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  height: '380px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#A5B4FC'
                }}>
                  {lastResponse ? (
                    <pre style={{ margin: 0 }}>{JSON.stringify(lastResponse.data, null, 2)}</pre>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', paddingTop: '140px', textAlign: 'center' }}>
                      Awaiting payment submission... <br />
                      Submit the form on the left to inspect the real-time server response.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payments Table */}
            <div className="card">
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Transaction Stream</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px' }}>Reference</th>
                      <th style={{ padding: '10px 14px' }}>Provider</th>
                      <th style={{ padding: '10px 14px' }}>Method</th>
                      <th style={{ padding: '10px 14px' }}>Amount</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
                          {p.payment_reference}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{p.provider_name}</td>
                        <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{p.payment_method}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          ₹{(Number(p.amount_paise) / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className={`badge ${p.status === 'CAPTURED' ? 'badge-success' : p.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {p.status === 'CAPTURED' && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              onClick={() => {
                                setRefundPaymentId(p.id);
                                setActiveTab('ledger');
                              }}
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '32px' }}>
              <div className="card glass-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Create Authorized Order</h3>
                <form onSubmit={handleCreateOrder}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Customer Email
                    </label>
                    <input
                      type="email"
                      value={newOrderEmail}
                      onChange={(e) => setNewOrderEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Amount (INR ₹)
                    </label>
                    <input
                      type="number"
                      value={newOrderAmount}
                      onChange={(e) => setNewOrderAmount(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Description
                    </label>
                    <input
                      type="text"
                      value={newOrderDesc}
                      onChange={(e) => setNewOrderDesc(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Create Order
                  </button>
                </form>
              </div>

              {/* Orders Table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Orders Subsystem</h3>
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadDataForTab('orders')}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px 12px' }}>Order Reference</th>
                        <th style={{ padding: '10px 12px' }}>Customer</th>
                        <th style={{ padding: '10px 12px' }}>Amount</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                        <th style={{ padding: '10px 12px' }}>Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
                            {o.order_reference}
                          </td>
                          <td style={{ padding: '10px 12px' }}>{o.customer_email}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            ₹{(Number(o.amount_paise) / 100).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className={`badge ${o.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                              {o.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>{o.payment_attempts_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DOUBLE-ENTRY LEDGER & REFUNDS */}
        {activeTab === 'ledger' && (
          <div>
            {/* Trial Balance Banner */}
            <div className="card glass-card" style={{ marginBottom: '28px', border: trialBalance?.isBalanced ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>DOUBLE-ENTRY TRIAL BALANCE CHECK</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: trialBalance?.isBalanced ? 'var(--success)' : 'var(--danger)', marginTop: '4px' }}>
                    {trialBalance?.isBalanced ? '✓ PERFECTLY BALANCED (Σ DEBITS = Σ CREDITS)' : '⚠️ DISCREPANCY DETECTED'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTAL DEBITS</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ₹{trialBalance ? (Number(trialBalance.totalDebitsPaise) / 100).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTAL CREDITS</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ₹{trialBalance ? (Number(trialBalance.totalCreditsPaise) / 100).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '32px' }}>
              {/* Process Refund Form */}
              <div className="card glass-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Execute Refund</h3>
                <form onSubmit={handleProcessRefund}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Payment ID (UUID)
                    </label>
                    <input
                      type="text"
                      placeholder="Paste captured payment ID..."
                      value={refundPaymentId}
                      onChange={(e) => setRefundPaymentId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--cyan-accent)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Refund Amount (INR ₹)
                    </label>
                    <input
                      type="number"
                      value={refundAmountRupees}
                      onChange={(e) => setRefundAmountRupees(Number(e.target.value))}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Reason
                    </label>
                    <input
                      type="text"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Process Refund
                  </button>

                  {refundMessage && (
                    <div style={{ fontSize: '12px', marginTop: '12px', color: refundMessage.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>
                      {refundMessage}
                    </div>
                  )}
                </form>
              </div>

              {/* Ledger Accounts Overview */}
              <div className="card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Chart of Accounts</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>Account Number</th>
                        <th style={{ padding: '8px 12px' }}>Type</th>
                        <th style={{ padding: '8px 12px' }}>Name</th>
                        <th style={{ padding: '8px 12px' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerAccounts.map((acc) => (
                        <tr key={acc.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
                            {acc.account_number}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className="badge badge-purple">{acc.account_type}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>{acc.account_name}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                            ₹{(Number(acc.balance_paise) / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Journal Entries Table */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Immutable Journal Entries</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px' }}>Account</th>
                      <th style={{ padding: '8px 12px' }}>Entry Type</th>
                      <th style={{ padding: '8px 12px' }}>Amount</th>
                      <th style={{ padding: '8px 12px' }}>Description</th>
                      <th style={{ padding: '8px 12px' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((e) => (
                      <tr key={e.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '8px 12px' }}>{e.account_name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`badge ${e.entry_type === 'DEBIT' ? 'badge-cyan' : 'badge-purple'}`}>
                            {e.entry_type}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          ₹{(Number(e.amount_paise) / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{e.description}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                          {new Date(e.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: FRAUD DETECTION */}
        {activeTab === 'fraud' && (
          <div>
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Rule-Based Risk Scoring Architecture</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
                Every payment request is dynamically scored by our rule engine: Velocity checks (+35), Anomaly volume thresholds (+40), Card failure spikes (+30). Risk score $\ge 75$ causes automatic decline; scores 25–74 trigger manual admin review holds.
              </p>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Evaluated Transactions</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 12px' }}>Payment Ref</th>
                      <th style={{ padding: '10px 12px' }}>Amount</th>
                      <th style={{ padding: '10px 12px' }}>Risk Score</th>
                      <th style={{ padding: '10px 12px' }}>Level</th>
                      <th style={{ padding: '10px 12px' }}>Triggered Rules</th>
                      <th style={{ padding: '10px 12px' }}>Decision</th>
                      <th style={{ padding: '10px 12px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraudAssessments.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
                          {a.payment_reference}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          ₹{(Number(a.amount_paise) / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{a.risk_score}/100</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${a.risk_level === 'CRITICAL' ? 'badge-danger' : a.risk_level === 'HIGH' ? 'badge-warning' : 'badge-success'}`}>
                            {a.risk_level}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {a.triggered_rules?.length > 0 ? (
                            a.triggered_rules.map((r: any, idx: number) => <div key={idx}>• {r.description}</div>)
                          ) : (
                            <span style={{ color: 'var(--success)' }}>Clean pattern</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className="badge badge-purple">{a.review_status}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {a.review_status === 'PENDING_REVIEW' && userRole === 'admin' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                onClick={() => handleReviewFraud(a.id, 'APPROVED_BY_ADMIN')}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--danger)' }}
                                onClick={() => handleReviewFraud(a.id, 'REJECTED_BY_ADMIN')}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: RECONCILIATION */}
        {activeTab === 'reconciliation' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Settlement Reconciliation Engine</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                  Audits internal payment ledger rows against provider settlement records to detect status drift and amount tampering.
                </p>
              </div>
              <button className="btn btn-primary" onClick={handleTriggerReconciliation} disabled={loading}>
                <RotateCcw size={15} /> Run Reconciliation Job
              </button>
            </div>

            {/* Reconciliation Runs */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Reconciliation Runs History</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px' }}>Run Date</th>
                      <th style={{ padding: '8px 12px' }}>Provider</th>
                      <th style={{ padding: '8px 12px' }}>Total Records</th>
                      <th style={{ padding: '8px 12px' }}>Matched</th>
                      <th style={{ padding: '8px 12px' }}>Mismatched</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationRuns.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '8px 12px' }}>{new Date(r.created_at).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px' }}>{r.provider_name}</td>
                        <td style={{ padding: '8px 12px' }}>{r.total_records}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--success)' }}>{r.matched_records}</td>
                        <td style={{ padding: '8px 12px', color: r.mismatched_records > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {r.mismatched_records}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className="badge badge-success">{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discrepancy Items */}
            {reconciliationItems.length > 0 && (
              <div className="card glass-card">
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Audit Items Breakdown</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>Payment Ref</th>
                        <th style={{ padding: '8px 12px' }}>Internal Amount</th>
                        <th style={{ padding: '8px 12px' }}>Provider Amount</th>
                        <th style={{ padding: '8px 12px' }}>Discrepancy</th>
                        <th style={{ padding: '8px 12px' }}>Resolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationItems.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
                            {item.payment_reference}
                          </td>
                          <td style={{ padding: '8px 12px' }}>₹{(Number(item.internal_amount_paise) / 100).toFixed(2)}</td>
                          <td style={{ padding: '8px 12px' }}>₹{(Number(item.provider_amount_paise) / 100).toFixed(2)}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className={`badge ${item.discrepancy_type === 'NONE' ? 'badge-success' : 'badge-danger'}`}>
                              {item.discrepancy_type}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span className="badge badge-purple">{item.resolution_status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: PROVIDER HEALTH & CIRCUIT BREAKER */}
        {activeTab === 'providers' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {providerStatuses.map((p) => (
                <div key={p.providerName} className="card glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{p.providerName}</h3>
                    <span className={`badge ${p.circuitState === 'CLOSED' ? 'badge-success' : p.circuitState === 'HALF_OPEN' ? 'badge-warning' : 'badge-danger'}`}>
                      CIRCUIT {p.circuitState}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
                    <div>Consecutive Failures: <strong>{p.details?.consecutive_failures || 0}</strong></div>
                    <div>Cooling Period: <strong>15,000 ms</strong></div>
                    <div>Threshold: <strong>3 Consecutive Failures $\rightarrow$ OPEN</strong></div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleResetCircuitBreaker(p.providerName)}
                    style={{ width: '100%' }}
                  >
                    Reset Circuit to CLOSED
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: WEBHOOKS & OUTBOX */}
        {activeTab === 'webhooks' && (
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Transactional Outbox Webhook Stream</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px' }}>Event Type</th>
                    <th style={{ padding: '10px 12px' }}>Merchant</th>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Payload Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookEvents.map((w) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span className="badge badge-purple">{w.event_type}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{w.business_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {new Date(w.created_at).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan-accent)' }}>
                        {JSON.stringify(w.payload).slice(0, 75)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>System Audit Trail</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px' }}>Action</th>
                    <th style={{ padding: '10px 12px' }}>User</th>
                    <th style={{ padding: '10px 12px' }}>Entity</th>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{log.action}</td>
                      <td style={{ padding: '10px 12px' }}>{log.user_email || 'System'}</td>
                      <td style={{ padding: '10px 12px' }}>{log.entity_type} ({log.entity_id?.slice(0, 8)})</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
