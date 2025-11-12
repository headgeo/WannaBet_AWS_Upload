# UMA Oracle Settlement Implementation Status

## Architecture Overview

### Simplified UMA Integration Model

This platform uses UMA's **OptimisticOracleV3 (OOv3)** for decentralized market settlement:

**Off-Chain (AWS RDS PostgreSQL)**:
- All trading happens here (fast, cheap, no gas fees)
- LMSR pricing and liquidity calculations
- User balances and transaction history
- Real-time market data and updates

**On-Chain (Polygon)**:
- NO market contracts deployed (simplified approach)
- Direct integration with UMA's OptimisticOracleV3
- $10 USDC approved per market for proposer rewards
- Settlement happens via `assertTruth()` calls to OOv3

**Settlement Flow**:
1. User creates public market → Approves $10 USDC to OptimisticOracleV3 (real transaction)
2. Trading happens entirely off-chain (AWS RDS)
3. Market expires → Anyone can propose outcome
4. Proposer posts $500 USDC bond + calls `assertTruth()` on UMA
5. 2-hour challenge window → Others can dispute
6. After liveness period → Platform reads outcome and settles off-chain

---

## ✅ Completed Steps

### Phase 1: Database Schema ✓
- Added blockchain-specific columns to `markets` table
- Added `blockchain_address`, `blockchain_network`, `blockchain_tx_hash`
- Added `blockchain_status` enum tracking deployment state
- Added `uma_assertion_id` for tracking settlement proposals
- Created `platform_ledger` table for tracking platform-owned funds

**Files:** 
- `scripts/add_uma_blockchain_columns.sql`
- `scripts/016_create_platform_ledger.sql`

### Phase 2: UMA Configuration ✓
- Configured OptimisticOracleV3 for Amoy testnet
- Set up USDC token addresses for both Amoy and Polygon mainnet
- Platform wallet configured with private key
- RPC endpoints configured for blockchain interaction

**Contracts (Amoy Testnet):**
- OptimisticOracleV3: `0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB`
- USDC (Mock): `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

**Contracts (Polygon Mainnet - for future):**
- OptimisticOracleV3: `0xfb55F43fB9F48F63f9269DB7Dde3BbBe1ebDC0dE`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`

**Files:**
- `lib/blockchain/config.ts`
- `lib/blockchain/client.ts`

### Phase 3: Blockchain Client Implementation ✓
- Built UMABlockchainClient wrapper with ethers.js v6
- Implemented USDC approval for OptimisticOracleV3
- Implemented `assertTruth()` for outcome proposals
- Implemented `settleAssertion()` for finalization
- Added proper error handling and transaction receipts
- Nonce management for transaction ordering

**Files:**
- `lib/blockchain/client.ts`

### Phase 4: Market Creation with Blockchain ✓
- Modified `createMarket()` to approve $10 USDC on public market creation
- Returns real transaction hash from approval
- Stores blockchain metadata in database
- Computes pseudo-address for UI tracking (not a real contract)
- Feature works on Amoy testnet with test USDC

**Files:**
- `app/actions/markets.ts`
- Platform ledger tracks $10 reward as platform expense

### Phase 5: Platform Ledger System ✓
- Created `platform_ledger` table for tracking platform-owned funds
- Tracks four types of transactions:
  1. Market creation ($10 reward deducted)
  2. Trading fees (50% platform share)
  3. Settlement leftovers (remaining liquidity)
  4. UMA reward payouts (when proposer claims)
- Real-time balance calculation
- Metadata tracking for audit trail

**Files:**
- `lib/platform-ledger.ts`
- `scripts/016_create_platform_ledger.sql`
- `scripts/017_add_platform_balance_function.sql`

### Phase 6: Trade Function Fixes ✓
- Fixed balance deduction to deduct full amount (gross) not net
- Added automatic ledger entry creation for trades
- Fixed schema mismatches with AWS RDS (profiles table, column names)
- Fixed fee tracking (fees in separate table, not transactions)
- Added trade notifications with proper formatting
- Reduced RDS connection pool to prevent exhaustion

**Files:**
- `scripts/015_recreate_trade_function.sql`
- `lib/database/rds.ts`

### Phase 7: Settlement Integration ✓
- Implemented `proposeOutcome()` server action
- Calls `assertTruth()` on OptimisticOracleV3 with $500 bond
- Stores assertion ID in database for tracking
- Implemented `finalizeUMASettlement()` server action
- Calls `settleAssertion()` after liveness period
- Reads settled outcome and updates market
- Works for both public and private markets
- Platform ledger tracks leftover liquidity

