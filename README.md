# Prediction Market Platform

A full-stack prediction market application built with Next.js 15, PostgreSQL, and Supabase Auth. The platform enables users to create, trade, and settle prediction markets using the Logarithmic Market Scoring Rule (LMSR) automated market maker.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Frontend Structure](#frontend-structure)
- [Backend Structure](#backend-structure)
- [Database Schema](#database-schema)
- [Trading Mechanics](#trading-mechanics)
- [Market Types](#market-types)
- [Settlement System](#settlement-system)
- [Ledger System](#ledger-system)
- [Authentication](#authentication)
- [Key Features](#key-features)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)

---

## Overview

This prediction market platform allows users to:

- **Create markets** - Both public and private prediction markets with customizable liquidity
- **Trade shares** - Buy and sell YES/NO shares using the LMSR pricing mechanism
- **Settle markets** - Decentralized settlement with bond-based dispute resolution
- **Track P&L** - Comprehensive profit/loss tracking with cost basis calculations
- **Manage groups** - Create private groups for exclusive market access

The platform uses a **double-entry ledger system** for all financial transactions, ensuring complete auditability and balance reconciliation.

---

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 15)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Pages   │  │Components│  │  Hooks   │  │  Server Actions  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (PostgreSQL)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Functions  │  │   Triggers   │  │   Ledger System      │   │
│  │  (PL/pgSQL)  │  │  (Auto-sync) │  │  (Double-entry)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Supabase Auth│  │  AWS RDS     │  │  UMA Oracle (future) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **UI Components**: shadcn/ui, Radix UI primitives
- **Backend**: PostgreSQL with PL/pgSQL stored procedures
- **Authentication**: Supabase Auth
- **Database**: AWS RDS PostgreSQL (or Supabase PostgreSQL)
- **State Management**: React Server Components + SWR for client state
- **Charts**: Recharts

---

## Frontend Structure

### `/app` - Application Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage with featured markets and activity feed |
| `/markets` | Browse all public markets |
| `/market/[id]` | Individual market detail page with trading interface |
| `/create-market` | Create new public or private markets |
| `/my-bets` | User's active positions, P&L tracking, settlement history |
| `/private-bets` | Private markets the user has access to |
| `/wallet` | Deposit/withdraw funds, view transaction history |
| `/profile` | User profile management |
| `/admin` | Admin dashboard for platform management |
| `/auth/*` | Authentication pages (login, sign-up, etc.) |

### `/app/actions` - Server Actions

| File | Purpose |
|------|---------|
| `trade.ts` | Execute buy/sell trades via `executeTradeV2`, `sellSharesV2` |
| `markets.ts` | Create markets, fetch market data |
| `oracle-settlement.ts` | Private market settlement (propose, contest, vote) |
| `uma-settlement.ts` | Public market settlement via UMA oracle |
| `wallet.ts` | Deposit/withdraw funds |
| `admin.ts` | Admin functions, audits, market management |
| `groups.ts` | Group creation and management |
| `notifications.ts` | Notification management |

### `/components` - React Components

| Component | Purpose |
|-----------|---------|
| `market-card.tsx` | Market preview card with price, volume, status |
| `market-price-chart.tsx` | Price history visualization |
| `blockchain-status.tsx` | Settlement proposal button and status |
| `sell-shares-dialog.tsx` | Dialog for selling positions |
| `propose-outcome-dialog.tsx` | Dialog for proposing settlement |
| `contest-outcome-dialog.tsx` | Dialog for contesting settlements |
| `vote-outcome-dialog.tsx` | Dialog for voting on contested settlements |
| `notifications.tsx` | Notification bell and dropdown |
| `mobile-bottom-nav.tsx` | Mobile navigation bar |

### `/lib` - Shared Libraries

| File | Purpose |
|------|---------|
| `lmsr.ts` | LMSR pricing calculations |
| `fees.ts` | Fee calculation (1% on trades) |
| `market-status.ts` | Market status utilities |
| `database/adapter.ts` | Database abstraction layer |
| `database/ledger.ts` | Ledger query utilities |
| `database/rds.ts` | Direct RDS connection |
| `supabase/*.ts` | Supabase client configurations |

---

## Backend Structure

### Database Functions (PL/pgSQL)

All core business logic is implemented as PostgreSQL stored procedures for atomicity and performance.

#### Trading Functions

| Function | Purpose |
|----------|---------|
| `execute_trade_lmsr_v2(market_id, user_id, bet_amount, bet_side, expected_price)` | Execute a buy trade with 2% slippage protection |
| `sell_shares_lmsr_v2(market_id, user_id, shares_to_sell, bet_side, expected_price)` | Execute a sell trade with 2% slippage protection |

#### Settlement Functions

| Function | Purpose |
|----------|---------|
| `initiate_settlement_v2(creator_id, market_id, outcome)` | Propose settlement outcome (private markets) |
| `contest_settlement_v2(market_id, contestant_id, contested_outcome)` | Contest a proposed settlement |
| `submit_vote_v2(contest_id, voter_id, vote_outcome)` | Vote on contested settlement |
| `force_settle_pending_settlements()` | Auto-settle markets after deadline |

#### Ledger Functions

| Function | Purpose |
|----------|---------|
| `create_ledger_entry(...)` | Create double-entry ledger records |
| `get_or_create_account(entity_id, account_type)` | Get or create ledger account |
| `check_all_balance_reconciliation()` | Audit all user balances vs ledger |

### Triggers

| Trigger | Purpose |
|---------|---------|
| `sync_profile_balance_from_ledger` | Sync `profiles.balance` when ledger changes |
| `update_twap_on_trade` | Update TWAP probability after each trade |
| `update_creator_fees_from_ledger` | Track creator fees earned |

---

## Database Schema

### Core Tables

#### `profiles`
User accounts with balance and profile information.
\`\`\`sql
- id (uuid, FK to auth.users)
- username (text, unique)
- display_name (text)
- balance (numeric) -- Synced from ledger
- avatar_url (text)
- created_at (timestamp)
\`\`\`

#### `markets`
Prediction markets with LMSR parameters.
\`\`\`sql
- id (uuid, PK)
- title (text)
- description (text)
- category (text)
- end_date (timestamp)
- creator_id (uuid, FK to profiles)
- is_private (boolean)
- status (text) -- 'active', 'expired', 'settled', 'cancelled', 'suspended', 'contested'
- qy (numeric) -- YES share quantity (LMSR state)
- qn (numeric) -- NO share quantity (LMSR state)
- b (numeric) -- LMSR liquidity parameter
- liquidity_pool (numeric) -- Current liquidity
- total_volume (numeric)
- outcome (boolean) -- null until settled
- outcome_text (text) -- 'yes', 'no', 'cancel'
- winning_side (boolean)
- settled_at (timestamp)
- group_id (uuid, FK to groups)
\`\`\`

#### `positions`
User positions in markets.
\`\`\`sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- market_id (uuid, FK to markets)
- side (boolean) -- true = YES, false = NO
- shares (numeric)
- cost_basis (numeric) -- Total amount invested
- avg_price (numeric) -- Average price per share
- created_at (timestamp)
- updated_at (timestamp)
\`\`\`

#### `closed_positions`
Historical record of settled/sold positions for P&L calculation.
\`\`\`sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- market_id (uuid, FK to markets)
- side (boolean)
- shares (numeric)
- cost_basis (numeric)
- pnl (numeric) -- Profit/loss
- outcome (text) -- 'won', 'lost', 'sold', 'cancelled'
- closed_at (timestamp)
\`\`\`

### Ledger Tables

#### `ledger_accounts`
Account registry for double-entry accounting.
\`\`\`sql
- id (uuid, PK)
- entity_id (uuid) -- Can be user_id or market_id
- reference_id (uuid) -- User's profile id for user accounts
- account_type (text) -- 'user', 'platform', 'external_clearing', 'market_pool', 'settlement_bond', etc.
- created_at (timestamp)
\`\`\`

#### `ledger_balance_snapshots`
Current balance for each ledger account.
\`\`\`sql
- id (uuid, PK)
- account_id (uuid, FK to ledger_accounts)
- balance_cents (bigint)
- updated_at (timestamp)
\`\`\`

#### `ledger_entries`
Individual ledger entries (immutable audit trail).
\`\`\`sql
- id (uuid, PK)
- account_id (uuid, FK to ledger_accounts)
- user_id (uuid)
- entry_type (text) -- 'deposit', 'withdrawal', 'trade_buy', 'trade_sell', 'settlement_win', etc.
- debit (numeric)
- credit (numeric)
- transaction_id (uuid)
- market_id (uuid)
- metadata (jsonb)
- created_at (timestamp)
\`\`\`

### Settlement Tables

#### `settlement_bonds`
Bonds posted for settlement proposals/contests.
\`\`\`sql
- id (uuid, PK)
- market_id (uuid, FK to markets)
- creator_id (uuid, FK to profiles)
- amount (numeric)
- status (text) -- 'held', 'returned', 'forfeited'
- proposal_outcome (text) -- 'yes', 'no', 'cancel'
- contest_deadline (timestamp)
- created_at (timestamp)
\`\`\`

#### `settlement_contests`
Contested settlement records.
\`\`\`sql
- id (uuid, PK)
- bond_id (uuid, FK to settlement_bonds)
- market_id (uuid, FK to markets)
- contestant_id (uuid, FK to profiles)
- proposal_outcome (text)
- contested_outcome_text (text)
- status (text) -- 'pending', 'resolved'
- vote_deadline (timestamp)
- created_at (timestamp)
\`\`\`

#### `settlement_votes`
Votes on contested settlements.
\`\`\`sql
- id (uuid, PK)
- contest_id (uuid, FK to settlement_contests)
- voter_id (uuid, FK to profiles)
- vote_outcome_text (text) -- 'yes', 'no', 'cancel'
- created_at (timestamp)
\`\`\`

---

## Trading Mechanics

### LMSR (Logarithmic Market Scoring Rule)

The platform uses LMSR for automated market making, ensuring continuous liquidity.

#### Key Parameters

- **qy**: Cumulative YES shares sold
- **qn**: Cumulative NO shares sold
- **b**: Liquidity parameter (higher = more liquidity, less price impact)

#### Price Calculation

\`\`\`
P(YES) = e^(qy/b) / (e^(qy/b) + e^(qn/b))
P(NO) = 1 - P(YES)
\`\`\`

#### Cost Function

\`\`\`
C(qy, qn) = b * ln(e^(qy/b) + e^(qn/b))
\`\`\`

#### Buying Shares

To buy `n` YES shares, the cost is:
\`\`\`
Cost = C(qy + n, qn) - C(qy, qn)
\`\`\`

#### Selling Shares

To sell `n` YES shares, the payout is:
\`\`\`
Payout = C(qy, qn) - C(qy - n, qn)
\`\`\`

#### Liquidity Parameter (b)

\`\`\`
b = (liquidity_amount / ln(2)) - 1
\`\`\`

Where `liquidity_amount` is the initial liquidity posted by the market creator.

### Fees

- **Trading Fee**: 1% on all buys and sells
- **Fee Distribution**: Fees go to the platform account
- **Creator Fees**: Market creators earn fees from trades on their markets

### Slippage Protection

The platform enforces **2% maximum slippage** protection:
- User sees a price when placing a trade
- If the execution price differs by more than 2%, the trade fails
- This prevents front-running and stale price exploitation

---

## Market Types

### Public Markets

- **Visibility**: Anyone can view and trade
- **Minimum Liquidity**: $20 ($10 for LMSR pool + $10 for UMA proposer reward)
- **Settlement**: Via UMA oracle (decentralized) or TWAP-based early settlement
- **Trading Restriction**: Anyone can trade except the market creator (conflict of interest)

### Private Markets

- **Visibility**: Only invited users and group members
- **Minimum Liquidity**: $10
- **Settlement**: Creator-initiated with bond-based dispute resolution
- **Trading Restriction**: Market creator cannot trade their own market

### Market Statuses

| Status | Description |
|--------|-------------|
| `active` | Trading is open |
| `expired` | End date passed, awaiting settlement |
| `suspended` | Settlement proposed, contest period active |
| `contested` | Settlement contested, voting in progress |
| `settled` | Final outcome determined, positions paid out |
| `cancelled` | Market cancelled, all positions refunded |

---

## Settlement System

### Private Market Settlement Flow

\`\`\`
┌─────────────────┐
│  Market Expires │
└────────┬────────┘
         ▼
┌─────────────────────────────────────┐
│  1. PROPOSE SETTLEMENT              │
│  - Creator proposes YES/NO/CANCEL   │
│  - Posts bond (10% of liquidity)    │
│  - 24-hour contest period starts    │
└────────┬────────────────────────────┘
         ▼
┌─────────────────────────────────────┐
│  2. CONTEST PERIOD (24 hours)       │
│  - Any participant can contest      │
│  - Contestant posts matching bond   │
│  - Proposes different outcome       │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────────────────────┐
│   NO    │ │   YES - CONTESTED       │
│ CONTEST │ │   48-hour voting period │
└────┬────┘ └────────┬────────────────┘
     │               ▼
     │      ┌─────────────────────────┐
     │      │  3. VOTING PHASE        │
     │      │  - All participants vote│
     │      │  - 3 options: YES/NO/   │
     │      │    CANCEL               │
     │      └────────┬────────────────┘
     │               ▼
     │      ┌─────────────────────────┐
     │      │  4. VOTE COUNTING       │
     │      │  - Proposer vote counts │
     │      │  - Contestant vote      │
     │      │    counts               │
     │      │  - Majority wins        │
     │      │  - Ties favor proposer  │
     │      └────────┬────────────────┘
     │               │
     └───────┬───────┘
             ▼
┌─────────────────────────────────────┐
│  5. SETTLEMENT EXECUTION            │
│  - Winning positions paid $1/share  │
│  - Losing positions worth $0        │
│  - Correct bond returned + bonus    │
│  - Wrong bond forfeited             │
│  - Liquidity returned to creator    │
└─────────────────────────────────────┘
\`\`\`

### Vote Counting Rules

1. **Proposer's vote** = their proposed outcome (implicit vote)
2. **Contestant's vote** = their contested outcome (implicit vote)
3. **Explicit votes** from other participants
4. **Majority wins**
5. **Two-way ties**: If proposer's outcome is one of the tied options, proposer wins
6. **Three-way ties**: Proposer's outcome wins
7. **Contestant wins tie against proposer**: Contestant's outcome wins only if strictly more votes

### Bond Mechanics

- **Proposal Bond**: 10% of market liquidity (minimum $0.10)
- **Contest Bond**: Must match proposal bond exactly
- **Bond Return**: Returned to winner with bonus from loser's forfeited bond
- **Bond Distribution**: Loser's bond split among all voters who voted correctly

### Public Market Settlement (UMA Oracle)

For public markets, settlement can be initiated via:
1. **Manual UMA proposal** after market expires
2. **TWAP-based early settlement** - If probability stays above 99% (or below 1%) for 4+ hours continuously

---

## Ledger System

The platform uses a **double-entry accounting system** where every transaction creates matching debit and credit entries.

### Account Types

| Account Type | Purpose |
|--------------|---------|
| `user` | User balance account |
| `platform` | Platform fee collection |
| `external_clearing` | External money flow (deposits/withdrawals) |
| `market_pool` | Market liquidity pool |
| `settlement_bond` | Settlement bond escrow |
| `market_creator_fees` | Market creator fee earnings |

### Entry Types

| Entry Type | Description |
|------------|-------------|
| `deposit` | User deposits funds |
| `withdrawal` | User withdraws funds |
| `trade_buy` | User buys shares |
| `trade_sell` | User sells shares |
| `trade_fee` | Trading fee collected |
| `market_creation` | Market creation liquidity |
| `settlement_win` | Winning position payout |
| `settlement_loss` | Losing position close |
| `bond_deposit` | Settlement bond posted |
| `bond_return` | Settlement bond returned |
| `bond_forfeit` | Settlement bond forfeited |
| `liquidity_return` | Unused liquidity returned to creator |
| `liquidity_sweep` | Excess liquidity swept to platform |

### Balance Sync

User balances in `profiles.balance` are automatically synced from the ledger via a PostgreSQL trigger. The ledger is the **source of truth** for all balances.

### Audit Functions

\`\`\`sql
-- Check all user balances match their ledger
SELECT * FROM check_all_balance_reconciliation();

-- Sum all debits and credits (should equal zero)
SELECT SUM(credit) - SUM(debit) FROM ledger_entries;

-- Sum all account balances (should equal zero)
SELECT SUM(balance_cents) FROM ledger_balance_snapshots;
\`\`\`

---

## Authentication

The platform uses **Supabase Auth** for authentication.

### Supported Methods

- Email/password registration
- Email verification required
- Password reset via email

### Protected Routes

All routes except `/`, `/auth/*`, and `/markets` require authentication. The middleware in `middleware.ts` handles route protection and token refresh.

### User Roles

- **Regular User**: Can create markets, trade, participate in settlements
- **Admin**: Access to admin dashboard, can settle markets manually, view audits

---

## Key Features

### TWAP-Based Early Settlement

Markets can be settled early if the probability maintains an extreme value:
- **Threshold**: 99% (YES) or 1% (NO)
- **Duration**: 4 hours continuous
- **Calculation**: Exponential moving average updated on each trade

### Position P&L Tracking

The platform tracks:
- **Cost basis**: Total amount invested in a position
- **Average price**: Weighted average price per share
- **Realized P&L**: Profit/loss from closed positions
- **Unrealized P&L**: Current value vs cost basis

### Groups

Users can create private groups to:
- Share markets among members
- Control market visibility
- Enable group-based settlement voting

### Notifications

Users receive notifications for:
- Market creation
- Trade execution
- Settlement proposals
- Contest notifications
- Vote requests
- Settlement results
- Bond returns/forfeitures

---

## API Routes

### Cron Jobs

| Route | Purpose | Schedule |
|-------|---------|----------|
| `/api/cron/force-settle` | Auto-settle expired settlements | Every 5 minutes |
| `/api/cron/check-settlements` | Check pending settlements | Every minute |

### Data APIs

| Route | Purpose |
|-------|---------|
| `/api/markets` | Fetch markets list |
| `/api/my-bets` | Fetch user positions |
| `/api/profile` | Fetch user profile |
| `/api/market-price-history` | Fetch price history for charts |

---

## Environment Variables

### Required

\`\`\`env
# Database
POSTGRES_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Development redirect (for Supabase email auth)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
\`\`\`

### Optional

\`\`\`env
# UMA Oracle (public markets)
UMA_ORACLE_ADDRESS=0x...
PRIVATE_KEY=0x...

# Feature Flags
NEXT_PUBLIC_ENABLE_UMA=true
\`\`\`

---

## Development

### Running Locally

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev
\`\`\`

### Database Migrations

SQL migration scripts are stored in `/scripts/` and should be run in order:
\`\`\`bash
# Run a specific migration
psql $POSTGRES_URL -f scripts/378_add_twap_early_settlement.sql
\`\`\`

### Testing

The admin dashboard includes audit tools:
- **Balance Reconciliation**: Verify user balances match ledger
- **Ledger Balance Audit**: Verify credits equal debits
- **Site Net Audit**: Verify all money is accounted for

---

## License

Proprietary - All rights reserved.
