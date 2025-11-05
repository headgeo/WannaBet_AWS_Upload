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
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Native USDC on Polygon
    umaOracleAddress: "0xa6147867264374F324524E30C02C331cF28aa879", // UMA OOv3 on Polygon
    collateralVaultAddress: process.env.COLLATERAL_VAULT_ADDRESS,
    umaAdapterAddress: process.env.UMA_ADAPTER_ADDRESS,
    marketFactoryAddress: process.env.MARKET_FACTORY_ADDRESS,
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
}

// Default to Amoy for development, Polygon for production
export const ACTIVE_NETWORK = process.env.NODE_ENV === "production" ? "polygon" : "amoy"

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
  DEPLOY_MARKET: 500000,
  REQUEST_RESOLUTION: 200000,
  PROPOSE_OUTCOME: 300000,
  SETTLE_MARKET: 250000,
  DISPUTE_PROPOSAL: 300000,
}
