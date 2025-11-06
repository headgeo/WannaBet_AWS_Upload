# UMA Oracle Settlement Implementation Status

## ✅ Completed Steps

### Phase 1: Database Schema ✓
- Added blockchain-specific columns to `markets` table
- Created `uma_proposals` table for tracking proposals
- Created `blockchain_transactions` table for logging all blockchain interactions
- Created `uma_disputes` table for tracking disputes
- Added helper functions and views for settlement status

**Files:** `scripts/add_uma_blockchain_columns.sql`

### Phase 2: Smart Contract Deployment ✓
- Deployed contracts to local Hardhat network for testing
- Created deployment scripts with resume capability (saves gas)
- Contracts deployed:
  - CollateralVault: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
  - UMAOracleAdapter: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
  - MarketFactory: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`

**Files:** 
- `blockchain/scripts/deploy.js` (with resume capability)
- `blockchain/scripts/deploy-local.js` (for local testing)
- `blockchain/hardhat.config.js` (updated for Amoy testnet)

### Phase 3: Backend Integration Layer ✓
- Created blockchain configuration with support for Polygon, Amoy, and localhost
- Built UMABlockchainClient wrapper for all blockchain operations
- Implemented UMA settlement server actions (completely separate from internal oracle)
- Added contract ABIs for MarketFactory, Market, UMAOracleAdapter, and ERC20

**Files:**
- `lib/blockchain/config.ts` - Network configuration
- `lib/blockchain/client.ts` - Ethers.js wrapper
- `lib/blockchain/abis/` - Contract ABIs
- `app/actions/uma-settlement.ts` - Server actions for UMA settlement

### Phase 4: Automated Settlement Cron ✓
- Created cron job that runs every 5 minutes
- Automatically detects markets with expired liveness periods
- Finalizes settlement and distributes payouts
- Configured in Vercel for automatic execution

**Files:**
- `app/api/cron/uma-settlement/route.ts`
- `vercel.json` (updated with UMA cron schedule)

---

## 🚧 Next Steps

### Phase 5: Frontend Integration (TODO)

You need to create UI components for users to interact with UMA settlement:

#### 5.1 Update Market Detail Page
Add UMA settlement panel to `app/market/[id]/page.tsx`:
- Show "Deploy to Blockchain" button for new public markets
- Display "Request UMA Settlement" button after market expires
- Show UMA settlement status (resolution requested, proposals, liveness countdown)
- Display "Propose Outcome" button (if < 2 proposals)
- Show proposal history with proposer addresses

#### 5.2 Create UMA Settlement Component
Create `components/uma-settlement-panel.tsx`:
- Display current blockchain status
- Show proposal count (X/2)
- Countdown timer for liveness period
- List of existing proposals
- Action buttons based on market state

#### 5.3 Update Admin Page
Add UMA monitoring section to `app/admin/page.tsx`:
- List markets with pending UMA settlements
- Show liveness countdowns
- Display proposal details
- Manual "Force Settle" button for testing
- Blockchain transaction logs

---

## 🔧 Environment Variables Needed

Add these to your root `.env` file:

\`\`\`env
# Which network to use (localhost for testing, amoy for testnet, polygon for production)
BLOCKCHAIN_NETWORK=localhost

# RPC URLs
LOCALHOST_RPC_URL=http://127.0.0.1:8545
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RPC_URL=https://polygon-rpc.com

# Backend wallet for automated operations
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here

# Localhost contract addresses (from deployment)
LOCALHOST_COLLATERAL_VAULT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
LOCALHOST_UMA_ADAPTER_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
LOCALHOST_MARKET_FACTORY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# Amoy contract addresses (add after deploying to Amoy)
AMOY_COLLATERAL_VAULT_ADDRESS=
AMOY_UMA_ADAPTER_ADDRESS=
AMOY_MARKET_FACTORY_ADDRESS=

# Polygon contract addresses (add after deploying to mainnet)
POLYGON_COLLATERAL_VAULT_ADDRESS=
POLYGON_UMA_ADAPTER_ADDRESS=
POLYGON_MARKET_FACTORY_ADDRESS=

# Cron job security
CRON_SECRET=your_random_secret_here
\`\`\`

---

## 🧪 Testing Checklist

### Local Testing (Hardhat Network)
- [ ] Start local Hardhat node: `npx hardhat node`
- [ ] Deploy contracts: `npx hardhat run scripts/deploy-local.js --network localhost`
- [ ] Create a test public market in your app
- [ ] Call `deployMarketToBlockchain(marketId)` from backend
- [ ] Verify market address is saved in database
- [ ] Wait for market to expire (or manually set end_date in past)
- [ ] Call `initiateUMASettlement(marketId)`
- [ ] Verify resolution request is recorded
- [ ] Call `proposeUMAOutcome(marketId, true, proposerAddress)`
- [ ] Verify proposal is recorded and liveness starts
- [ ] Wait 2 hours (or manually update `uma_liveness_ends_at` in database)
- [ ] Run cron job manually: `curl http://localhost:3000/api/cron/uma-settlement`
- [ ] Verify market is settled and payouts distributed

