# Prediction Market Platform

A full-stack decentralized prediction market platform built with Next.js 14, featuring both private markets with an internal oracle system and public markets with UMA Optimistic Oracle integration on Polygon.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Market Types](#market-types)
- [Oracle Systems](#oracle-systems)
- [Database Schema](#database-schema)
- [Scalability & Performance](#scalability--performance)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Contributing](#contributing)

---

## Overview

This platform enables users to create and trade on prediction markets with real money. It supports two distinct market types:

1. **Private Markets** - Group-based markets with internal oracle settlement
2. **Public Markets** - Open markets with UMA Optimistic Oracle integration (Polygon)

### Key Features

- LMSR (Logarithmic Market Scoring Rule) automated market maker
- Real-time price updates and trading
- Group-based access control for private markets
- Decentralized dispute resolution via UMA (public markets)
- Internal oracle with bond-based incentive alignment (private markets)
- Comprehensive notification system
- PnL tracking and transaction history
- Mobile-responsive design

---

## System Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 14 App Router                    │
│                    (React 19, TypeScript)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────────────────────┐
                              │                                 │
                    ┌─────────▼─────────┐          ┌──────────▼──────────┐
                    │  Private Markets  │          │   Public Markets    │
                    │  (Internal Oracle)│          │   (UMA Oracle)      │
                    └─────────┬─────────┘          └──────────┬──────────┘
                              │                                │
                    ┌─────────▼─────────┐          ┌──────────▼──────────┐
                    │  Settlement Flow  │          │  UMA Integration    │
                    │  - Initiate       │          │  - Propose          │
                    │  - Contest        │          │  - Dispute          │
                    │  - Vote           │          │  - Resolve          │
                    │  - Resolve        │          │  (Polygon Testnet)  │
                    └─────────┬─────────┘          └──────────┬──────────┘
                              │                                │
                              └────────────┬───────────────────┘
                                           │
                              ┌────────────▼────────────┐
                              │   AWS RDS PostgreSQL    │
                              │   - 20 Tables           │
                              │   - 50+ Indexes         │
                              │   - Connection Pool     │
                              └─────────────────────────┘
\`\`\`

### Architecture Layers

1. **Presentation Layer** - Next.js 14 with React Server Components
2. **Business Logic Layer** - Server Actions for mutations, Server Components for queries
3. **Data Access Layer** - Custom database adapter with connection pooling
4. **Database Layer** - AWS RDS PostgreSQL with optimized indexes
5. **Blockchain Layer** - UMA Optimistic Oracle on Polygon (public markets only)

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14.2.25 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4.1.9
- **Components**: Radix UI primitives
- **State Management**: SWR for client-side caching
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js with Next.js API Routes & Server Actions
- **Database**: AWS RDS PostgreSQL 17.6
- **Connection Pooling**: Custom pg pool (50 max connections)
- **Authentication**: Supabase Auth
- **Rate Limiting**: Custom implementation with in-memory store

### Blockchain (Public Markets)
- **Network**: Polygon Amoy Testnet (testing) → Polygon Mainnet (production)
- **Oracle**: UMA Optimistic Oracle V3
- **Smart Contracts**: Hardhat development environment
- **Libraries**: ethers.js, Hardhat

### Infrastructure
- **Hosting**: Vercel
- **Database**: AWS RDS
- **Monitoring**: Health check endpoint (`/api/health`)
- **Analytics**: Vercel Analytics

---

## Market Types

### Private Markets

**Access Control**: Group-based (invite-only)

**Settlement**: Internal oracle system with economic incentives

**Use Cases**:
- Friend groups
- Company internal predictions
- Private betting pools
- Closed communities

**Features**:
- Creator has settlement authority
- Participants can contest settlements
- Community voting for disputes
- Bond-based incentive alignment

### Public Markets

**Access Control**: Open to all users

**Settlement**: UMA Optimistic Oracle on Polygon

**Use Cases**:
- Public events
- Sports outcomes
- Political predictions
- Cryptocurrency prices

**Features**:
- Decentralized dispute resolution
- Blockchain-verified outcomes
- Larger bond pools
- Trustless settlement

---

## Oracle Systems

### Internal Oracle (Private Markets)

A three-phase settlement system with economic incentives:

#### Phase 1: Settlement Initiation
- **Who**: Market creator
- **Bond**: Creator's accumulated fees (typically 2-5% of volume)
- **Action**: Proposes winning outcome
- **Timeline**: 1-hour contest period begins

#### Phase 2: Contest (Optional)
- **Who**: Any market participant
- **Bond**: $50 fixed amount
- **Action**: Disputes creator's proposed outcome
- **Timeline**: Triggers 24-hour voting period

#### Phase 3: Voting (If Contested)
- **Who**: Random selection of 5 verifiers from participants
- **Bond**: $25 per voter
- **Action**: Vote on correct outcome
- **Resolution**: Majority vote wins
- **Incentives**:
  - Correct voters: Split losing side's bonds
  - Incorrect voters: Forfeit bonds

#### Uncontested Settlement
- If no contest within 1 hour → Creator's outcome accepted
- Creator's bond returned
- Positions settled automatically

#### Bond Distribution
\`\`\`
Uncontested:
  Creator Bond → Returned to creator

Contested (Creator Correct):
  Creator Bond → Returned to creator
  Contestant Bond → Forfeited to creator
  Correct Voter Bonds → Returned + share of incorrect voter bonds
  Incorrect Voter Bonds → Split among correct voters

Contested (Creator Incorrect):
  Creator Bond → Forfeited to contestant
  Contestant Bond → Returned to contestant
  Correct Voter Bonds → Returned + share of incorrect voter bonds
  Incorrect Voter Bonds → Split among correct voters
\`\`\`

### UMA Oracle (Public Markets)

**Status**: Local testing complete, Amoy testnet integration in progress

**Integration Points**:
1. Market creation → Register with UMA
2. Settlement proposal → Submit to UMA Optimistic Oracle
3. Dispute period → UMA handles bond management
4. Resolution → Callback triggers position settlement

**Smart Contracts**:
- `OptimisticOracleV3` - Main oracle contract
- Custom market resolver contract (in development)

**Database Tables**:
- `uma_proposals` - Tracks settlement proposals
- `uma_disputes` - Records dispute events
- `blockchain_transactions` - Logs all on-chain interactions

---

## Database Schema

### Core Tables (20 total)

#### Markets & Trading
- `markets` - Market definitions and metadata
- `positions` - User positions (shares held)
- `transactions` - Trade history
- `market_price_history` - Price snapshots
- `market_participants` - Access control for private markets

#### Oracle & Settlement (Private)
- `settlement_bonds` - Creator settlement bonds
- `settlement_contests` - Contest records
- `settlement_votes` - Voter decisions
- `settlement_notifications` - Voter notifications

#### UMA Integration (Public)
- `uma_proposals` - Settlement proposals to UMA
- `uma_disputes` - Dispute records
- `blockchain_transactions` - On-chain transaction log

#### User Management
- `profiles` - User profiles and balances
- `groups` - Group definitions
- `user_groups` - Group membership
- `notifications` - User notifications
- `fees` - Platform fee tracking

### Key Indexes (50+ total)

Performance-critical indexes on:
- Market status and timestamps
- User positions and transactions
- Settlement status and deadlines
- UMA proposal states
- Price history queries

See `scripts/add_performance_indexes.sql` for complete list.

---

## Scalability & Performance

### Current Optimizations

#### Database
- **Connection Pooling**: 50 max connections, 5 min idle
- **Query Timeout**: 30 seconds
- **Indexes**: 50+ strategic indexes for 10-100x faster queries
- **Slow Query Logging**: Queries >1 second logged

#### Application
- **Rate Limiting**: Per-user limits on critical endpoints
  - Trading: 10 requests/minute
  - Settlement: 5 requests/minute
  - Contests: 3 requests/minute
  - Voting: 10 requests/minute
  - Market Creation: 5 requests/minute
- **Caching**: Page-level caching (5-minute revalidation)
- **Request Timeouts**: 30-second timeout on long-running operations

#### Infrastructure
- **Health Monitoring**: `/api/health` endpoint
- **Connection Pool Stats**: Real-time monitoring
- **Memory Tracking**: Heap usage monitoring

### Performance Targets

- **API Response Time**: <500ms (p95)
- **Database Queries**: <100ms (p95)
- **Page Load**: <2 seconds (p95)
- **Concurrent Users**: 1,000-10,000 supported

### Capacity Planning

**Current Configuration** (Pre-Launch):
- AWS RDS t3.micro
- 50 database connections
- Vercel Pro hosting
- **Cost**: ~$35-50/month

**At Scale** (10k+ users):
- AWS RDS t3.small or larger
- 100+ database connections
- Redis caching layer (optional)
- **Cost**: ~$100-200/month

See `SCALABILITY_IMPROVEMENTS.md` for detailed implementation status.

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 17+ (AWS RDS recommended)
- Supabase account (for authentication)
- Vercel account (for deployment)

### Environment Variables

Create a `.env.local` file:

\`\`\`bash
# Database (AWS RDS)
POSTGRES_URL=postgresql://user:password@host:5432/database
POSTGRES_URL_NON_POOLING=postgresql://user:password@host:5432/database

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000

# UMA Integration (Public Markets)
NEXT_PUBLIC_POLYGON_RPC=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_UMA_ORACLE_ADDRESS=0x... # UMA OptimisticOracleV3 address
PRIVATE_KEY=your-wallet-private-key # For settlement proposals
\`\`\`

### Installation

\`\`\`bash
# Clone repository
git clone <repository-url>
cd prediction-market-platform

# Install dependencies
npm install

# Run database migrations
psql $POSTGRES_URL -f scripts/add_performance_indexes.sql

# Start development server
npm run dev
\`\`\`

### Database Setup

1. Create PostgreSQL database on AWS RDS
2. Run schema creation scripts (in order):
   - Core tables (markets, positions, transactions)
   - Settlement tables (bonds, contests, votes)
   - UMA tables (proposals, disputes)
   - Performance indexes

3. Verify setup:
\`\`\`bash
npm run test:rds
\`\`\`

---

## Deployment

### Vercel Deployment

1. **Connect Repository**
   \`\`\`bash
   vercel link
   \`\`\`

2. **Set Environment Variables**
   - Add all `.env.local` variables to Vercel project settings
   - Ensure `POSTGRES_URL` points to production RDS instance

3. **Deploy**
   \`\`\`bash
   vercel --prod
   \`\`\`

### Post-Deployment Checklist

- [ ] Verify `/api/health` endpoint returns 200
- [ ] Test authentication flow
- [ ] Create test market
- [ ] Execute test trade
- [ ] Verify database connections
- [ ] Check rate limiting
- [ ] Monitor error logs

---

## API Reference

### Server Actions

#### Trading
- `executeTrade(marketId, side, amount)` - Execute a trade
- `getMarketData(marketId)` - Fetch market details

#### Markets
- `createMarket(data)` - Create new market
- `getMarkets(filters)` - List markets

#### Oracle (Private Markets)
- `initiateSettlement(marketId, outcome)` - Start settlement
- `contestSettlement(marketId)` - Contest outcome
- `submitVote(contestId, outcome)` - Vote on dispute

#### Admin
- `settleMarket(marketId, outcome)` - Force settle (public markets)
- `cancelMarket(marketId)` - Cancel market

### API Routes

- `GET /api/health` - Health check
- `GET /api/markets` - List markets
- `GET /api/market-price-history?marketId=...` - Price history
- `POST /api/cron/settlement` - Auto-settlement cron job

---

## Development Roadmap

### Phase 1: Stabilization (Current)
- [x] Internal oracle for private markets
- [x] Database performance optimization
- [x] Rate limiting implementation
- [x] Health monitoring setup
- [ ] Error tracking (Sentry)
- [ ] Load testing

### Phase 2: UMA Integration
- [x] Local UMA testing
- [ ] Amoy testnet deployment
- [ ] Smart contract audit
- [ ] Mainnet deployment

### Phase 3: Launch
- [ ] Soft launch (100 users)
- [ ] Public launch
- [ ] Marketing campaign

### Phase 4: Scale
- [ ] Redis caching layer
- [ ] Read replicas
- [ ] Advanced analytics
- [ ] Mobile app

---

## Contributing

### Development Workflow

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

### Code Style

- TypeScript strict mode
- ESLint + Prettier
- Server Actions for mutations
- Server Components for data fetching

### Testing

\`\`\`bash
# Test database connection
npm run test:rds

# Test RDS queries
npm run dev
# Navigate to /api/test-rds
\`\`\`

---

## License

Proprietary - All rights reserved

---

## Support

For issues or questions:
- Create GitHub issue
- Contact: [your-email]

---

## Acknowledgments

- UMA Protocol for Optimistic Oracle
- Supabase for authentication
- Vercel for hosting
- Radix UI for components
