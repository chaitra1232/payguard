# 🛡️ PAYGUARD — Intelligent Idempotent Payment Gateway

> **"Secure Every Transaction. Trust Every Payment."**  
> *Distributed Transaction Safety, Idempotency, Double-Entry Accounting, Fraud Detection & Reconciliation.*

PayGuard is an enterprise-inspired payment gateway simulation designed to solve the hardest challenges in digital payment systems: race conditions, double-charging, network retries, ledger drift, and provider downtime.

---

## ⚡ Core Engineering Highlights

1. **Deterministic Idempotency Engine:**
   - Every transaction enforces a client-provided `Idempotency-Key`.
   - Generates a `SHA-256` hash of the payload and reserves the key atomically in PostgreSQL.
   - Exact duplicate requests return identical cached responses (`HTTP 201/200`).
   - Tampered requests using an existing key with altered parameters are rejected with `HTTP 409 Conflict`.
2. **Concurrency Safety (100 Simultaneous Requests Test):**
   - Employs PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) and `ON CONFLICT DO NOTHING`.
   - **Verified Test:** 100 simultaneous concurrent requests with the identical key produce **EXACTLY ONE** physical transaction record in the database.
3. **Double-Entry Financial Ledger:**
   - Strict 64-bit integer (`BIGINT`) storage in **paise** ($₹1.00 = 100$ paise) with **zero floating-point math**.
   - Every captured transaction creates balancing **Debit** (Gateway Clearing) and **Credit** (Merchant Settlement) entries.
   - Continuous trial balance integrity check ($\sum \text{Debits} - \sum \text{Credits} = 0$).
4. **Provider Resiliency & Circuit Breaker:**
   - Simulated adapters for **MockPay** and **FastPay**.
   - Circuit Breaker states: `CLOSED`, `OPEN`, `HALF_OPEN`.
   - High consecutive provider failure rates trip the circuit to `OPEN`, failing fast to preserve connection pools.
5. **Rule-Based Fraud Scoring Engine:**
   - Evaluates velocity spikes, anomalous volume thresholds (> ₹1,00,000), and card decline rates.
   - Scores 0–100 with explainable triggered rule breakdown and manual review holds.
6. **Settlement Reconciliation Engine:**
   - Reconciles internal transactions against upstream mock bank settlement logs.
   - Detects amount tampering, status drift, and missing records with audit resolution workflows.
7. **Transactional Outbox Pattern for Webhooks:**
   - Atomic database writes guarantee at-least-once webhook event delivery.

---

## 🏗️ System Architecture

```text
[ React 18 + Vite (Dark Fintech UI) ]
                │  HTTP /api (JSON + Idempotency-Key)
                ▼
[ Express + TypeScript API Gateway ]
  ├─ Helmet & CORS & Rate Limiter
  ├─ Idempotency Engine (SHA-256 + FOR UPDATE)
  ├─ Rule-Based Fraud Risk Evaluator
  ├─ Circuit Breaker & Provider Adapters (MockPay / FastPay)
  ├─ Double-Entry Ledger (Debit = Credit in Paise)
  └─ Transactional Outbox Webhook Dispatcher
                │
                ▼
[ PostgreSQL 16 (18 Relational Tables + ACID Transactions) ]
```

---

## 🚀 Quickstart: How to Run PayGuard

### Prerequisites
* **Node.js**: v18+ (verified on v26)
* **PostgreSQL**: v14+ (verified on PostgreSQL 16 on port 5432)

---

### Step 1: Start the Backend Server

1. Open PowerShell and navigate to the backend:
   ```powershell
   cd C:\Users\chait\.gemini\antigravity\scratch\payguard\backend
   ```
2. Start the development server:
   ```powershell
   npm run dev
   ```
3. The server starts at **`http://localhost:5000`**.  
   Health check: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### Step 2: Start the Frontend Application

1. Open a second PowerShell window:
   ```powershell
   cd C:\Users\chait\.gemini\antigravity\scratch\payguard\frontend
   ```