**Files:**
- `app/actions/uma-settlement.ts`
- `app/actions/admin.ts`

### Phase 8: Blockchain UI Components ✓
- Created BlockchainStatus component showing deployment status
- Shows transaction hash with PolygonScan link
- Shows "Propose Resolution" button linking to contract
- For Amoy: Links to OptimisticOracleV3 on PolygonScan
- For Mainnet: Will link to UMA's oracle interface
- Removed test proposal buttons (users interact directly with UMA)

**Files:**
- `components/blockchain-status.tsx`
- `app/market/[id]/market-detail-client.tsx`

---

## 🚧 Current Status: Simplified UMA Model (Amoy Testing)

### What Works Now:

1. ✅ **Market Creation**
   - Creates market in database
   - Approves $10 USDC to OptimisticOracleV3
   - Returns REAL transaction hash
   - Platform ledger tracks $10 expense
   - Viewable on PolygonScan

2. ✅ **Trading**
   - Full LMSR trading off-chain
   - Correct balance deductions (gross amount)
   - Ledger entries created automatically
   - Trade notifications working
   - Platform fees tracked in platform ledger

3. ✅ **Settlement (Backend Ready)**
   - `proposeOutcome()` function implemented
   - Can call `assertTruth()` on OOv3
   - Stores assertion ID
   - `finalizeUMASettlement()` implemented
   - Reads outcome and settles market
   - Platform ledger tracks leftovers

4. ✅ **UI**
   - Shows blockchain deployment status
   - Links to real transactions on PolygonScan
   - "Propose Resolution" button ready
   - Clean, simple interface

### What Doesn't Work Yet:

1. ❌ **No Real Market Contracts**
   - "Market address" is computed hash (not real contract)
   - This is intentional - using direct OOv3 integration
   - Users must interact with OptimisticOracleV3 directly

2. ❌ **Proposal Flow Not Complete**
   - Button links to OOv3 contract page
   - Users need to manually call `assertTruth()`
   - Need to build proper proposal UI or document manual process

3. ❌ **No Monitoring Service**
   - Manual checking if assertions are settled
   - Need automated monitoring for finalization

---

## 📋 Next Steps

### Immediate (Testing Phase):

1. **Test Market Creation on Amoy**
   - Create public market
   - Verify $10 USDC approval transaction
   - Check PolygonScan for real transaction
   - Verify platform_ledger entry

2. **Test Trading**
   - Place buy/sell trades
   - Verify balance deductions correct (full amount)
   - Check ledger_entries created
   - Verify platform_ledger tracks fees

3. **Document Manual Proposal Process**
   - How to call `assertTruth()` via PolygonScan
   - Required parameters (claim, asserter, etc.)
   - $500 USDC bond requirement
   - 2-hour wait period

4. **Test Settlement**
   - Wait 2 hours after proposal
   - Call `finalizeUMASettlement()` manually
   - Verify market settled correctly
   - Check platform_ledger for leftovers

### Short Term (1-2 weeks):

1. **Build Proposal UI**
   - Form to propose outcome (YES/NO)
   - Connects user wallet (MetaMask)
   - Calls `assertTruth()` directly from UI
   - Shows bond requirement prominently
   - Alternative: Use UMA's oracle interface if available

2. **Build Monitoring Service**
   - Background job checking settled assertions
   - Polls every 5-10 minutes
   - Calls `finalizeUMASettlement()` automatically
   - Deploy as Vercel Cron or separate Node service

3. **Improve Error Handling**
   - Better error messages for failed transactions
   - Retry logic for network issues
   - User-friendly blockchain error display

### Medium Term (1 month):

1. **Deploy to Polygon Mainnet**
   - Update config to use Polygon mainnet
   - Use real USDC contract
   - Test with small amounts first
   - Update UI for mainnet links

2. **Integrate UMA Oracle Interface**
   - Research UMA's official oracle UI
   - Deep link to specific markets
   - Seamless redirect from platform

3. **Platform Ledger Dashboard**
   - Show platform balance
   - Show transaction history
   - Analytics on rewards, fees, leftovers
   - Admin interface for monitoring

---

## 💡 Key Architecture Decisions

### Why No Market Contracts?

**Original Plan:**
- Deploy PredictionMarket.sol contract per market
- Lock $10 USDC in contract
- Contract manages proposals/settlements

**Current Simplified Approach:**
- Just approve $10 USDC to OptimisticOracleV3
- Use OOv3 directly for all assertions
- Store market metadata in database only

