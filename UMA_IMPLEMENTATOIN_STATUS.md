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

### Phase 5: Amoy Testnet Deployment ✓
- Created deployment script for Polygon Amoy testnet
- Deployed all contracts to Amoy successfully
- Updated configuration with Amoy contract addresses
- Created comprehensive deployment guide
- Updated environment variable examples

**Deployed Contracts (Amoy):**
- MockERC20 (USDC): `0xfBfB1b295fb11e73cfDbE3CF0e047aDC838fCE9b`
- CollateralVault: `0x5Cc9e2925D383d26527D64f7c17de7a03a96Eb09`
- UMAOracleAdapter: `0x2bC62134BD9c33da2044DF1fd0275FA743Deb8E7`
- MarketFactory: `0x7C4568517b91556838112A8F44CDB20C93371e34`
- UMA OptimisticOracleV3 (existing): Verified on Amoy testnet

**Files:**
- `blockchain/scripts/deploy-amoy.js`
- `AMOY_DEPLOYMENT_GUIDE.md`
- `lib/blockchain/config.ts` - Updated with Amoy addresses
- `.env.local.example` - Updated with Amoy variables

### Phase 6: Feature Flag System ✓
- Created feature flag system for controlling blockchain functionality
- Implemented three independent flags: deployment, settlement, and UI visibility
- Built safe wrapper functions that check flags before executing
- Created comprehensive documentation for feature flags

**Feature Flags:**
- `NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT` - Auto-deploy markets to blockchain
- `NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT` - Enable UMA settlement flow
- `NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI` - Show blockchain UI elements

**Files:**
- `lib/blockchain/feature-flags.ts` - Feature flag utilities
- `app/actions/blockchain-wrapper.ts` - Safe wrapper functions
- `BLOCKCHAIN_FEATURE_FLAGS.md` - Documentation

### Phase 7: Blockchain UI Components ✓
- Created BlockchainStatus component showing deployment and settlement status
- Added blockchain status card to market detail pages
- Implemented "Request UMA Settlement" button (feature-flagged)
- Implemented "Propose Outcome on UMA Oracle" button with redirect (feature-flagged)
- Shows blockchain address with PolygonScan link
- Displays UMA settlement status and liveness period

**Files:**
- `components/blockchain-status.tsx` - Main status component
- `app/market/[id]/market-detail-client.tsx` - Integrated into market page

---

## 🚧 Current Phase: Phase 2 (Auto-Deploy Markets) - READY FOR IMPLEMENTATION

### Status: Infrastructure Complete, Feature Flags Enabled

All the infrastructure is in place and ready to go. The feature flag system allows you to:
- **Currently**: UI is visible but blockchain operations are disabled
- **When ready**: Flip `ENABLE_BLOCKCHAIN_DEPLOYMENT=true` to start auto-deploying markets

**What's Already Built:**
- ✅ Amoy testnet deployment complete
- ✅ Feature flag system implemented
- ✅ Blockchain UI components created
- ✅ Safe wrapper functions for all blockchain operations
- ✅ Database schema ready
- ✅ All smart contracts tested and deployed

**To Enable Auto-Deploy (When Ready):**
1. Update `.env.local`: `NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT=true`
2. The system will automatically deploy public markets on creation
3. All UI elements are already built and ready

---

## 📋 Next Implementation Phases

### Phase 8: Auto-Deploy Markets on Creation (READY TO ENABLE)

**Current Status:** Code is implemented with feature flags OFF

When user creates a public market, automatically deploy on-chain version:

**Already Implemented:**
- `app/actions/markets.ts` - Has background deployment logic
- Feature flag check before deployment
- Database updates for blockchain_address
- Error handling and logging

**To Activate:**
1. Set `NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT=true`
2. Test with a public market creation
3. Verify deployment transaction on PolygonScan
4. Confirm database updated with blockchain_address

**Edge Cases to Test:**
- Failed deployment (low gas, network issues)
- Retry mechanism works correctly
- Private markets don't deploy (only public)
- Multiple markets created simultaneously

---

### Phase 9: Settlement Request Flow (TODO)

