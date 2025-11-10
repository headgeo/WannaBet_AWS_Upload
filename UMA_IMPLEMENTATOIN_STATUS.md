# UMA Oracle Settlement Implementation Status

## Architecture Overview

### Hybrid Model: Off-Chain Trading + On-Chain Settlement

This platform uses a **Polymarket-style hybrid architecture**:

**Off-Chain (AWS RDS)**:
- All trading happens here (fast, cheap, no gas fees)
- LMSR pricing and liquidity calculations
- User balances and transaction history
- Real-time market data and updates

**On-Chain (Polygon)**:
- Market contracts deployed for settlement verification
- UMA Optimistic Oracle integration for decentralized resolution
- NO trading occurs on-chain (too expensive)
- Settlement results are read and applied to off-chain balances

**Settlement Flow**:
1. User creates public market → Auto-deploys on-chain version
2. Trading happens entirely off-chain (AWS RDS)
3. Market closes → Request UMA settlement on-chain
4. Users propose outcomes on UMA's oracle interface (off-platform)
5. After liveness period → Background monitor detects resolution
6. Platform reads outcome and settles off-chain market automatically

---

## ✅ Completed Steps

### Phase 1: Database Schema ✓
- Added blockchain-specific columns to `markets` table
- Created `blockchain_transactions` table for logging all blockchain interactions
- Added proper transaction types for UMA operations
- Database prepared for storing blockchain addresses and settlement status

**Files:** `scripts/add_uma_blockchain_columns.sql`

### Phase 2: Smart Contract Development ✓
- Created Market.sol with UMA integration
- Created UMAOracleAdapter.sol for oracle communication
- Created MarketFactory.sol for deployment management
- Created CollateralVault.sol for fund management
- Created MockERC20.sol for local testing

**Contracts deployed locally:**
- CollateralVault: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- UMAOracleAdapter: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- MarketFactory: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- MockERC20 (USDC): Deployed with 1M tokens for testing

**Files:** 
- `blockchain/contracts/*.sol`
- `blockchain/scripts/deploy-local.js`
- `blockchain/hardhat.config.js`

### Phase 3: Backend Integration Layer ✓
- Created blockchain configuration for localhost, Amoy, and Polygon
- Built UMABlockchainClient wrapper for all blockchain operations
- Implemented settlement actions (deploy, request, finalize)
- Added contract ABIs for all contracts
- Created database adapter with RPC function support

**Files:**
- `lib/blockchain/config.ts` - Network configuration
- `lib/blockchain/client.ts` - Ethers.js wrapper with nonce management
- `lib/blockchain/abis/` - Contract ABIs
- `app/actions/uma-settlement.ts` - Server actions
- `lib/database/adapter.ts` - RPC function support for settle_market

### Phase 4: Local Testing Infrastructure ✓
- Created comprehensive test script for full UMA flow
- Tests: deploy → trade → close → request → propose → wait → finalize → settle
- Verified end-to-end flow works on local Hardhat network
- Fixed bugs in proposeOutcome, USDC handling, and settlement logic
- Added proper cleanup and exit handling

**Files:**
- `scripts/test-uma-flow.ts` - Complete E2E test
- Successfully tested full lifecycle locally

### Phase 5: Amoy Testnet Deployment Scripts ✓
- Created deployment script for Polygon Amoy testnet
- Added npm scripts for easy deployment and verification
- Updated configuration with verified UMA OptimisticOracleV3 address on Amoy
- Created comprehensive deployment guide
- Updated environment variable examples

**Files:**
- `blockchain/scripts/deploy-amoy.js` - Testnet deployment
- `AMOY_DEPLOYMENT_GUIDE.md` - Step-by-step instructions
- `.env.local.example` - Updated with Amoy variables
- `package.json` - Added deployment scripts

**UMA Oracle Address (Amoy)**: `0x... (to be fetched from deployment)`

---

## 🚧 Current Phase: Amoy Testnet Testing

