"use server"

import { BLOCKCHAIN_FEATURES } from "@/lib/blockchain/feature-flags"
import { proposeUMAOutcome } from "./uma-settlement"

/**
 * Wrapper actions for blockchain features
 * These check feature flags before executing blockchain operations
 */

// In the new flow, this isn't used but kept for backward compatibility
export async function requestUMASettlement(marketId: string, userId: string) {
  return {
    success: false,
    error: "This function is deprecated. Please use the propose outcome button in the blockchain UI instead.",
  }
}

export async function proposeUMAOutcomeWrapper(marketId: string, outcome: boolean, userId: string) {
  // Check if UMA settlement is enabled
  if (!BLOCKCHAIN_FEATURES.ENABLE_UMA_SETTLEMENT) {
    return {
      success: false,
      error: "UMA settlement is not yet enabled. This feature is coming soon!",
    }
  }

  // If enabled, execute the real function
  return proposeUMAOutcome(marketId, outcome, userId)
}

export async function openUMAOracleInterface(blockchainAddress: string) {
  // This is always allowed - just opens a URL
  const network = process.env.BLOCKCHAIN_NETWORK || "amoy"
  const chainId = network === "polygon" ? "137" : "80002"

  // UMA oracle interface URL structure
  const umaUrl = `https://oracle.umaproject.org/?chainId=${chainId}&address=${blockchainAddress}`

  return { success: true, url: umaUrl }
}