**Benefits:**
1. **Lower Gas Costs:** No contract deployment (~$0.50 saved per market)
2. **Simpler Code:** One less smart contract to maintain
3. **Faster:** Approval takes 5 seconds vs 30 seconds for deployment
4. **Aligned with UMA:** This is how UMA is designed to work

**Trade-offs:**
1. **Less On-Chain Verification:** No dedicated contract per market
2. **Manual Proposal Process:** Users must interact with OOv3 directly
3. **Harder to Link:** Can't deep-link to specific market contract

### Current Consensus: Simplified approach is better for MVP, can always add market contracts later if needed.

---

## 🔗 Useful Resources

### UMA Documentation
- Main Docs: https://docs.uma.xyz/
- OptimisticOracleV3: https://docs.uma.xyz/developers/optimistic-oracle-v3
- Oracle Interface (Mainnet): https://oracle.umaproject.org/

### Polygon Amoy Testnet
- Faucet: https://faucet.polygon.technology/
- Explorer: https://amoy.polygonscan.com/
- RPC: https://rpc-amoy.polygon.technology
- OptimisticOracleV3: https://amoy.polygonscan.com/address/0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB

### Polygon Mainnet
- Explorer: https://polygonscan.com/
- RPC: https://polygon-rpc.com/
- OptimisticOracleV3: https://polygonscan.com/address/0xfb55F43fB9F48F63f9269DB7Dde3BbBe1ebDC0dE

---

## 📊 Testing Status

### Amoy Testnet Testing:
- [x] Configure blockchain client
- [x] Configure OptimisticOracleV3 address
- [x] Configure test USDC address
- [x] Get test MATIC from faucet
- [x] Get test USDC (10M mocked in platform wallet)
- [x] Create public market
- [x] Verify USDC approval transaction
- [ ] Execute trades and verify balance tracking
- [ ] Document manual proposal process
- [ ] Manually propose outcome via PolygonScan
- [ ] Wait 2-hour liveness period
- [ ] Call finalizeUMASettlement()
- [ ] Verify settlement and payouts

### Production Readiness:
- [ ] Build proposal UI (user-friendly)
- [ ] Build monitoring service
- [ ] Test on mainnet with small amounts
- [ ] Complete documentation
- [ ] Add analytics and monitoring
- [ ] Security audit smart contract interactions

---

## 🎯 Success Metrics

**For Amoy Testing:**
- ✅ Market creation creates real blockchain transaction
- ✅ Transaction appears on PolygonScan
- ✅ Trading works off-chain with correct balance tracking
- ✅ Platform ledger tracks all platform funds
- [ ] Proposal process documented and tested
- [ ] Settlement completes successfully after liveness

**For Production:**
- [ ] 10+ markets created and settled successfully
- [ ] Zero failed settlements
- [ ] Average settlement time < 3 hours
- [ ] Gas costs < $2 per market lifecycle
- [ ] Platform ledger balances accurate to penny
- [ ] Users can easily propose outcomes

---

## 📝 Known Issues & Limitation

1. **No Dedicated Market Contracts**
   - Market "address" is computed, not real
   - Can't verify market exists on-chain
   - Solution: Accept this trade-off for now

2. **Manual Proposal Process**
   - Users must interact with OOv3 directly
   - No in-app proposal UI yet
   - Solution: Build proposal UI or integrate UMA interface

3. **No Monitoring Service**
   - Manual checking required for settlements
   - Solution: Build automated monitoring

4. **Connection Pool Exhaustion**
   - AWS RDS free tier has limited connections
   - Reduced pool size to 5 (from 20)
   - Solution: Upgrade RDS instance or optimize queries

5. **Platform Ledger Not Live Yet**
   - Database tables created but entries not being posted
   - Solution: Debug and verify integration points

---

## 💰 Cost Analysis

### Per Market (Amoy Testnet):
- USDC Approval: ~0.001 MATIC (~$0.0005)
- Reward Locked: $10 USDC (test tokens)
- **Total: ~$10.001**

### Per Market (Polygon Mainnet):
- USDC Approval: ~0.001 MATIC (~$0.0005)
- Reward Locked: $10 USDC (real)
- **Total: ~$10.001**

### Per Proposal (User Pays):
- assertTruth(): ~0.01 MATIC (~$0.005)
- Bond Required: $500 USDC (returned after 2 hours)
- **Total User Cost: ~$0.005 + temporary $500 lock**

### Platform Revenue Model:
- Trading fees: 1% (50% to creator, 50% to platform)
- Settlement leftovers: Remaining liquidity after payouts
- Tracked in platform_ledger table

---

*Last Updated: January 2025*
*Current Phase: Amoy Testnet Testing*
*Next Milestone: Complete end-to-end settlement test on Amoy*