### Phase 6: Deploy to Amoy Testnet (IN PROGRESS)

**Next Steps:**
1. Get test MATIC from Polygon Amoy faucet
2. Deploy contracts to Amoy using `npm run blockchain:deploy:amoy`
3. Verify contracts on PolygonScan
4. Update `.env.local` with deployed contract addresses
5. Test deployment by creating a market on-chain

**Resources:**
- Faucet: https://faucet.polygon.technology/
- Explorer: https://amoy.polygonscan.com/
- RPC: https://rpc-amoy.polygon.technology

---

## 📋 Implementation Roadmap

### Phase 7: Auto-Deploy Markets on Creation (TODO)

When user creates a public market, automatically deploy on-chain version:

**Implementation:**
1. Update `app/actions/create-market.ts`
   - After market creation succeeds
   - Check if market is public
   - Trigger `deployMarketToBlockchain(marketId)` asynchronously
   - Don't block user flow (happens in background)

2. Database updates:
   - Mark market as `blockchain_pending` during deployment
   - Update to `blockchain_deployed` when confirmed
   - Store blockchain_address and transaction hash

**Edge Cases:**
- Retry mechanism for failed deployments (3 attempts)
- Queue system if blockchain is temporarily unavailable
- Admin alert if deployment fails after retries
- Private markets: NEVER deploy (only public markets)

**Files to create/modify:**
- `app/actions/create-market.ts` (add auto-deploy logic)
- `app/actions/uma-settlement.ts` (ensure deployMarketToBlockchain works with Amoy)

---

### Phase 8: Settlement Request Flow (TODO)

Allow admin/creator to request UMA settlement when market closes:

**Implementation:**
1. Create `app/actions/request-uma-settlement.ts`
   - Verify market is closed (past end_time)
   - Get blockchain address from database
   - Call `market.requestOracleResolution()` on-chain
   - Update database status to `pending_settlement`
   - Store UMA request timestamp

2. Database updates:
   - Add `uma_request_tx_hash` column
   - Store `uma_requested_at` timestamp
   - Update status to `pending_settlement`

**Access Control:**
- Only market creator or platform admins can request settlement
- Only works if market is closed
- Only works if market has blockchain_address

**Files to create:**
- `app/actions/request-uma-settlement.ts`

---

### Phase 9: UMA Oracle Redirect (TODO)

Redirect users to UMA's official oracle interface for proposals:

