/**
 * Blockchain Feature Flags
 * Control blockchain functionality with environment variables
 */

export const BLOCKCHAIN_FEATURES = {
  // Enable auto-deployment of markets to blockchain
  AUTO_DEPLOY_MARKETS:
    process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT === "true" ||
    process.env.ENABLE_BLOCKCHAIN_DEPLOYMENT === "true",

  // Enable UMA settlement flow
  ENABLE_UMA_SETTLEMENT:
    process.env.NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT === "true" || process.env.ENABLE_UMA_SETTLEMENT === "true",

  // Show blockchain UI elements (can be enabled independently for testing UI)
  SHOW_BLOCKCHAIN_UI:
    process.env.NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI === "true" || process.env.SHOW_BLOCKCHAIN_UI === "true",
} as const

export function isBlockchainEnabled() {
  return BLOCKCHAIN_FEATURES.AUTO_DEPLOY_MARKETS || BLOCKCHAIN_FEATURES.ENABLE_UMA_SETTLEMENT
}

export function shouldShowBlockchainUI() {
  return BLOCKCHAIN_FEATURES.SHOW_BLOCKCHAIN_UI || isBlockchainEnabled()
}