2. Start the Vite dev server:
   ```powershell
   npm run dev
   ```
3. Open your browser at **`http://localhost:5173`**.

---

## 🧪 Running the Automated Test Suite

PayGuard includes comprehensive automated tests covering authentication, idempotency, ledger balances, and high-concurrency bursts:

In `payguard/backend`:

```powershell
# Run all tests
npm test

# Run the 100-request concurrency stress test
npx jest src/tests/concurrency.test.ts

# Run idempotency tests
npx jest src/tests/idempotency.test.ts

# Run ledger & refund balance verification
npx jest src/tests/ledger-and-refunds.test.ts
```

### Verified Test Results
```text
PASS src/tests/concurrency.test.ts
  √ Sends 100 concurrent requests with the SAME Idempotency-Key and creates EXACTLY ONE payment (1202 ms)

PASS src/tests/idempotency.test.ts
  √ 1. Rejects payment without Idempotency-Key header (21 ms)
  √ 2. Processes initial payment with new Idempotency-Key (88 ms)
  √ 3. Returns identical cached response when same key and same payload are submitted (66 ms)
  √ 4. Rejects with 409 Conflict when same key is used with a different payload (54 ms)

PASS src/tests/ledger-and-refunds.test.ts
  √ 1. Confirms double-entry ledger debit equals credit (23 ms)
  √ 2. Processes partial refund successfully (17 ms)
  √ 3. Rejects refund exceeding remaining balance with HTTP 400 (19 ms)

PASS src/tests/auth.test.ts
  √ 1. Should register a new user successfully (189 ms)
  √ 2. Should reject duplicate email registration with 409 Conflict (36 ms)
  √ 3. Should login successfully with correct credentials (121 ms)
  √ 4. Should reject login with invalid password with 401 Unauthorized (109 ms)
  √ 5. Should reject unauthenticated requests to protected routes (22 ms)

Test Suites: 4 passed, 4 total
Tests:       13 passed, 13 total
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Service & database connectivity check |
| `/api/auth/register` | `POST` | User registration (Customer/Merchant/Admin) |
| `/api/auth/login` | `POST` | JWT Authentication |
| `/api/auth/me` | `GET` | Current authenticated user profile |
| `/api/merchants` | `POST` | Register merchant profile & settlement account |
| `/api/orders` | `POST` / `GET` | Create and list authorized orders |
| `/api/payments` | `POST` | Process payment with `Idempotency-Key` header |
| `/api/payments/:id` | `GET` | Transaction status & provider attempt history |
| `/api/refunds` | `POST` / `GET` | Full & partial refunds (balance checked) |
| `/api/ledger/entries` | `GET` | Immutable journal entries & trial balance |
| `/api/fraud/assessments` | `GET` | Rule-based risk assessments & scores |
| `/api/fraud/review/:id` | `POST` | Admin review approve/decline |
| `/api/reconciliation/run-now`| `POST` | Run reconciliation job |
| `/api/reconciliation/runs` | `GET` | View reconciliation discrepancies |
| `/api/providers/health` | `GET` | Circuit breaker status (`CLOSED`, `OPEN`, `HALF_OPEN`) |
| `/api/webhooks/events` | `GET` | Outbox event log |
| `/api/analytics/overview` | `GET` | Aggregate KPIs & 7-day settlement volume |

---

## 🎓 Computer Science Portfolio Value
This project demonstrates:
1. **Pessimistic Concurrency Control:** Deep understanding of database isolation levels, deadlocks, and connection pooling.
2. **Financial Precision:** Correct integer representation of currency (`paise`) avoiding binary floating point rounding errors.
3. **Double-Entry Bookkeeping:** Industrial ledger balancing ensuring total assets match liabilities.
4. **Resiliency Engineering:** Circuit breakers preventing cascading system failures under third-party downtime.
5. **System Design & Clean Code:** Modular TypeScript architecture separating controllers, services, database connection pools, and design token styling.