Allow admin/creator to request UMA settlement when market closes:

**Implementation:**
1. Update `app/actions/blockchain-wrapper.ts`
   - `requestUMASettlement()` function exists
   - Enable feature flag when ready
   - Verify market is closed before calling

2. Database updates:
   - Store `uma_request_tx_hash`
   - Store `uma_requested_at` timestamp
   - Update status to `pending_settlement`

**Access Control:**
- Only market creator or platform admins
- Only if market is closed
- Only if blockchain_address exists

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

### Phase 11: UMA Oracle Interface URL Research (TODO)

Need to determine the correct UMA oracle interface URL for Amoy testnet:

**Research Tasks:**
1. Find UMA's official oracle interface for testnets
2. Determine URL structure: `https://oracle.uma.xyz/propose/{chainId}/{address}`
3. Test URL opens correctly and shows market
4. Add fallback if UMA doesn't have testnet interface yet

**Alternative:**
- If no testnet UI exists, interact directly with contracts via PolygonScan
- Document the manual process for proposing outcomes

---

## 🎯 Testing Roadmap

### Amoy Testnet Testing (IN PROGRESS)
- [x] Get test MATIC from faucet
- [x] Deploy contracts to Amoy
- [x] Verify contracts on PolygonScan
- [x] Update configuration with deployed addresses
- [x] Build feature flag system
- [x] Build blockchain UI components
- [ ] Enable auto-deploy flag
- [ ] Create public market on platform
- [ ] Verify auto-deployment works
- [ ] Execute test trades
- [ ] Request UMA settlement
- [ ] Research UMA oracle interface URL
- [ ] Propose outcome (via UMA or PolygonScan)
- [ ] Wait for real liveness period (2 hours)
- [ ] Build monitoring service
- [ ] Test automatic settlement detection
- [ ] Verify payouts distributed correctly

---

## 💡 Why This Architecture Works

### Advantages:

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
   - Users familiar with UMA know the interface
   - Professional dispute resolution
   - Established trust in UMA's process
   - Platform focuses on trading

5. **Scalable & Cost-Effective**
   - Trading is off-chain (free, fast)
   - Only settlement touches blockchain (~$1 per market)
   - Can handle thousands of trades without gas costs
   - Polygon is 100x cheaper than Ethereum

---

## 📝 Current Status Summary

**What's Working:**
- ✅ Smart contracts fully developed and tested locally
- ✅ Amoy testnet deployment complete
- ✅ Database schema ready
- ✅ Backend integration layer complete
- ✅ Feature flag system implemented
- ✅ Blockchain UI components created
- ✅ Safe wrapper functions for all operations

**What's Next:**
- Enable auto-deploy flag when ready to test
- Build settlement monitoring service
- Research UMA oracle interface URLs
- Test full lifecycle on Amoy testnet
- Polish UI and error handling

**Timeline Estimate:**
- Enable and test auto-deploy: 1-2 days
- Build monitoring service: 2-3 days
- Research UMA interface: 1 day
- Full Amoy testing: 3-5 days
- Polish and edge cases: 2-3 days
- **Total: 1-2 weeks to production-ready**

---

## 🔗 Useful Resources

- UMA Documentation: https://docs.uma.xyz/
- UMA Oracle (Production): https://oracle.umaproject.org/
- Polygon Amoy Faucet: https://faucet.polygon.technology/
- Polygon Amoy Explorer: https://amoy.polygonscan.com/
- Polygon RPC: https://rpc-amoy.polygon.technology
- Hardhat Documentation: https://hardhat.org/docs

**Deployed Contracts:**
- MarketFactory: https://amoy.polygonscan.com/address/0x7C4568517b91556838112A8F44CDB20C93371e34
- UMAOracleAdapter: https://amoy.polygonscan.com/address/0x2bC62134BD9c33da2044DF1fd0275FA743Deb8E7
- CollateralVault: https://amoy.polygonscan.com/address/0x5Cc9e2925D383d26527D64f7c17de7a03a96Eb09
- MockUSDC: https://amoy.polygonscan.com/address/0xfBfB1b295fb11e73cfDbE3CF0e047aDC838fCE9b