**UMA Oracle URL Format:**
\`\`\`
https://oracle.uma.xyz/propose/80002/<marketAddress>
\`\`\`

**Implementation:**
1. Update `app/markets/[id]/page.tsx`
   - Show "Propose Outcome on UMA Oracle" button
   - Only visible when status is `pending_settlement`
   - Button opens UMA URL in new tab
   - Display helper text about bond requirements

2. Create informational modal:
   - Explain UMA Optimistic Oracle
   - Explain USDC bond requirement (typically 1000 USDC)
   - Show liveness period (2 hours)
   - Link to UMA documentation
   - Show that ANYONE can propose (not just platform users)

**Important:**
- This is OFF-PLATFORM - users interact directly with UMA
- Platform does NOT handle proposals, disputes, or bonds
- UMA's interface handles all of that
- Platform just provides the link

**Files to modify:**
- `app/markets/[id]/page.tsx` (add redirect button)
- Create: `components/uma-info-modal.tsx`

---

### Phase 10: Settlement Monitoring Service (TODO)

Background service that watches on-chain markets and triggers settlement:

**Architecture:**
\`\`\`
Monitor Service (runs every 1-5 minutes)
  ↓
Query markets with status 'pending_settlement'
  ↓
For each market:
  - Check on-chain: market.resolved() === true?
  - If YES: Read outcome from market.outcome()
  - Call settle_market(market_id, outcome)
  - Update status to 'settled'
\`\`\`

**Implementation:**
1. Create `lib/blockchain/monitor.ts`
   \`\`\`typescript
   export class BlockchainMonitor {
     async checkMarketSettlement(marketId: string)
     async monitorPendingSettlements()
   }
   \`\`\`

2. Create `scripts/monitor-settlements.ts`
   - Long-running Node.js process
   - Polls every 60 seconds
   - Logs all actions
   - Error handling and retries

3. Deployment options:
   - **Option A**: Vercel Cron (serverless, runs every 5 min)
   - **Option B**: Separate Node.js service (more real-time)
   - **Option C**: Manual cron job on server

**Files to create:**
- `lib/blockchain/monitor.ts`
- `scripts/monitor-settlements.ts`
- `app/api/cron/monitor-settlements/route.ts` (if using Vercel Cron)

---

### Phase 11: UI Updates (TODO)

Add blockchain status display and UMA integration to market pages:

**Market Detail Page (`app/markets/[id]/page.tsx`):**

1. **Blockchain Status Section**
   - Show deployment status (pending/deployed/failed)
   - Display blockchain address with PolygonScan link
   - Show network (Localhost/Amoy/Polygon)

2. **Settlement Timeline**
   - Market lifecycle visualization
   - Current stage highlighted
   - Countdown timers for liveness period

3. **Conditional Action Buttons**
   - "Request UMA Settlement" (if closed, not yet requested)
   - "Propose Outcome on UMA Oracle" (if settlement requested)
   - "View on UMA Oracle" (if proposal exists)
   - "Settlement in Progress" (if in liveness period)
   - "Settlement Complete" (if resolved)

**Admin Page Updates (`app/admin/page.tsx`):**
- List of markets pending settlement
- Blockchain transaction history
- Failed deployments requiring attention
- Gas cost tracking

**Files to modify:**
- `app/markets/[id]/page.tsx`
- `app/admin/page.tsx`
- Create: `components/blockchain-status.tsx`
- Create: `components/settlement-timeline.tsx`
- Create: `components/uma-settlement-panel.tsx`

---

### Phase 12: Error Handling & Edge Cases (TODO)

**1. Failed Blockchain Deployments**
- Retry mechanism (3 attempts with exponential backoff)
- Admin notification system
- Manual retry button in UI
- Fallback: Market works without blockchain (admin settles manually)

**2. Network Issues**
- Graceful RPC timeout handling
- Queue settlements if blockchain unavailable
- Display warning in UI if connection fails
- Automatic reconnection attempts

**3. Settlement Conflicts**
- Always trust UMA outcome (never override)
- Admin override only for extreme emergencies (with audit log)
- Clear documentation on dispute process

**4. Gas Price Spikes**
- Monitor gas prices before deployment
- Delay deployment if gas exceeds threshold
- Set reasonable gas limits to prevent failures

**5. User Education**
- Modal explaining UMA oracle process
- FAQ section about settlement
- Links to UMA documentation
- Expected timeline information (2+ hours)

---

## 🔧 Environment Variables

### Required for Amoy Testing:

\`\`\`env
# Network Selection
BLOCKCHAIN_NETWORK=amoy

# RPC URLs
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
LOCALHOST_RPC_URL=http://127.0.0.1:8545

# Private Key (for backend operations)
AMOY_PRIVATE_KEY=your_testnet_wallet_private_key
LOCALHOST_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Contract Addresses (update after deployment)
AMOY_MARKET_FACTORY_ADDRESS=<from_deployment>
AMOY_UMA_ADAPTER_ADDRESS=<from_deployment>
AMOY_COLLATERAL_VAULT_ADDRESS=<from_deployment>
AMOY_MOCK_USDC_ADDRESS=<from_deployment>

# Localhost Addresses (from local testing)
LOCALHOST_MARKET_FACTORY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
LOCALHOST_UMA_ADAPTER_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
LOCALHOST_COLLATERAL_VAULT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
LOCALHOST_MOCK_USDC_ADDRESS=<from_local_deployment>

# Polygon Mainnet (future)
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_PRIVATE_KEY=<production_key>
POLYGON_MARKET_FACTORY_ADDRESS=<from_mainnet_deployment>
POLYGON_UMA_ADAPTER_ADDRESS=<from_mainnet_deployment>
POLYGON_COLLATERAL_VAULT_ADDRESS=<from_mainnet_deployment>
\`\`\`

---

## 🧪 Testing Plan

### Localhost Testing ✅ COMPLETE
- [x] Start Hardhat node
- [x] Deploy contracts locally
- [x] Create test market
- [x] Deploy market to blockchain
- [x] Execute trades (off-chain)
- [x] Request UMA settlement
- [x] Propose outcome (with USDC bond)
- [x] Fast-forward time (2 hours)
- [x] Finalize outcome
- [x] Verify settlement executed
- [x] Verify payouts distributed

### Amoy Testnet Testing (IN PROGRESS)
- [ ] Get test MATIC from faucet
- [ ] Deploy contracts to Amoy
- [ ] Verify contracts on PolygonScan
- [ ] Create public market on platform
- [ ] Verify auto-deployment works
- [ ] Execute test trades
- [ ] Request UMA settlement
- [ ] Redirect to UMA oracle (test URL)
- [ ] Manually propose outcome on UMA's site
- [ ] Wait for real liveness period (2 hours)
- [ ] Verify monitor detects resolution
- [ ] Verify automatic settlement triggers
- [ ] Verify payouts distributed correctly

### Polygon Mainnet Testing (FUTURE)
- [ ] Deploy contracts to mainnet
- [ ] Test with small market first
- [ ] Monitor gas costs
- [ ] Verify UMA integration works
- [ ] Test full lifecycle with real users
- [ ] Monitor settlement automation

---

## 💰 Cost Analysis

### Gas Costs (Estimated)

**Polygon Amoy (Testnet):**
- Deploy Market: ~0.5-1 test MATIC
- Request Settlement: ~0.1-0.2 test MATIC
- Mock USDC is free (we control it)

**Polygon Mainnet:**
- Deploy Market: ~$0.50 - $1.00 USD
- Request Settlement: ~$0.10 - $0.20 USD
- Total per market: ~$0.60 - $1.20 USD

**Compare to Ethereum Mainnet:**
- Would cost $50-100 per market
- Polygon is 100x cheaper

### UMA Bonds (Off-Platform):
- Proposers need USDC bond (typically 1000 USDC)
- Refunded if proposal is correct
- Lost if proposal is incorrect and disputed
- Platform does NOT manage bonds
- Users handle bonds directly with UMA

### Scalability:
- 1,000 markets = ~$1,000 in gas costs on Polygon
- vs. $100,000 on Ethereum
- Trading remains free (off-chain)

---

## 🎯 Key Architecture Decisions

### Why This Approach is Better:

1. **Simpler Integration**
   - No complex bond management in platform
   - No USDC approval flows to build
   - No proposal/dispute UI to implement
   - Just deploy → monitor → settle

2. **More Secure**
   - Leverages UMA's battle-tested interface
   - No risk of bugs in custom proposal logic
   - UMA handles all dispute resolution
   - Platform just reads final result

3. **More Decentralized**
   - Anyone can propose outcomes (not just admins)
   - Community-driven settlement
   - No single point of failure
   - Aligns with crypto principles

4. **Better UX for Crypto Users**
   - Users familiar with UMA already know the interface
   - Professional dispute resolution UI
   - Established trust in UMA's process
   - Platform focuses on trading (its strength)

5. **Lower Development Cost**
   - Don't build proposal UI
   - Don't manage USDC deposits
   - Don't handle disputes
   - Focus on what platform does best

### Trade-offs:

- **Dependency**: Relies on UMA's UI being available (but UMA is decentralized, so low risk)
- **User Friction**: Slight redirect experience (but unavoidable with any oracle)
- **Education**: Users need to understand UMA (but we provide clear documentation)

---

## 🔐 Security Considerations

1. **Smart Contract Security**
   - Contracts tested locally with full lifecycle
   - Will audit before mainnet deployment
   - Use OpenZeppelin standards where possible
   - Proper access control (only owner can settle)

2. **Private Key Management**
   - Backend wallet for automated operations
   - Keep private keys in environment variables
   - Never commit to git
   - Use different keys for testnet/mainnet

3. **Settlement Integrity**
   - Always trust UMA outcome (never override)
   - Log all settlement attempts
   - Audit trail in blockchain_transactions table
   - Admin override only with explicit logging

4. **Access Control**
   - Only public markets deploy to blockchain
   - Private markets use existing settlement
   - Only creator/admin can request settlement
   - Anyone can propose on UMA (by design)

---

## 📊 How It Works (Detailed Flow)

### For Public Markets:

**1. Market Creation**
\`\`\`
User creates public market in UI
  ↓
Market saved to AWS RDS (status: 'active')
  ↓
Background job: Deploy Market contract to Polygon
  ↓
Database updated with blockchain_address
  ↓
Market is now live (trading on platform, settlement on-chain)
\`\`\`

**2. Trading Phase**
\`\`\`
Users trade on platform (AWS RDS)
  ↓
LMSR pricing calculates share prices
  ↓
All transactions stored in database
  ↓
NO blockchain interaction (fast & free)
\`\`\`

**3. Market Closes**
\`\`\`
Market reaches end_time
  ↓
Trading stops (status: 'closed')
  ↓
"Request UMA Settlement" button appears
  ↓
Creator/admin clicks button
  ↓
Platform calls market.requestOracleResolution() on-chain
  ↓
Database status: 'pending_settlement'
  ↓
UMA liveness period begins
\`\`\`

**4. Outcome Proposal (OFF-PLATFORM)**
\`\`\`
"Propose Outcome on UMA Oracle" button appears
  ↓
Users click → Redirected to oracle.uma.xyz
  ↓
User connects wallet on UMA's site
  ↓
User proposes outcome (YES or NO)
  ↓
UMA deducts bond (e.g., 1000 USDC)
  ↓
2-hour liveness period starts
  ↓
Anyone can dispute during liveness
  ↓
If no dispute → Outcome finalizes
\`\`\`

**5. Automatic Settlement**
\`\`\`
Monitor service runs every minute
  ↓
Checks: market.resolved() === true?
  ↓
If YES: Read outcome from blockchain
  ↓
Call settle_market(marketId, outcome) in database
  ↓
Existing settlement logic distributes winnings
  ↓
Market status: 'settled'
  ↓
Users see updated balances
\`\`\`

### For Private Markets:

- NO blockchain interaction
- Use existing bond-based settlement
- Admin or voters settle manually
- Settlement logic unchanged

---

## 📝 Current Status Summary

**What's Working:**
- Smart contracts fully developed and tested
- Local testing complete (full E2E flow verified)
- Database schema ready
- Backend integration layer complete
- Deployment scripts ready for Amoy

**What's Next:**
- Deploy to Amoy testnet
- Build auto-deploy functionality
- Create settlement monitoring service
- Build UI components for UMA integration

**Timeline Estimate:**
- Amoy deployment: 1-2 days
- Auto-deploy implementation: 2-3 days
- Monitoring service: 2-3 days
- UI components: 3-5 days
- Testing & polish: 3-5 days
- **Total: 2-3 weeks to production-ready**

---

## 🔗 Useful Resources

- UMA Documentation: https://docs.uma.xyz/
- UMA Oracle Interface: https://oracle.uma.xyz/
- Polygon Amoy Faucet: https://faucet.polygon.technology/
- Polygon Amoy Explorer: https://amoy.polygonscan.com/
- Polygon RPC: https://rpc-amoy.polygon.technology
- Hardhat Documentation: https://hardhat.org/docs
</automated_v0_instructions_reminder>