### Amoy Testnet Testing
- [ ] Get testnet MATIC from faucet
- [ ] Deploy contracts to Amoy: `npx hardhat run scripts/deploy.js --network amoy`
- [ ] Update environment variables with Amoy contract addresses
- [ ] Set `BLOCKCHAIN_NETWORK=amoy`
- [ ] Repeat all local testing steps on Amoy
- [ ] Verify transactions on Amoy block explorer

### Production Deployment
- [ ] Deploy contracts to Polygon mainnet
- [ ] Update environment variables with mainnet addresses
- [ ] Set `BLOCKCHAIN_NETWORK=polygon`
- [ ] Test with small market first
- [ ] Monitor cron job logs
- [ ] Verify settlements are working correctly

---

## 📊 How It Works

### For Public Markets:

1. **Market Creation**
   - User creates a public market
   - Backend automatically deploys Market contract to blockchain
   - Market address saved in `blockchain_market_address` column

2. **Settlement Initiation**
   - After market expires, anyone can request UMA settlement
   - Calls `initiateUMASettlement(marketId)`
   - Market status changes to "resolution_requested"
   - UMA request ID saved in database

3. **Outcome Proposals**
   - Anyone with 1000 USDC can propose an outcome (YES or NO)
   - Maximum 2 proposals allowed
   - Each proposal starts a 2-hour liveness period
   - Proposals recorded in `uma_proposals` table

4. **Liveness Period**
   - During liveness, anyone can dispute a proposal
   - If disputed, UMA governance decides the outcome
   - If no dispute, proposal is accepted after 2 hours

5. **Automatic Settlement**
   - Cron job runs every 5 minutes
   - Checks for markets with expired liveness periods
   - Automatically settles market and distributes payouts
   - Uses existing `settle_market` RPC function for payout logic

### For Private Markets:

- Continue using existing bond-based settlement system
- No blockchain interaction required
- Settlement logic unchanged

---

## 🔐 Security Considerations

1. **Bond Management**
   - Users must approve USDC spending before proposing
   - Frontend should check balance and allowance
   - Backend verifies bond transfer succeeded

2. **Access Control**
   - Only allow settlement requests after market expiry
   - Enforce max 2 proposals at smart contract level
   - Validate proposer has sufficient USDC

3. **Error Handling**
   - Handle blockchain transaction failures gracefully
   - Implement retry logic for failed RPC calls
   - Log all blockchain interactions
   - Provide clear error messages to users

4. **Cron Job Security**
   - Protect cron endpoint with `CRON_SECRET`
   - Only Vercel can trigger automated settlements
   - Log all settlement attempts

---

## 💰 Cost Analysis

### Gas Costs (Polygon Mainnet):
- Deploy Market: ~$0.50 - $1.00
- Request Resolution: ~$0.10 - $0.20
- Propose Outcome: ~$0.20 - $0.40
- Settle Market: ~$0.15 - $0.30

### UMA Bonds:
- Proposal Bond: 1000 USDC (refunded if correct)
- Dispute Bond: 1000 USDC (refunded if correct)

### Total Cost per Market:
- Deployment: ~$1.00 (one-time, paid by platform)
- Settlement: ~$0.30 (paid by settler)
- Proposals: 1000 USDC bond (refunded)

---

## 🎯 Key Differences from Internal Oracle

| **Aspect** | **Internal Oracle** | **UMA Oracle** |
|------------|---------------------|----------------|
| **Who Settles** | Admin or bond holders | Anyone can propose |
| **Settlement Authority** | Centralized voting | Decentralized UMA oracle |
| **Dispute Mechanism** | Internal voting | UMA governance |
| **Bond Requirement** | Variable | 1000 USDC per proposal |
| **Max Proposals** | Unlimited | 2 proposals max |
| **Settlement Speed** | Immediate after voting | 2+ hours (liveness period) |
| **Trust Model** | Trust platform | Trustless (UMA guarantees) |
| **Applicable To** | Private markets | Public markets only |
| **Database Tables** | `oracle_*` tables | `uma_*` tables |
| **Code Files** | `oracle-settlement.ts` | `uma-settlement.ts` |

---

## 📝 Summary

The UMA oracle settlement system is now fully implemented on the backend and ready for frontend integration. The system is completely modular and separate from the internal oracle, making it easy to debug and test. All blockchain interactions are logged, and the automated cron job ensures markets are settled promptly after the liveness period expires.

**Next immediate step:** Create the frontend UI components to allow users to interact with the UMA settlement system.
