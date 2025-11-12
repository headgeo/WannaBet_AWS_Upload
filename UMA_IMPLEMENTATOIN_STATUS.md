# UMA Implementation Status

Last Updated: January 2025

## Current Implementation: Simple Assertion Model (Option 1)

We're using UMA's OptimisticOracleV3 directly without deploying individual market contracts. This is UMA's recommended approach for simple binary markets.

## Architecture

### On Market Creation
- ✅ Market created in database with `blockchain_status: 'not_deployed'`
- ✅ $10 USDC from creator's balance allocated for reward (tracked in `liquidity_posted_for_reward`)
- ✅ Platform ledger records $10 as platform inflow
- ❌ **NO blockchain transaction yet** - just database records

### On Propose Outcome (User-Initiated)
- ✅ User clicks "Propose Outcome" button after market expires
- ✅ System calls `proposeUMAOutcome()` which calls `assertTruth()` on OptimisticOracleV3:
  - Approves $10 USDC reward from platform wallet
  - User posts $500 USDC bond from their wallet
  - Creates assertion with 2-hour challenge period
- ✅ Stores `assertionId` in `uma_request_id` column
- ✅ Sets `blockchain_status: 'proposal_pending'`
- ✅ Transaction hash visible on PolygonScan

### During Challenge Period (2 Hours)
- ⏳ Anyone can dispute the assertion on-chain
- ⏳ If disputed, UMA's DVM resolves the dispute
- ⏳ If not disputed, assertion becomes truth

### On Settlement Finalization
- ✅ Anyone calls `finalizeUMASettlement()` after 2 hours
- ✅ Calls `settleAssertion()` on OptimisticOracleV3
- ✅ Proposer receives:
  - $500 bond returned
  - $10 reward from platform
- ✅ System reads outcome and settles market in database
- ✅ Winner payouts distributed via `settle_market` SQL function
- ✅ Leftover liquidity goes to platform ledger

## Current Status

### ✅ Completed

1. **Database Schema**
   - `blockchain_status` column (not_deployed/proposal_pending/settled)
   - `uma_request_id` for storing assertionId
   - `uma_liveness_ends_at` for challenge period tracking
   - `liquidity_posted_for_reward` for $10 reward tracking

2. **Platform Ledger System**
   - Tracks platform-owned money
   - Records $10 inflows on market creation
   - Records settlement leftovers
   - Records $10 reward payouts to proposers
   - Files: `lib/platform-ledger.ts`, `scripts/016_create_platform_ledger.sql`

3. **Blockchain Integration**
   - OptimisticOracleV3 client configured for Amoy testnet
   - `proposeUMAOutcome()` action calls `assertTruth()`
   - `finalizeUMASettlement()` calls `settleAssertion()`
   - Transaction hashes tracked in database

4. **UI Components**
   - BlockchainStatus component shows deployment state
   - "Propose Outcome" button for expired markets (not_deployed status)
   - Challenge period countdown display
   - Links to PolygonScan for verification

5. **Trade & Settlement**
   - Fixed trade function (deducts full amount including fees)
   - Notifications for trades
   - Settlement distribution with leftover tracking
   - Platform ledger integration for both public and private markets

### 🚧 In Progress / Testing

1. **Amoy Testnet Testing**
   - Need to test full flow: create → expire → propose → settle
   - Verify $10 reward and $500 bond mechanism
   - Verify challenge period enforcement
   - Test end-to-end with real Amoy transactions

2. **Environment Variables**
   - ✅ `BLOCKCHAIN_PRIVATE_KEY` - Platform wallet private key
   - ✅ `BLOCKCHAIN_NETWORK` - Set to 'amoy' for testing
   - ❌ Need to verify these work in Vercel deployment

### ⏸️ Future Enhancements

1. **Proposal UX**
   - Better outcome selection UI (modal instead of confirm dialog)
   - Show bond requirements upfront with balance check
   - Connect wallet integration for MetaMask/WalletConnect
   - Real-time bond balance verification

2. **Monitoring & Automation**
   - Background service to monitor assertions
   - Auto-settle after liveness period
   - Alert system for disputes
   - Handle disputed outcomes

3. **Mainnet Deployment**
   - Switch to Polygon mainnet
   - Update contract addresses
   - Link to UMA's oracle interface (oracle.uma.xyz)
   - Real USDC instead of test tokens

## Network Configuration

### Amoy Testnet (Current)
- Network: Polygon Amoy Testnet
- Chain ID: 80002
- OptimisticOracleV3: `0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB`
- USDC (Mock): `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- RPC: Public Amoy RPC
- Explorer: https://amoy.polygonscan.com

### Polygon Mainnet (Future)
- Network: Polygon
- Chain ID: 137
- OptimisticOracleV3: `0xfb55F43fB9F48F63f9269DB7Dde3BbBe1ebDC0dE`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- RPC: Polygon mainnet RPC
- Explorer: https://polygonscan.com

## Key Differences from Previous Approach

### What Changed
- ❌ Removed MarketFactory contract deployment
- ❌ Removed UMAAdapter contract
- ❌ Removed individual PredictionMarket contracts
- ✅ Now using OptimisticOracleV3 directly
- ✅ Simpler, cheaper, follows UMA's design
- ✅ No blockchain transaction on market creation
- ✅ First transaction happens when user proposes outcome

### Why This is Better
1. **Lower Initial Cost**: No approval transaction on market creation
2. **Simpler**: Direct oracle interaction, no custom contracts
3. **Standard**: Follows UMA's recommended pattern
4. **Flexible**: Easy to upgrade without contract migrations
5. **User-Initiated**: Users control when blockchain costs occur

## Testing Checklist

### Amoy Testnet
- [ ] Create public market with $20 liquidity
- [ ] Verify market shows "Not Deployed" in UI
- [ ] Place trades and verify trading works
- [ ] Wait for market to expire
- [ ] Click "Propose Outcome" button
- [ ] Verify assertion transaction on PolygonScan
- [ ] Wait 2 hours (or test with shorter liveness)
- [ ] Call `finalizeUMASettlement()` and verify settlement
- [ ] Check winner payouts and platform ledger entries

### Production Readiness
- [ ] Test with real USDC on Polygon mainnet
- [ ] Verify $500 bond mechanism
- [ ] Test dispute handling
- [ ] Monitor gas costs
- [ ] Set up proper error handling and retries
- [ ] Add monitoring for stuck assertions

## Notes
- Platform wallet needs sufficient POL for gas fees
- Platform wallet needs $10 USDC per public market for rewards
- Proposers need $500 USDC + gas to propose outcomes
- Challenge period is 2 hours (7200 seconds)
- Test network may have shorter liveness periods
- Platform ledger tracks all platform-owned money flows
