"use server"

import { BLOCKCHAIN_FEATURES } from "@/lib/blockchain/feature-flags"
import { initiateUMASettlement } from "./uma-settlement"

/**
 * Wrapper actions for blockchain features
 * These check feature flags before executing blockchain operations
 */

export async function requestUMASettlement(marketId: string, userId: string) {
  // Check if UMA settlement is enabled
  if (!BLOCKCHAIN_FEATURES.ENABLE_UMA_SETTLEMENT) {
    return {
      success: false,
      error: "UMA settlement is not yet enabled. This feature is coming soon!",
    }
  }

  // If enabled, execute the real function
  return initiateUMASettlement(marketId, userId)
}

export async function openUMAOracleInterface(blockchainAddress: string) {
  // This is always allowed - just opens a URL
  const network = process.env.BLOCKCHAIN_NETWORK || "amoy"
  const chainId = network === "polygon" ? "137" : "80002"

  // UMA oracle interface URL structure
  // Note: This may need to be updated based on UMA's actual interface
  const umaUrl = `https://oracle.umaproject.org/?chainId=${chainId}&address=${blockchainAddress}`

  return { success: true, url: umaUrl }
}
