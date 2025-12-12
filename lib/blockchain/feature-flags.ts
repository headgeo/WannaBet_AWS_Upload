/**
 * Blockchain Feature Flags
 * Control blockchain functionality with environment variables
 */

// Debug: Log env var values at module load time (only in development)
if (typeof window !== "undefined") {
  console.log("[v0] Blockchain env vars at runtime:", {
    NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI: process.env.NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI,
    NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT: process.env.NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT,
    NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT: process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT,
  })
}

export const BLOCKCHAIN_FEATURES = {
  // Enable auto-deployment of markets to blockchain
  AUTO_DEPLOY_MARKETS:
    process.env.NEXT_PUBLIC_ENABLE_BLOCKCHAIN_DEPLOYMENT === "true" ||
    process.env.ENABLE_BLOCKCHAIN_DEPLOYMENT === "true",

  // Enable UMA settlement flow
  ENABLE_UMA_SETTLEMENT:
    process.env.NEXT_PUBLIC_ENABLE_UMA_SETTLEMENT === "true" || process.env.ENABLE_UMA_SETTLEMENT === "true",

  // Show blockchain UI elements - default to TRUE if not explicitly set to "false"
  // This ensures the UI shows unless explicitly disabled
  SHOW_BLOCKCHAIN_UI:
    process.env.NEXT_PUBLIC_SHOW_BLOCKCHAIN_UI !== "false" && process.env.SHOW_BLOCKCHAIN_UI !== "false",
} as const

export function isBlockchainEnabled() {
  return BLOCKCHAIN_FEATURES.AUTO_DEPLOY_MARKETS || BLOCKCHAIN_FEATURES.ENABLE_UMA_SETTLEMENT
}

export function shouldShowBlockchainUI() {
  // Always show UI unless explicitly disabled
  return BLOCKCHAIN_FEATURES.SHOW_BLOCKCHAIN_UI
}
