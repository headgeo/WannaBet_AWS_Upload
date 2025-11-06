/**
 * UMA Blockchain Configuration
 * Network settings and contract addresses for UMA oracle settlement
 * Completely separate from internal oracle system
 */

export interface NetworkConfig {
  name: string
  chainId: number
  rpcUrl: string
  usdcAddress: string
  umaOracleAddress: string
  collateralVaultAddress?: string
  umaAdapterAddress?: string
  marketFactoryAddress?: string
  blockExplorer: string
}

export const NETWORKS: Record<string, NetworkConfig> = {
  polygon: {
    name: "Polygon Mainnet",
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8Cc03d5c3359", // Native USDC on Polygon
    umaOracleAddress: "0xa6147867264374F324524E30C02C331cF28aa879", // UMA OOv3 on Polygon
    collateralVaultAddress: process.env.POLYGON_COLLATERAL_VAULT_ADDRESS,
    umaAdapterAddress: process.env.POLYGON_UMA_ADAPTER_ADDRESS,
    marketFactoryAddress: process.env.POLYGON_MARKET_FACTORY_ADDRESS,
    blockExplorer: "https://polygonscan.com",
  },
  amoy: {
    name: "Polygon Amoy Testnet",
    chainId: 80002,
    rpcUrl: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Mock USDC on Amoy
    umaOracleAddress: "0x263351499f82C107e540B01F0Ca959843e22464a", // UMA OOv3 on Amoy (verify this)
    collateralVaultAddress: process.env.AMOY_COLLATERAL_VAULT_ADDRESS,
    umaAdapterAddress: process.env.AMOY_UMA_ADAPTER_ADDRESS,
    marketFactoryAddress: process.env.AMOY_MARKET_FACTORY_ADDRESS,
    blockExplorer: "https://amoy.polygonscan.com",
  },
  localhost: {
    name: "Localhost Hardhat Network",
    chainId: 31337,
    rpcUrl: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
    usdcAddress: "0x0000000000000000000000000000000000000001", // Mock USDC
    umaOracleAddress: "0x0000000000000000000000000000000000000002", // Mock UMA Oracle
    collateralVaultAddress:
      process.env.LOCALHOST_COLLATERAL_VAULT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    umaAdapterAddress: process.env.LOCALHOST_UMA_ADAPTER_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    marketFactoryAddress: process.env.LOCALHOST_MARKET_FACTORY_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    blockExplorer: "http://localhost:8545",
  },
}

export const ACTIVE_NETWORK =
  process.env.BLOCKCHAIN_NETWORK || (process.env.NODE_ENV === "production" ? "polygon" : "amoy")

export function getNetworkConfig(network?: string): NetworkConfig {
  const networkName = network || ACTIVE_NETWORK
  const config = NETWORKS[networkName]

  if (!config) {
    throw new Error(`Network configuration not found for: ${networkName}`)
  }

  return config
}

export function getContractAddresses(network?: string) {
  const config = getNetworkConfig(network)

  return {
    usdc: config.usdcAddress,
    umaOracle: config.umaOracleAddress,
    collateralVault: config.collateralVaultAddress,
    umaAdapter: config.umaAdapterAddress,
    marketFactory: config.marketFactoryAddress,
  }
}

// UMA Oracle Constants
export const UMA_CONSTANTS = {
  DEFAULT_BOND: "1000000000", // 1000 USDC (6 decimals)
  DEFAULT_LIVENESS: 7200, // 2 hours in seconds
  MAX_PROPOSALS: 2,
  ASSERTION_IDENTIFIER: "YES_OR_NO_QUERY",
}

// Gas limits for different operations
export const GAS_LIMITS = {
  DEPLOY_MARKET: 3000000, // Increased from 500k - deploying a new contract is expensive
  REQUEST_RESOLUTION: 500000, // Increased from 200k for safety
  PROPOSE_OUTCOME: 500000, // Increased from 300k for safety
  SETTLE_MARKET: 500000, // Increased from 250k for safety
  DISPUTE_PROPOSAL: 500000, // Increased from 300k for safety
}
