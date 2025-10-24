# WannaBet - Prediction Market Platform

A full-stack prediction market application built with Next.js, Supabase, and the Logarithmic Market Scoring Rule (LMSR) pricing mechanism. Users can create markets, trade on predictions, and earn fees as market creators.

## Table of Content

- [Overview](#overview)
- [Technical Architecture](#technical-architecture)
- [Database Schema](#database-schema)
- [Core Features](#core-features)
- [User Rules & Permissions](#user-rules--permissions)
- [Market Lifecycle](#market-lifecycle)
- [Trading Mechanics](#trading-mechanics)
- [Fee Structure](#fee-structure)
- [SQL Functions](#sql-functions)
- [File Structure](#file-structure)
- [Getting Started](#getting-started)

---

## Overview

WannaBet is a decentralized prediction market platform where users can:
- Create binary (YES/NO) prediction markets on any topic
- Trade shares using an automated market maker (LMSR)
- Earn fees as market creators (0.5% of all trades)
- Participate in private markets with specific users or groups
- Settle markets and receive payouts based on outcomes

The platform uses a sophisticated pricing mechanism that automatically adjusts odds based on trading activity, ensuring liquidity and fair pricing.

---

## Technical Architecture

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Backend**: Next.js Server Actions, Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Pricing Algorithm**: LMSR (Logarithmic Market Scoring Rule)

### Key Libraries

- `@supabase/ssr` - Server-side Supabase client
- `@supabase/auth-helpers-nextjs` - Authentication helpers
- `lucide-react` - Icon library
- Custom LMSR implementation (`lib/lmsr.ts`)

### Application Flow

\`\`\`
User Request → Next.js App Router → Server Actions → Supabase (PostgreSQL) → SQL Functions → Response
                                                    ↓
                                            Row Level Security (RLS)
                                                    ↓
                                            Data Validation & Processing
\`\`\`

---

## Database Schema

### Core Tables

#### `profiles`
User account information and balances.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (matches Supabase auth.users) |
| `username` | TEXT | Unique username |
| `display_name` | TEXT | Display name |
| `balance` | NUMERIC | User's current balance |
| `role` | TEXT | User role (user, admin, moderator) |
| `bio` | TEXT | User biography |
| `avatar_url` | TEXT | Profile picture URL |
| `created_at` | TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | Last update time |

#### `markets`
Prediction markets created by users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `creator_id` | UUID | Foreign key to profiles |
| `title` | TEXT | Market question (max 100 chars) |
| `description` | TEXT | Market details (max 400 chars) |
| `category` | TEXT | Market category |
| `end_date` | TIMESTAMP | Trading closes at this time |
| `resolution_date` | TIMESTAMP | When market should be resolved |
| `status` | TEXT | active, expired, settled, cancelled |
| `outcome` | BOOLEAN | Final outcome (true=YES, false=NO) |
| `winning_side` | BOOLEAN | Which side won |
| `is_private` | BOOLEAN | Private market flag |
| `invited_user_id` | UUID | For 1-on-1 private markets |
| `group_id` | UUID | For group-based private markets |
| `qy` | NUMERIC | LMSR: YES share quantity |
| `qn` | NUMERIC | LMSR: NO share quantity |
| `b` | NUMERIC | LMSR: liquidity parameter |
| `yes_shares` | NUMERIC | Total YES shares outstanding |
| `no_shares` | NUMERIC | Total NO shares outstanding |
| `yes_liquidity` | NUMERIC | YES side liquidity |
| `no_liquidity` | NUMERIC | NO side liquidity |
| `liquidity_pool` | NUMERIC | Total liquidity in market |
| `total_volume` | NUMERIC | Total trading volume |
| `creator_fees_earned` | NUMERIC | Accumulated creator fees |
| `settled_by` | UUID | Admin/creator who settled |
| `settled_at` | TIMESTAMP | Settlement timestamp |

#### `positions`
User holdings in markets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `market_id` | UUID | Foreign key to markets |
| `side` | BOOLEAN | true=YES, false=NO |
| `shares` | NUMERIC | Number of shares held |
| `amount_invested` | NUMERIC | Total amount invested |
| `avg_price` | NUMERIC | Average price per share |

#### `transactions`
Financial transaction history.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `market_id` | UUID | Foreign key to markets (nullable) |
| `type` | TEXT | bet, sell, settlement_payout, creator_payout, liquidity_return, refund, market_creation |
| `amount` | NUMERIC | Transaction amount |
| `description` | TEXT | Human-readable description |
| `created_at` | TIMESTAMP | Transaction time |

#### `fees`
Fee tracking for creators and platform.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Fee recipient |
| `market_id` | UUID | Foreign key to markets |
| `fee_type` | TEXT | creator_fee or site_fee |
| `fee_amount` | NUMERIC | Fee amount |
| `original_amount` | NUMERIC | Original transaction amount |
| `net_amount` | NUMERIC | Amount after fee |
| `fee_percentage` | NUMERIC | Fee percentage (0.005 = 0.5%) |
| `transaction_type` | TEXT | buy or sell |
| `paid_out` | BOOLEAN | Whether fee has been paid |

#### `notifications`
User notifications for market events.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `market_id` | UUID | Foreign key to markets |
| `type` | TEXT | trade, market_settled, creator_fee, new_market, market_cancelled |
| `title` | TEXT | Notification title |
| `message` | TEXT | Notification message |
| `is_read` | BOOLEAN | Read status |
| `created_at` | TIMESTAMP | Notification time |

#### `groups`
User-created groups for private markets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Group name |
| `description` | TEXT | Group description |
| `creator_id` | UUID | Foreign key to profiles |

#### `user_groups`
Group membership mapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `group_id` | UUID | Foreign key to groups |
| `joined_at` | TIMESTAMP | Join timestamp |

#### `market_participants`
Participants in private markets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `market_id` | UUID | Foreign key to markets |
| `user_id` | UUID | Foreign key to profiles |
| `group_id` | UUID | Foreign key to groups (nullable) |
| `role` | TEXT | creator or participant |
| `status` | TEXT | accepted, pending, declined |

---

## Core Features

### 1. Market Creation

Users can create prediction markets with:
- **Title**: Clear YES/NO question (max 100 characters)
- **Description**: Context and resolution criteria (max 400 characters)
- **Category**: Politics, Sports, Technology, Economics, Entertainment, Science, Crypto, Other
- **End Date**: When trading closes (must be at least 1 day in future)
- **Initial Liquidity**: $50-$1000 (deducted from creator's balance)
- **Privacy**: Public or private (with invited users/groups)

**Liquidity Calculation**:
\`\`\`typescript
// LMSR parameter 'b' is calculated from liquidity amount
b = (liquidity_amount / ln(2)) - 1

// Initial liquidity formula
initial_liquidity = (b + 1) * ln(2)
\`\`\`

### 2. Trading System

**LMSR Pricing Mechanism**:
- Automatically adjusts odds based on trading activity
- Ensures continuous liquidity
- Prices converge to market consensus

**Buy Shares**:
1. User specifies amount to spend
2. System calculates shares received using LMSR
3. 1% fee deducted (0.5% to creator, 0.5% to platform)
4. User balance decreased, position created/updated
5. Market state updated (qy, qn, liquidity_pool)

**Sell Shares**:
1. User specifies shares to sell
2. System calculates payout using LMSR
3. 1% fee deducted from payout
4. User balance increased, position updated/deleted
5. Market state updated

### 3. Market Settlement

**Who Can Settle**:
- **Public Markets**: Only admins
- **Private Markets**: Creator OR admins

**Settlement Process**:
1. Admin/creator declares winning side (YES or NO)
2. Winners receive $1.00 per share
3. Creator receives accumulated fees (0.5% of all trades)
4. Creator receives initial liquidity back (up to amount available)
5. Notifications sent to all participants
6. Market status set to "settled"

**Liquidity Return**:
\`\`\`
liquidity_return = min(remaining_liquidity, initial_liquidity)
\`\`\`

### 4. Market Cancellation

**Who Can Cancel**:
- **Public Markets**: Only admins
- **Private Markets**: Creator OR admins

**Cancellation Process**:
1. All users refunded their net investment
2. Creator receives initial liquidity back (up to amount available)
3. All positions deleted
4. Market status set to "cancelled"
5. Notifications sent to all participants

### 5. Private Markets

**Types**:
- **Individual**: Invite specific users
- **Group-based**: Invite entire groups

**Visibility**:
- Only visible to creator and invited participants
- Enforced via Row Level Security (RLS)

**Trading Restrictions**:
- Creator CANNOT trade on their own private market (conflict of interest)
- Only invited participants can trade

---

## User Rules & Permissions

### General Users

**Can Do**:
- ✅ Create public markets (with sufficient balance)
- ✅ Create private markets (with sufficient balance)
- ✅ Trade on public markets (if not expired/settled)
- ✅ Trade on private markets they're invited to
- ✅ Sell their shares at any time (before market expires)
- ✅ View their positions and transaction history
- ✅ Receive notifications for market events
- ✅ Create and join groups
- ✅ View their balance and wallet

**Cannot Do**:
- ❌ Trade on their own private markets (conflict of interest)
- ❌ Trade after market expires
- ❌ Trade on settled/cancelled markets
- ❌ Settle markets (unless admin or private market creator)
- ❌ Cancel markets (unless admin or private market creator)
- ❌ View other users' private markets
- ❌ Modify other users' balances

### Market Creators

**Additional Permissions**:
- ✅ Earn 0.5% fee on all trades in their markets
- ✅ Settle their own private markets
- ✅ Cancel their own private markets
- ✅ Receive initial liquidity back on settlement/cancellation (up to amount available)

**Restrictions**:
- ❌ Cannot trade on their own private markets
- ❌ Cannot settle public markets (admin only)
- ❌ Cannot cancel public markets (admin only)

### Admins

**Full Permissions**:
- ✅ Settle any market (public or private)
- ✅ Cancel any market (public or private)
- ✅ View all markets (including private)
- ✅ Update user roles
- ✅ View platform fees and liquidity summary
- ✅ Access admin dashboard

---

## Market Lifecycle

### 1. Active Phase

\`\`\`
Market Created → Trading Opens → Users Buy/Sell Shares → Market Approaches End Date
\`\`\`

**Characteristics**:
- Trading is enabled
- Prices adjust based on LMSR
- Fees accumulate for creator
- Liquidity pool fluctuates

### 2. Expired Phase

\`\`\`
End Date Passes → Trading Closes → Awaiting Settlement
\`\`\`

**Characteristics**:
- Trading is disabled
- Market awaits admin/creator settlement
- No new positions can be opened
- Existing positions cannot be sold

### 3. Settled Phase

\`\`\`
Admin/Creator Settles → Winners Paid → Fees Distributed → Liquidity Returned
\`\`\`

**Payout Order**:
1. Winners receive $1.00 per share
2. Creator receives accumulated fees
3. Creator receives initial liquidity (up to amount available)
4. Remaining liquidity stays in pool

**Example**:
\`\`\`
Initial Liquidity: $100
Total Payouts: $80
Creator Fees: $5
Remaining Liquidity: $15

Creator Receives:
- Fees: $5
- Liquidity Return: min($15, $100) = $15
- Total: $20
\`\`\`

### 4. Cancelled Phase

\`\`\`
Admin/Creator Cancels → Users Refunded → Liquidity Returned
\`\`\`

**Refund Process**:
1. Each user refunded their net investment
2. Creator receives initial liquidity (up to amount available)
3. All positions deleted

---

## Trading Mechanics

### LMSR (Logarithmic Market Scoring Rule)

**Core Formulas**:

**Probability Calculation**:
\`\`\`
P(YES) = e^(qy/b) / (e^(qy/b) + e^(qn/b))
P(NO) = 1 - P(YES)
\`\`\`

**Cost Function**:
\`\`\`
C(q) = b * ln(e^(qy/b) + e^(qn/b))
\`\`\`

**Shares to Buy (YES)**:
\`\`\`
shares = b * ln(e^(V/b) * (e^(qy/b) + e^(qn/b)) - e^(qn/b)) - qy
\`\`\`

**Shares to Buy (NO)**:
\`\`\`
shares = b * ln(e^(V/b) * (e^(qy/b) + e^(qn/b)) - e^(qy/b)) - qn
\`\`\`

**Sell Value (YES)**:
\`\`\`
V = b * ln(e^(qy/b) + e^(qn/b)) - b * ln(e^((qy-delta)/b) + e^(qn/b))
\`\`\`

**Sell Value (NO)**:
\`\`\`
V = b * ln(e^(qy/b) + e^(qn/b)) - b * ln(e^(qy/b) + e^((qn-delta)/b))
\`\`\`

### Trading Example

**Initial State**:
- Market: "Will Bitcoin reach $100k by EOY?"
- Initial Liquidity: $100
- b = 143.24 (calculated from liquidity)
- qy = 0, qn = 0
- P(YES) = 50%, P(NO) = 50%

**User A buys $10 of YES**:
1. Fee: $10 * 0.01 = $0.10
2. Net amount: $9.90
3. Shares received: ~9.85 YES shares
4. New qy: 9.85, qn: 0
5. New P(YES): ~53%, P(NO): ~47%

**User B buys $20 of NO**:
1. Fee: $20 * 0.01 = $0.20
2. Net amount: $19.80
3. Shares received: ~21.2 NO shares
4. New qy: 9.85, qn: 21.2
5. New P(YES): ~42%, P(NO): ~58%

**User A sells 5 YES shares**:
1. Gross value: ~$4.80
2. Fee: $4.80 * 0.01 = $0.048
3. Net value: ~$4.75
4. New qy: 4.85, qn: 21.2
5. New P(YES): ~38%, P(NO): ~62%

---

## Fee Structure

### Trading Fees

**Total Fee**: 1% of transaction amount

**Split**:
- **Creator Fee**: 0.5% (paid to market creator)
- **Site Fee**: 0.5% (platform revenue)

**When Fees Are Charged**:
- On every buy transaction
- On every sell transaction

**When Fees Are Paid**:
- **Creator Fees**: Paid when market is settled
- **Site Fees**: Accumulated in fees table (not automatically paid out)

### Fee Tracking

All fees are recorded in the `fees` table with:
- `fee_type`: "creator_fee" or "site_fee"
- `fee_amount`: Amount of fee
- `paid_out`: Boolean flag (true after settlement)

### Fee Calculation Example

**User buys $100 of YES shares**:
\`\`\`
Total Fee: $100 * 0.01 = $1.00
Creator Fee: $1.00 * 0.5 = $0.50
Site Fee: $1.00 * 0.5 = $0.50
Net Amount Used for Shares: $99.00
\`\`\`

**Market settles with $50 in creator fees**:
\`\`\`
Creator receives:
- Accumulated fees: $50
- Initial liquidity: up to $100 (depending on remaining)
\`\`\`

---

## SQL Functions

### Concurrency & Race Conditions

**Problem**: Without proper locking, concurrent trades on the same market can cause race conditions where multiple users read stale market state and execute trades based on incorrect odds.

**Example Race Condition**:
\`\`\`
Time    User A                          User B
----    ------                          ------
T1      Reads market: 50% odds          
T2                                      Reads market: 50% odds (same state)
T3      Calculates trade at 50%         
T4                                      Calculates trade at 50%
T5      Updates market (qy=120)         
T6                                      Updates market (qy=120) ← WRONG!
\`\`\`

**Result**: User B gets 50% odds when they should have gotten higher odds after User A's trade. Market state becomes inconsistent.

**Solution**: Row-level locking using PostgreSQL's `SELECT ... FOR UPDATE`

**How It Works**:
\`\`\`sql
-- In execute_trade_lmsr and sell_shares_lmsr functions
SELECT * FROM markets WHERE id = p_market_id FOR UPDATE;
\`\`\`

This ensures:
1. **Sequential Processing**: When multiple users trade simultaneously, transactions queue up
2. **Correct Odds**: Each user gets odds based on actual current market state
3. **Data Consistency**: Market state (qy, qn, liquidity_pool) remains accurate
4. **Atomic Updates**: All market changes happen within a single transaction

**Impact**:
- ✅ Prevents race conditions
- ✅ Ensures fair pricing for all users
- ✅ Maintains market state integrity
- ⚠️ Slight performance impact during high-concurrency (milliseconds)
- ⚠️ Trades on the same market execute sequentially instead of simultaneously

**Implementation**: The `add_row_locking_to_trades.sql` script adds `FOR UPDATE` locking to both `execute_trade_lmsr` and `sell_shares_lmsr` functions, ensuring all trades are processed atomically with correct market state.

### Trading Functions

#### `execute_trade_lmsr`
Executes a buy trade using LMSR pricing.

**Parameters**:
- `p_market_id`: Market UUID
- `p_user_id`: User UUID
- `p_bet_amount`: Amount to spend (including fee)
- `p_bet_side`: "yes" or "no"
- `p_qy`: New YES quantity
- `p_qn`: New NO quantity
- `p_yes_shares`: New total YES shares
- `p_no_shares`: New total NO shares
- `p_total_volume`: New total volume
- `p_calculated_shares`: Shares user receives
- `p_liquidity_pool`: New liquidity pool amount

**Process**:
1. Validates user balance
2. Validates market is tradeable
3. Prevents creator from trading on own private market
4. Deducts amount from user balance
5. Updates market state
6. Creates transaction record
7. Creates notification

#### `sell_shares_lmsr`
Executes a sell trade using LMSR pricing.

**Parameters**:
- `p_position_id`: Position UUID
- `p_shares_to_sell`: Number of shares to sell
- `p_expected_value`: Expected payout (including fee)
- `p_market_id`: Market UUID
- `p_user_id`: User UUID
- `p_qy`: New YES quantity
- `p_qn`: New NO quantity
- `p_yes_shares`: New total YES shares
- `p_no_shares`: New total NO shares
- `p_total_volume`: New total volume
- `p_liquidity_pool`: New liquidity pool amount

**Process**:
1. Validates position ownership
2. Validates sufficient shares
3. Validates market is tradeable
4. Prevents creator from trading on own private market
5. Updates/deletes position
6. Adds payout to user balance
7. Updates market state
8. Creates transaction record
9. Creates notification

#### `split_trading_fees_secure`
Records and splits trading fees between creator and platform.

**Parameters**:
- `p_market_id`: Market UUID
- `p_trader_id`: Trader UUID
- `p_creator_id`: Market creator UUID
- `p_total_fee`: Total fee amount (1% of transaction)

**Process**:
1. Calculates creator fee (50% of total)
2. Calculates site fee (50% of total)
3. Inserts creator fee record
4. Inserts site fee record
5. Updates market's `creator_fees_earned`

### Settlement Functions

#### `settle_market`
Settles a market and distributes payouts.

**Parameters**:
- `market_id_param`: Market UUID
- `outcome_param`: Winning side (true=YES, false=NO)
- `admin_user_id`: Admin or creator UUID

**Process**:
1. Validates user is admin OR private market creator
2. Validates market not already settled
3. Updates market status to "settled"
4. Pays winners $1.00 per share
5. Deducts payouts from liquidity pool
6. Pays creator accumulated fees
7. Returns initial liquidity to creator (up to amount available)
8. Sends notifications to all participants
9. Returns settlement result JSON

**Liquidity Return Logic**:
\`\`\`sql
initial_liquidity := (b + 1) * LN(2);
liquidity_return_amount := LEAST(remaining_liquidity, initial_liquidity);
\`\`\`

#### `cancel_market`
Cancels a market and refunds participants.

**Parameters**:
- `market_id_param`: Market UUID
- `admin_user_id`: Admin or creator UUID

**Process**:
1. Validates user is admin OR private market creator
2. Validates market not already settled/cancelled
3. Calculates net investment for each user
4. Refunds users their net investment
5. Deletes all positions
6. Returns initial liquidity to creator (up to amount available)
7. Updates market status to "cancelled"
8. Sends notifications to all participants
9. Returns cancellation result JSON

### Utility Functions

#### `handle_new_user`
Automatically creates a profile when a user signs up.

**Trigger**: After INSERT on `auth.users`

**Process**:
1. Creates profile record with user's email
2. Sets initial balance to $1000
3. Sets default role to "user"

---

## File Structure

### Application Structure

\`\`\`
app/
├── actions/
│   ├── admin.ts              # Admin actions (settle, cancel, get markets)
│   ├── database.ts           # Database utility actions
│   ├── groups.ts             # Group management actions
│   └── trade.ts              # Trading actions (buy, sell)
├── admin/
│   └── page.tsx              # Admin dashboard
├── auth/
│   ├── login/page.tsx        # Login page
│   ├── sign-up/page.tsx      # Sign up page
│   ├── sign-up-success/page.tsx
│   ├── error/page.tsx        # Auth error page
│   └── logout/route.ts       # Logout route
├── create-market/
│   └── page.tsx              # Market creation form
├── market/
│   └── [id]/page.tsx         # Individual market page
├── markets/
│   ├── page.tsx              # Public markets list
│   └── loading.tsx           # Loading state
├── my-bets/
│   └── page.tsx              # User's positions
├── private-bets/
│   └── page.tsx              # Private markets list
├── profile/
│   ├── page.tsx              # User profile
│   └── setup/page.tsx        # Profile setup
├── wallet/
│   └── page.tsx              # Wallet/transactions
├── layout.tsx                # Root layout
├── page.tsx                  # Home/dashboard
└── globals.css               # Global styles

components/
├── ui/                       # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── select.tsx
│   └── ... (30+ components)
├── group-autocomplete.tsx    # Group search component
├── groups-section.tsx        # Groups display
├── market-card.tsx           # Market card component
├── notifications.tsx         # Notifications dropdown
├── sell-shares-dialog.tsx    # Sell shares modal
├── user-autocomplete.tsx     # User search component
└── user-group-autocomplete.tsx # Combined user/group search

lib/
├── auth/
│   ├── admin.ts              # Admin authorization
│   └── admin-client.ts       # Client-side admin check
├── supabase/
│   ├── client.ts             # Browser Supabase client
│   ├── server.ts             # Server Supabase client
│   ├── service.ts            # Service role client
│   └── middleware.ts         # Auth middleware
├── fees.ts                   # Fee calculation utilities
├── lmsr.ts                   # LMSR pricing algorithms
├── market-status.ts          # Market status utilities
└── utils.ts                  # General utilities

scripts/
├── create_execute_trade_lmsr_function.sql
├── create_sell_shares_lmsr_function.sql
├── update_settlement_return_initial_liquidity.sql
├── update_cancel_return_initial_liquidity.sql
├── fix_trade_notifications_v2.sql
├── update_fee_to_1_percent.sql
├── add_creator_fee_tracking.sql
├── create_fees_table.sql
├── create_notifications_table.sql
├── create_groups_tables.sql
├── add_market_participants_table.sql
└── ... (80+ SQL migration scripts)
\`\`\`

### Key Files

#### `lib/lmsr.ts`
Contains all LMSR pricing calculations:
- `calculateYesProbability()` - Calculate YES probability
- `calculateNoProbability()` - Calculate NO probability
- `calculateSharesToBuyYes()` - Shares received for YES buy
- `calculateSharesToBuyNo()` - Shares received for NO buy
- `calculateSellValueYes()` - Payout for YES sell
- `calculateSellValueNo()` - Payout for NO sell
- `calculateBFromLiquidity()` - Convert liquidity to b parameter
- `calculateSharesToBuyWithFee()` - Buy with fee deduction
- `calculateSellValueAfterFee()` - Sell with fee deduction

#### `lib/fees.ts`
Fee calculation utilities:
- `FEE_PERCENTAGE` - Constant 0.01 (1%)
- `calculateFeeAndNetAmount()` - Split amount into fee and net
- `calculateSharesAfterFee()` - Shares after fee deduction
- `calculateSellValueAfterFee()` - Sell value after fee deduction

#### `lib/market-status.ts`
Market status management:
- `getMarketStatus()` - Determine current status
- `canTrade()` - Check if trading is allowed
- `isExpired()` - Check if market expired
- `isSettled()` - Check if market settled
- `getMarketStatusDisplay()` - Get display info

#### `app/actions/trade.ts`
Server actions for trading:
- `executeTrade()` - Execute buy trade
- `sellShares()` - Execute sell trade
- Both validate market state and user permissions
- Both call SQL functions and record fees

#### `app/actions/admin.ts`
Server actions for admin:
- `settleMarket()` - Settle public market (admin only)
- `settlePrivateMarket()` - Settle private market (creator or admin)
- `cancelMarket()` - Cancel public market (admin only)
- `cancelPrivateMarket()` - Cancel private market (creator or admin)
- `getExpiredMarkets()` - Get markets awaiting settlement
- `getAllMarkets()` - Get all markets (admin view)
- `updateUserRole()` - Change user role
- `getFeesAndLiquiditySummary()` - Platform financial summary

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- PostgreSQL database (via Supabase)

### Environment Variables

Create a `.env.local` file:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
\`\`\`

### Database Setup

1. Run all SQL scripts in the `scripts/` folder in order
2. Key scripts to run:
   - `create_fees_table.sql` - Fee tracking
   - `create_notifications_table.sql` - Notifications
   - `create_groups_tables.sql` - Groups
   - `add_market_participants_table.sql` - Private market participants
   - `update_settlement_return_initial_liquidity.sql` - Settlement function
   - `update_cancel_return_initial_liquidity.sql` - Cancellation function
   - `fix_trade_notifications_v2.sql` - Trading functions
   - `update_fee_to_1_percent.sql` - Fee splitting function

### Installation

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

### Creating Your First Market

1. Sign up for an account (receives $1000 starting balance)
2. Navigate to "Create Market"
3. Fill in market details:
   - Question (YES/NO format)
   - Description and resolution criteria
   - Category
   - End date (at least 1 day in future)
   - Initial liquidity ($50-$1000)
4. Choose public or private
5. Submit (liquidity deducted from balance)

### Trading

1. Browse markets on homepage
2. Click market to view details
3. Enter amount to spend
4. Select YES or NO
5. Review shares and price
6. Confirm trade
7. View position in "My Bets"

### Settling Markets (Admin/Creator)

1. Wait for market to expire
2. Navigate to Admin Dashboard (admins) or market page (private market creators)
3. Click "Settle Market"
4. Select winning side (YES or NO)
5. Confirm settlement
6. Payouts automatically distributed

---

## Important Rules Summary

### Market Creation
- ✅ Minimum liquidity: $50
- ✅ Maximum liquidity: $1000
- ✅ Title max: 100 characters
- ✅ Description max: 400 characters
- ✅ End date must be at least 1 day in future
- ✅ Private markets require at least one invited participant

### Trading
- ✅ 1% fee on all trades (0.5% creator, 0.5% platform)
- ✅ Cannot trade on own private markets
- ✅ Cannot trade after market expires
- ✅ Cannot trade on settled/cancelled markets
- ✅ Must have sufficient balance
- ✅ Must have sufficient shares to sell

### Settlement
- ✅ Public markets: Admin only
- ✅ Private markets: Creator OR admin
- ✅ Winners receive $1.00 per share
- ✅ Creator receives accumulated fees
- ✅ Creator receives initial liquidity (up to amount available)
- ✅ Cannot settle already settled markets

### Cancellation
- ✅ Public markets: Admin only
- ✅ Private markets: Creator OR admin
- ✅ Users refunded net investment
- ✅ Creator receives initial liquidity (up to amount available)
- ✅ All positions deleted
- ✅ Cannot cancel already settled markets

### Liquidity Return
- ✅ On settlement: `min(remaining_liquidity, initial_liquidity)`
- ✅ On cancellation: `min(remaining_liquidity, initial_liquidity)`
- ✅ Initial liquidity = `(b + 1) * ln(2)`
- ✅ Creator may receive more or less than original liquidity depending on market activity

---

## Support

For issues or questions:
- Check the code comments in relevant files
- Review SQL function definitions in `scripts/`
- Examine LMSR calculations in `lib/lmsr.ts`
- Check RLS policies in Supabase dashboard

---

## License

This project is proprietary software. All rights reserved.
