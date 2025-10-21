# Prediction Market Smart Contracts

Smart contracts for UMA-based trustless settlement of prediction markets on Polygon.

## Setup

### 1. Install Dependencies

\`\`\`bash
cd blockchain
npm install
\`\`\`

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

\`\`\`bash
cp .env.example .env
\`\`\`

Required variables:
- `PRIVATE_KEY`: Your wallet private key (for deployment)
- `MUMBAI_RPC_URL`: RPC endpoint for Polygon Mumbai testnet
- `POLYGON_RPC_URL`: RPC endpoint for Polygon mainnet
- `POLYGONSCAN_API_KEY`: For contract verification (get from https://polygonscan.com/myapikey)

### 3. Compile Contracts

\`\`\`bash
npx hardhat compile
\`\`\`

## Development

### Run Local Node

\`\`\`bash
npx hardhat node
\`\`\`

This starts a local Hardhat node at `http://127.0.0.1:8545`

### Run Tests

\`\`\`bash
npx hardhat test
\`\`\`

## Deployment

### Deploy to Mumbai Testnet

\`\`\`bash
npx hardhat run scripts/deploy.js --network mumbai
\`\`\`

### Deploy to Polygon Mainnet

\`\`\`bash
npx hardhat run scripts/deploy.js --network polygon
\`\`\`

### Verify Contracts

After deployment, verify on Polygonscan:

\`\`\`bash
npx hardhat run scripts/verify.js --network mumbai
# or
npx hardhat run scripts/verify.js --network polygon
\`\`\`

### Create Test Market

After deployment, create a test market:

\`\`\`bash
npx hardhat run scripts/create-test-market.js --network mumbai
\`\`\`

## Deployment Artifacts

Deployment addresses are saved to `deployments/{network}.json` after each deployment. These files contain:
- Contract addresses
- Deployer address
- Network configuration
- Timestamp

Use these addresses to integrate with your backend.

## Contract Architecture

- **CollateralVault.sol**: Manages user deposits and withdrawals (non-custodial)
- **Market.sol**: Individual market contract with UMA integration
- **MarketFactory.sol**: Deploys and tracks market contracts
- **UMAOracleAdapter.sol**: Interface to UMA Optimistic Oracle V3

## UMA Integration

This project uses UMA's Optimistic Oracle V3 for trustless market settlement:

1. After market expiry, anyone can request resolution via `requestResolution()`
2. Proposers submit outcomes with a bond (1000 USDC) via `proposeOutcome()`
3. **Max 2 proposals per market** (enforced in smart contract)
4. After liveness period (2 hours), outcome is finalized
5. Winners can claim payouts from CollateralVault

### Key Constraints

- ✅ Proposals only allowed after market expiry
- ✅ Maximum 2 proposals per market
- ✅ Further proposals blocked after limit reached
- ✅ 1000 USDC bond required per proposal
- ✅ 2-hour liveness period for disputes

## Network Addresses

### Mumbai Testnet
- USDC: `0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97`
- UMA OO V3: `0x263351499f82C107e540B01F0Ca959843e22464a`

### Polygon Mainnet
- USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`
- UMA OO V3: `0xa6147867264374F324524E30C02C331cF28aa879`

## Security

⚠️ **Important**: 
- Never commit your `.env` file
- Audit contracts before mainnet deployment
- Test thoroughly on Mumbai testnet first
- Use a separate wallet for deployment (not your main wallet)
- Ensure sufficient MATIC for gas fees
- Ensure sufficient USDC for UMA bonds when proposing outcomes

## Implementation Checklist

- ✅ Step 1.1: Set up Hardhat project
- ✅ Step 1.2: Write smart contracts
- ✅ Step 1.3: Write deployment scripts
- ⏳ Step 1.4: Write tests
- ⏳ Step 2: Backend integration
- ⏳ Step 3: Frontend integration
- ⏳ Step 4: UMA integration testing
- ⏳ Step 5: Mainnet deployment

## Troubleshooting

**"Invalid account: private key too short"**
- Make sure your PRIVATE_KEY in `.env` is a valid 64-character hex string
- Get it from MetaMask: Account Details → Export Private Key

**"Insufficient funds for gas"**
- Ensure your wallet has enough MATIC for gas fees
- Get testnet MATIC from: https://faucet.polygon.technology/

**"Contract verification failed"**
- Make sure POLYGONSCAN_API_KEY is set in `.env`
- Wait a few minutes after deployment before verifying
- Check that constructor arguments match deployment
