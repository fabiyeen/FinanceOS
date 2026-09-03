# FinanceOS v2

> **Next-generation, offline-first personal financial operating system and Progressive Web App (PWA) engineered with double-entry ledger mechanics, a Neo-Tokyo industrial minimalist aesthetic, and deep financial telemetry.**

---

[![Next.js 16](https://img.shields.io/badge/Framework-Next.js%2016%20(App%20Router)-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/UI-React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/Language-TypeScript%20Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Dexie & Serwist](https://img.shields.io/badge/Offline%20Engine-Dexie%20%7C%20IndexedDB%20%7C%20Serwist-00F0FF?style=for-the-badge&logo=pwa&logoColor=black)](https://dexie.org/)
[![Firebase Suite](https://img.shields.io/badge/Cloud%20Backend-Firebase%20Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Security](https://img.shields.io/badge/Security-WebAuthn%20%7C%20SHA--256%20PIN-00FF88?style=for-the-badge&logo=shield&logoColor=black)](#hardware--session-security)

---

## 1. Architectural Overview & System Design

FinanceOS v2 is engineered around a **local-first, zero-knowledge multi-tenant persistence architecture**. All ledger mutations operate with sub-millisecond local latency on client device hardware and synchronize asynchronously to the cloud.

```
                                  +-------------------------------------------------------------+
                                  |                 USER INTERACTION SURFACE                    |
                                  |  - Universal Command Bar (NLP Parser: Cmd+K)                |
                                  |  - Dynamic Tokyo-Slate Dashboard & Telemetry Visualizers    |
                                  |  - Web Audio Tactile Synthesizer & Hardware Haptics         |
                                  +------------------------------+------------------------------+
                                                                 |
                                                                 v
+-------------------------------------------------------------------------------------------------------------------------------+
|                                                PURE FINANCIAL ARITHMETIC LAYER                                                |
|                                                     (src/lib/mathEngine.ts)                                                   |
|  * Minor-Unit Integer Scaling (Minor Scale Factor: 100) -> Elimination of IEEE 754 Floating Point Drift                      |
|  * Atomic State Machine Transitions (Expense | Income | Transfer | Vault In/Out | Debt Settle)                                  |
|  * Telemetry Metrics: Net Worth, Debt-to-Asset Ratio, Trailing 3M Runway, Linear Spend Velocity                               |
+---------------------------------------------------------------+---------------------------------------------------------------+
                                                                |
                                                                v
+-------------------------------------------------------------------------------------------------------------------------------+
|                                            L1 STORAGE: CLIENT LOCAL PERSISTENCE                                               |
|                                                      (src/lib/db/dexie.ts)                                                    |
|  * Physical Tenant Isolation: Dynamically partitioned IndexedDB instances: `FinanceOS_v2_${userId}`                           |
|  * Dynamic Proxy Layer: In-memory routing preserving reactive query integrity across operative switches                       |
|  * Offline Mutation Queue (`syncQueue`): Persists uncommitted writes during network loss with retry backoff                  |
+---------------------------------------------------------------+---------------------------------------------------------------+
                                                                |
                                             Async Sync Worker  |  Bi-directional
                                             Drain Pipeline     v  Hydration
+-------------------------------------------------------------------------------------------------------------------------------+
|                                            L2 STORAGE: REMOTE CLOUD BACKEND                                                   |
|                                                  (Google Cloud Firestore)                                                     |
|  * Multi-Tenant Partitioning: Strictly isolated under `users/{userId}/*`                                                      |
|  * Collections: /settings, /accounts, /transactions, /debts, /recurring, /vaults, /syncQueue                                  |
|  * Granular Security Rule Guardrails: Request UID matching `request.auth.uid == userId`                                       |
+---------------------------------------------------------------+---------------------------------------------------------------+
                                                                ^
                                                                | Bearer Key
                                                                | Authentication
                                  +-----------------------------+-------------------------------+
                                  |                 COMPANION REST API PIPELINE                 |
                                  |                     (src/app/api/v1/*)                      |
                                  |  - GET  /api/v1/summary      -> Aggregated Financial State  |
                                  |  - GET  /api/v1/accounts     -> Accounts & Available Limits |
                                  |  - POST /api/v1/transactions -> iOS Shortcut / Script Ingest|
                                  +-------------------------------------------------------------+
```

### Dual-Layer Storage Strategy
1. **L1 Local Cache (Dexie.js / IndexedDB)**:
   - Each logged-in operative is bound to a dedicated database partition: `FinanceOS_v2_${userId}`.
   - When switching or logging out operatives, the database connection closes atomically and memory state is cleared, preventing any cross-user data leakage on shared machines.
2. **L2 Cloud Source of Truth (Cloud Firestore)**:
   - Firestore documents live inside isolated user hierarchies: `users/{userId}/{collectionName}/{documentId}`.
   - Offline mutation items are queued in `syncQueue` and drained automatically upon network reconnection with optimistic UI resolution.

---

## 2. Core Engine & Financial Mechanics

### Integer-Scaled Math Engine (`src/lib/mathEngine.ts`)
To eliminate the IEEE 754 floating-point drift common in financial software (e.g. `0.1 + 0.2 = 0.30000000000000004`), FinanceOS v2 processes all balances, amounts, and debt settlements using minor-currency integer scaling:

$$\text{Minor Value} = \text{round}(\text{Amount} \times 100)$$

$$\text{Major Value} = \frac{\text{Minor Value}}{100}$$

#### Atomic State Transitions
- **Expense**: Debits source account, updates category pacing.
- **Income**: Credits destination account, increments period inflow.
- **Transfer**: Zero-sum atomic transition debiting source account and crediting destination account simultaneously.
- **Vault Deposit / Withdraw**: Safely moves capital between funding accounts and goal-specific sinking vaults with automatic target attainment calculation.
- **Debt Payment**: Direct settlement towards active liabilities, reducing outstanding debt and logging chronological repayment history.

### Deep Financial Telemetry
- **Live Net Worth Ticker**: Dynamic aggregation:
  $$\text{Net Worth} = \sum \text{Liquid Assets} + \sum \text{Vault Reserves} - \sum \text{Active Liabilities}$$
- **Debt-to-Asset Gearing Ratio**: Real-time solvency index:
  $$\text{Gearing} = \frac{\sum \text{Debts}}{\sum \text{Assets} + \sum \text{Vaults}} \times 100$$
- **Linear Spend Velocity vs. Burn Rate**: Evaluates current monthly spend trajectory against the month's linear day-by-day ideal cap.
- **Runway Horizon**: Calculates survival duration in days based on trailing 90-day average daily burn rate.
- **Matrix Visualizers**:
  - **12-Week Spend Heatmap**: GitHub-style activity grid plotting transaction volume and expense density.
  - **Sankey Distribution Diagram**: Visualizes multi-stage cash flow from income streams down through accounts and expense categories.
  - **Cashflow Horizon**: 30-day forward projection curve computing projected liquidity and recurring deduction milestones.

---

## 3. Key Feature Modules

| Module | Architectural Implementation | Key Capabilities |
| :--- | :--- | :--- |
| **Universal Command Bar** | `src/components/command/UniversalCmdBar.tsx`<br>`src/lib/nlpParser.ts` | Global `Cmd+K` / `Ctrl+K` command interface with real-time NLP parsing description, amount, category keyword matching, and source account routing. |
| **Multi-Account & Credit Headroom** | `src/components/ledger/AccountCard.tsx`<br>`src/components/ledger/AccountDrawer.tsx` | Tracking for Checking, Savings, Cash, E-Wallet, and Credit Card accounts. Computes credit limit headroom, debt ratios, statement closing cycle alerts, and balance adjustments. |
| **Capital Sinking Vaults** | `src/components/ledger/VaultCard.tsx` | Target-driven goal reserves with target date pacing, progress rings, emergency lock protection, and direct deposit/withdrawal modal wizards. |
| **IOU & Debt Ledger** | `src/components/ledger/DebtTracker.tsx` | Counterparty tracking for both receivables ("Owed to Me") and payables ("I Owe"). Supports partial settlements, due-date tracking, and repayment logs. |
| **Bi-Directional CSV Pipeline** | `src/components/csv/CsvImportWizard.tsx`<br>`src/lib/csvEngine.ts` | Auto-detects delimiters (`,`, `;`, `\t`), interactive drag-and-drop column mapping, duplicate hash detection (`date_amount_desc_fromAccount`), and filterable double-entry CSV export. |
| **Hardware & Session Security** | `src/components/security/PinLockScreen.tsx`<br>`src/lib/security.ts` | Salted Web Crypto SHA-256 PIN hashing, 3-attempt 30-second lockout cooldown, WebAuthn biometric passkey integration, and Gaussian blur Privacy Blinder (`Ctrl+H`). |
| **Nuclear Factory Reset** | `src/components/modals/FactoryResetModal.tsx`<br>`src/lib/db/resetEngine.ts` | Destructive wipe pipeline requiring dual confirmation (`PURGE-ALL` + Master PIN). Flushes all transactions, vaults, and debts from IndexedDB & Firestore while preserving auth identity and master PIN. |
| **Companion REST API** | `src/app/api/v1/*` | Headless REST endpoints secured by Bearer API Key tokens for programmatic ingest from iOS Shortcuts, microservices, or custom scripts. |

---

## 4. Hardware Security & Session Lock Protocol

```
                                  [ USER SESSION MONITOR ]
                                             |
                  +--------------------------+--------------------------+
                  |                                                     |
         (Inactivity Timeout)                                   (Manual Ctrl+L)
                  |                                                     |
                  +-------------------------->+<------------------------+
                                              |
                                              v
                                   [ PIN LOCK SCREEN ENGAGED ]
                                              |
                     +------------------------+------------------------+
                     |                                                 |
             [ Numeric Keypad ]                                [ Biometric Passkey ]
                     |                                                 |
                     v                                                 v
         (Salted SHA-256 Digest)                              (WebAuthn Assertion)
                     |                                                 |
         +-----------+-----------+                                     |
         |                       |                                     |
    [ Valid PIN ]         [ Invalid PIN ]                              |
         |                       |                                     |
         v                       v                                     v
   (Unlock & Log)        (Attempt Counter ++)                     [ Session ]
                                 |                                [ Resumed ]
                       +---------+---------+
                       |                   |
                  (< 3 Fails)         (>= 3 Fails)
                       |                   |
                       v                   v
                 (Display Error)   [ 30-SEC LOCKOUT ]
                                           |
                                 +---------+---------+
                                 |                   |
                           (Wait Timer)    [ "Forgot PIN?" ]
                                                     |
                                                     v
                                          (Account Password Re-Auth)
```

1. **Cryptographic Hashing**: Master PINs are salted with a 16-byte cryptographically secure random salt and digested via native browser Web Crypto (`crypto.subtle.digest("SHA-256", ...)`). Plaintext PINs are never persisted.
2. **Default PIN Fallback**: First-time accounts default to fallback PIN `0000` (`isPinSet: false`) with a persistent top banner prompting custom PIN initialization.
3. **Emergency Account Recovery**: If an operative forgets their PIN, the session can be unlocked by verifying the primary account password against Firebase Auth.

---

## 5. Technology Stack & Dependencies

| Layer | Technologies |
| :--- | :--- |
| **Framework & Runtime** | Next.js 16 (App Router, Turbopack), React 19, TypeScript Strict Mode, Node.js 20+ |
| **Local Persistence & PWA** | Dexie.js (IndexedDB wrapper), `dexie-react-hooks`, Serwist PWA Service Worker |
| **State Management** | Zustand (persistent ephemeral UI settings), TanStack Query v5 |
| **Styling & Aesthetics** | Tailwind CSS v4, Lucide React icons, Web Audio API (mechanical feedback synthesizer) |
| **Data Visualization** | Recharts v3 (ResponsiveContainer, AreaChart, BarChart, Treemap, Sankey) |
| **Cloud Backend & Auth** | Google Cloud Firestore (Client SDK v12, Admin SDK v14), Firebase Authentication |
| **Validation & Utilities** | Zod (runtime API validation), PapaParse (CSV streaming parser) |

---

## 6. Local Setup & Environment Configuration

### Prerequisites
- Node.js `20.0.0` or higher
- npm `10.0.0` or higher (or pnpm / yarn)
- Git

### Installation
```bash
# 1. Clone repository
git clone https://github.com/fabiyeen/FinanceOS.git
cd FinanceOS

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

### Environment Variables Template (`.env.local`)
Create a `.env.local` file in the root directory:

```ini
# ==============================================================================
# FINANCEOS v2: CLIENT ENVIRONMENT CONFIGURATION (PUBLIC)
# ==============================================================================

# Firebase Web Client SDK Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyYourFirebaseWebApiKeyHere"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app-id.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abcdef123456789"

# ==============================================================================
# SERVER & COMPANION REST API CONFIGURATION (PRIVATE)
# ==============================================================================

# Companion REST API Bearer Token Authentication
# Used to authenticate headless POST /api/v1/transactions, GET /api/v1/summary
EXTERNAL_API_SECRET_KEY="fos_sec_your_custom_hex_token_here"

# Firebase Admin SDK (For Companion Server-Side Mutations)
FIREBASE_ADMIN_PROJECT_ID="your-app-id"
FIREBASE_ADMIN_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-app-id.iam.gserviceaccount.com"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

> **Note on Local/Offline Fallback**: If `NEXT_PUBLIC_FIREBASE_*` variables are omitted, FinanceOS v2 automatically operates in **Standalone Offline Mode** using local IndexedDB partitions and simulated operative profiles (`Operative Alpha` and `Operative Beta`).

### Running the Application
```bash
# Run in development mode with Turbopack
npm run dev

# Compile optimized production bundle
npm run build

# Launch production server
npm run start
```

---

## 7. Cloud Firestore Security Rules

To ensure strict zero-leakage multi-tenancy in production, deploy the following security rules to Google Cloud Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Ensure all data reads and writes are physically restricted to the authenticated user
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Default deny rule for all unauthenticated or unmatched access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 8. Companion REST API Specification

FinanceOS v2 includes companion endpoints designed for automated logging (e.g. iOS Shortcuts, Siri, n8n, Zapier).

### Authorization
All requests must include the header:
```http
Authorization: Bearer <EXTERNAL_API_SECRET_KEY>
Content-Type: application/json
```

### Endpoints

#### 1. Ingest Transaction
```http
POST /api/v1/transactions
```
```json
{
  "desc": "Cyber Cafe Espresso",
  "amount": 45000,
  "type": "expense",
  "categoryId": "cat_food",
  "fromAccountId": "acc_bca",
  "notes": "Logged via iOS Shortcut"
}
```
*Response (`201 Created`)*:
```json
{
  "success": true,
  "transaction": {
    "id": "tx_1788410928000_a8f2c",
    "desc": "Cyber Cafe Espresso",
    "amount": 45000,
    "type": "expense",
    "categoryId": "cat_food",
    "fromAccountId": "acc_bca",
    "createdAt": "2026-09-03T06:00:00.000Z"
  }
}
```

#### 2. Get Ledger Summary
```http
GET /api/v1/summary
```
*Response (`200 OK`)*:
```json
{
  "netWorth": 124500000,
  "currency": "IDR",
  "monthlyBudget": 18000000,
  "burnRate": 480000,
  "runwayDays": 259
}
```

#### 3. List Accounts
```http
GET /api/v1/accounts
```

---

## 9. Verification & Test Suite

FinanceOS v2 contains a native unit test suite executing across arithmetic scaling, cryptographic security, and factory reset integrity:

```bash
# Execute entire test suite
npx tsx --test src/lib/mathEngine.test.ts src/lib/security.test.ts src/lib/db/resetEngine.test.ts
```

### Test Coverage Checklist
- [x] **Arithmetic Stability**: Floating-point drift prevention (`0.1 + 0.2`).
- [x] **Atomic Ledger Transfers**: Zero-sum double entry credit/debit enforcement.
- [x] **Sinking Vault Logic**: Account deduction, goal accumulation, threshold detection.
- [x] **Debt Tracking**: Solvency tracking, partial repayments, liability settling.
- [x] **Cryptographic Salting**: 16-byte salt verification and constant-time PIN comparison.
- [x] **Rate-Limiter Lockout**: 3-attempt failure handling and lockout cooldown.
- [x] **Nuclear Reset Safety**: Flushes ledger while preserving user auth and customized PIN.
- [x] **TypeScript Strict**: Zero compilation errors across Next.js 16 Turbopack pipeline.

---

## 10. License & Intellectual Property

Engineered by **Fabiyeen**. Distributed under the **MIT License**. See `LICENSE` for details.
