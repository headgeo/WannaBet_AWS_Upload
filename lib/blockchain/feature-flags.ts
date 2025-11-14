/**
 * Blockchain Feature Flags
 * Control blockchain functionality with environment variables
 */

export const BLOCKCHAIN_FEATURES = {
  // Enable auto-deployment of markets to blockchain
  AUTO_DEPLOY_MARKETS: (() => {
    const value =
      process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT === "true" ||
      process.env.ENABLE_BLOCKCHAIN_DEPLOYMENT === "true"
    console.log("[v0] AUTO_DEPLOY_MARKETS:", value, {
      NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT: process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT,
      ENABLE_BLOCKCHAIN_DEPLOYMENT: process.env.ENABLE_BLOCKCHAIN_DEPLOYMENT,
    })
    return value
  })(),

  // Enable UMA settlement flow
  ENABLE_UMA_SETTLEMENT: (() => {
    const value =
      process.env.NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT === "true" || process.env.ENABLE_UMA_SETTLEMENT === "true"
    console.log("[v0] ENABLE_UMA_SETTLEMENT:", value, {
      NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT: process.env.NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT,
      ENABLE_UMA_SETTLEMENT: process.env.ENABLE_UMA_SETTLEMENT,
    })
    return value
  })(),

  // Show blockchain UI elements (can be enabled independently for testing UI)
  SHOW_BLOCKCHAIN_UI: (() => {
    const value =
      process.env.NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI === "true" || process.env.SHOW_BLOCKCHAIN_UI === "true"
    console.log("[v0] SHOW_BLOCKCHAIN_UI:", value, {
      NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI: process.env.NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI,
      SHOW_BLOCKCHAIN_UI: process.env.SHOW_BLOCKCHAIN_UI,
    })
    return value
  })(),
} as const

export function isBlockchainEnabled() {
  return BLOCKCHAIN_FEATURES.AUTO_DEPLOY_MARKETS || BLOCKCHAIN_FEATURES.ENABLE_UMA_SETTLEMENT
}

export function shouldShowBlockchainUI() {
  return BLOCKCHAIN_FEATURES.SHOW_BLOCKCHAIN_UI || isBlockchainEnabled()
}
