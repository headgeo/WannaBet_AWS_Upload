# UMA Implementation Status

Last Updated: January 2025

## Current Architecture: Client-Side Wallet Proposals (Proper UMA Pattern)

We're using UMA's OptimisticOracleV3 with **user-initiated wallet transactions** for proposals. This is the correct implementation pattern.

## How It Works

### Step 1: Market Creation (Database Only)
- ✅ Market created in database with `blockchain_status: 'not_deployed'`
- ✅ $10 USDC from creator's balance allocated for reward (tracked in `liquidity_posted_for_reward`)
- ✅ Platform ledger records $10 as platform inflow
- ❌ **NO blockchain transaction** - just database records
- ❌ **NO wallet interaction** - server-side only

### Step 2: Trading Period (Normal Trading)
- ✅ Users trade with platform money (not blockchain)
- ✅ LMSR pricing updates automatically
- ✅ All transactions recorded in database

### Step 3: Market Expiry (Just Time Passing)
- ⏰ Market reaches end_date
- ⏰ Trading automatically closes
- ⏰ "Propose Outcome" button appears in Blockchain UI

### Step 4: Outcome Proposal (**USER'S WALLET - NOT PLATFORM**)
**Current Status: ⚠️ NEEDS WALLET INTEGRATION**

**What Should Happen:**
1. User clicks "Propose Outcome" button
2. User connects MetaMask/wallet to the app
3. User selects YES or NO in modal
4. **Client-side transaction happens:**
   - User's wallet approves $500 USDC to OptimisticOracleV3
   - User's wallet calls `assertTruth()` with their claim
   - Platform contributes $10 reward (from platform wallet via backend)
   - Transaction hash stored in database
5. Market status → `proposal_pending`
6. 2-hour challenge period starts

**What Currently Happens (WRONG):**
- ❌ Server-side call with platform wallet
- ❌ Platform pays $500 bond (should be user)
- ❌ No wallet connection for users
- ❌ Not decentralized

### Step 5: Challenge Period (2 Hours)
- ⏳ Anyone can dispute on-chain
- ⏳ If disputed, UMA's DVM resolves
- ⏳ If not disputed, assertion becomes truth

### Step 6: Settlement (After 2 Hours)
- ✅ Anyone calls `settleAssertion()` on-chain
- ✅ Proposer receives $500 bond back + $10 reward
- ✅ App reads outcome and settles market in database
- ✅ Winners get payouts
- ✅ Leftover liquidity → platform ledger

## Current Status

### ✅ Completed

1. **Database Schema**
   - All UMA tracking columns in place
   - Platform ledger system working
   - Settlement flow implemented

2. **UI Components**
   - Blockchain status card with "Propose Outcome" button
   - Proposal modal with YES/NO selection
   - Clear explanation of $500 bond requirement

3. **Server Actions (Platform Wallet)**
   - `proposeUMAOutcome()` - Calls assertTruth (currently from server, WRONG)
   - `finalizeUMASettlement()` - Calls settleAssertion
   - Platform ledger tracking

4. **Trading & Settlement**
   - LMSR trading working
   - Notifications working
   - Settlement distribution working

### ⚠️ CRITICAL MISSING: Wallet Integration

**What's Needed:**
1. **Add wagmi/viem for Web3**
   \`\`\`bash
   npm install wagmi viem @rainbow-me/rainbowkit
   \`\`\`

2. **Wallet Connection Provider**
   - Wrap app in WagmiConfig
   - Add "Connect Wallet" button
   - Show connected wallet address

3. **Client-Side Proposal Function**
   - Replace server-side `proposeUMAOutcome()`
   - User signs transaction in their wallet
   - Frontend calls blockchain directly
   - Backend only contributes $10 reward

4. **Environment Split**
   - Platform wallet (backend) - Only for $10 reward
   - User wallet (frontend) - For $500 bond and assertTruth call

### 🚧 Next Steps (Pre-Wallet Integration)

**Code Structure Changes Made:**
- ✅ Proposal dialog clearly shows $500 comes from user
- ✅ UI indicates wallet connection will be needed
- ✅ Backend code marked for future wallet integration
- ✅ Placeholder comments where wallet logic goes

**Ready for Wallet Integration:**
- Frontend UI prepared
- Modal explains bond requirements clearly
- Error handling in place
- Transaction flow mapped out

### ⏸️ Parked Until Wallet Integration

1. **Test Full Proposal Flow**
   - Can't test without user wallets
   - Need MetaMask integration
   - Need client-side Web3 calls

2. **Mainnet Deployment**
   - Wallet integration required first
   - Then test on Amoy with real wallets
   - Finally deploy to Polygon mainnet

## Payment Flow (Final Architecture)

### Market Creation
- ✅ Platform: Approve $10 USDC for future reward (backend)
- ✅ Cost: ~$0.10-0.50 gas

### Outcome Proposal
- ✅ User: Approve $500 USDC to OOv3 (frontend wallet)
- ✅ User: Call assertTruth() with claim (frontend wallet)
- ✅ Platform: Contribute $10 reward (backend)
- ✅ Cost: $500 bond + gas (user pays)

### After 2 Hours
- ✅ User gets: $500 bond back + $10 reward
- ✅ Platform pays: Just $10 per market (sustainable!)

## Network Configuration

### Amoy Testnet (Current)
- Network: Polygon Amoy Testnet
- Chain ID: 80002
- OptimisticOracleV3: `0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB`
- USDC (Mock): `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- Explorer: https://amoy.polygonscan.com

### Polygon Mainnet (Future)
- Network: Polygon
- Chain ID: 137
- OptimisticOracleV3: `0xfb55F43fB9F48F63f9269DB7Dde3BbBe1ebDC0dE`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- Explorer: https://polygonscan.com

## Testing Checklist (Post-Wallet Integration)

### Amoy Testnet
- [ ] Install wagmi/viem/RainbowKit
- [ ] Add wallet connection to app
- [ ] Create public market
- [ ] Connect user wallet
- [ ] User proposes outcome (pays $500 from wallet)
- [ ] Verify assertion on PolygonScan
- [ ] Wait 2 hours
- [ ] Settle and verify user receives $510 ($500 + $10)

## Key Architecture Decisions

### Why Client-Side Proposals?
1. **Decentralization** - Users participate directly on-chain
2. **Scalability** - Platform doesn't need $500 per market
3. **Security** - User controls their own bond
4. **Incentives** - Users earn rewards for honest proposals

### Why $10 From Platform?
- Small cost to subsidize decentralized settlement
- Incentivizes users to propose outcomes
- Much cheaper than hiring oracle admins
- Scales to millions of markets

### Why Not Deploy Market Contracts?
- UMA's OOv3 is designed for direct assertions
- No need for custom contracts
- Lower gas costs
- Simpler architecture
- Easy to upgrade
</output>
</result>
