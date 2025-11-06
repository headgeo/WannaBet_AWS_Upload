/**
 * UMA Oracle Settlement Actions
 * Server actions for UMA-based settlement (completely separate from internal oracle)
 * Handles blockchain interactions for public markets using UMA oracle
 */

"use server"
import { getUMAClient } from "@/lib/blockchain/client"
import { insert, update, select, rpc } from "@/lib/database/adapter"
import { revalidatePath } from "next/cache"

// ============================================================================
// PHASE 1: Market Deployment to Blockchain
// ============================================================================

export async function deployMarketToBlockchain(marketId: string, userId?: string) {
  try {
    if (!userId) {
      return { success: false, error: "User ID required" }
    }

    // Fetch market details
    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    // Check if already deployed
    if (market.blockchain_market_address) {
      return {
        success: false,
        error: "Market already deployed to blockchain",
        data: { marketAddress: market.blockchain_market_address },
      }
    }

    // Deploy to blockchain
    const client = getUMAClient()
    const expiryTimestamp = Math.floor(new Date(market.end_date).getTime() / 1000)

    console.log("[UMA Settlement] Deploying market to blockchain:", {
      marketId,
      title: market.title,
      expiryTimestamp,
    })

    const deployment = await client.deployMarket(marketId, market.title, expiryTimestamp)

    // Update database with blockchain address
    await update(
      "markets",
      {
        blockchain_market_address: deployment.marketAddress,
        blockchain_status: "deployed",
      },
      { column: "id", operator: "eq", value: marketId },
    )

    // Log transaction
    await insert("blockchain_transactions", {
      market_id: marketId,
      transaction_type: "deploy",
      transaction_hash: deployment.transactionHash,
      from_address: userId, // Use userId instead of signer address
      status: "confirmed",
    })

    console.log("[UMA Settlement] Market deployed successfully:", deployment.marketAddress)

    revalidatePath(`/market/${marketId}`)

    return {
      success: true,
      data: {
        marketAddress: deployment.marketAddress,
        transactionHash: deployment.transactionHash,
      },
    }
  } catch (error: any) {
    console.error("[UMA Settlement] Deployment error:", error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// PHASE 2: Initiate UMA Settlement
// ============================================================================

export async function initiateUMASettlement(marketId: string, userId?: string) {
  try {
    if (!userId) {
      return { success: false, error: "User ID required" }
    }

    // Fetch market
    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    // Validate market is eligible for UMA settlement
    if (!market.blockchain_market_address) {
      return { success: false, error: "Market not deployed to blockchain" }
    }

    if (market.blockchain_status === "resolution_requested") {
      return { success: false, error: "Resolution already requested" }
    }

    if (market.status === "settled") {
      return { success: false, error: "Market already settled" }
    }

    // Check if market has expired
    const now = new Date()
    const endDate = new Date(market.end_date)
    const isExpired = endDate < now

    if (!isExpired) {
      // Allow early settlement only by creator
      if (market.creator_id !== userId) {
        // Use userId parameter
        return { success: false, error: "Only creator can request early settlement" }
      }
    }

    // Request resolution on blockchain
    const client = getUMAClient()
    const resolution = await client.requestResolution(market.blockchain_market_address, marketId)

    // Update database
    await update(
      "markets",
      {
        blockchain_status: "resolution_requested",
        uma_request_id: resolution.requestId,
        status: "suspended",
      },
      { column: "id", operator: "eq", value: marketId },
    )

    // Log transaction
    await insert("blockchain_transactions", {
      market_id: marketId,
      transaction_type: "request_resolution",
      transaction_hash: resolution.transactionHash,
      from_address: userId, // Use userId parameter
      status: "confirmed",
    })

    // Notify participants
    const participants = await select("positions", "DISTINCT user_id", [
      { column: "market_id", operator: "eq", value: marketId },
    ])

    if (participants && participants.length > 0) {
      const notifications = participants
        .filter((p) => p.user_id !== userId)
        .map((p) => ({
          user_id: p.user_id,
          market_id: marketId,
          type: "settlement_initiated",
          title: "UMA Settlement Requested",
          message: `Settlement has been requested for "${market.title}". You can now propose an outcome.`,
        }))

      if (notifications.length > 0) {
        await insert("notifications", notifications)
      }
    }

    console.log("[UMA Settlement] Resolution requested:", resolution.requestId)

    revalidatePath(`/market/${marketId}`)

    return {
      success: true,
      data: {
        requestId: resolution.requestId,
        transactionHash: resolution.transactionHash,
      },
    }
  } catch (error: any) {
    console.error("[UMA Settlement] Initiation error:", error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// PHASE 3: Propose Outcome
// ============================================================================

export async function proposeUMAOutcome(marketId: string, outcome: boolean, proposerAddress: string, userId?: string) {
  try {
    if (!userId) {
      return { success: false, error: "User ID required" }
    }

    // Fetch market
    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    // Validate
    if (market.blockchain_status !== "resolution_requested") {
      return { success: false, error: "Resolution not requested yet" }
    }

    if (market.uma_proposal_count >= 2) {
      return { success: false, error: "Maximum 2 proposals already submitted" }
    }

    // Check USDC approval
    const client = getUMAClient()
    const approval = await client.checkUSDCApproval(proposerAddress, market.blockchain_market_address)

    if (!approval.hasEnough) {
      return {
        success: false,
        error: `Insufficient USDC. Need 1000 USDC approved. Balance: ${approval.balance}, Allowance: ${approval.allowance}`,
      }
    }

    // Submit proposal to blockchain
    const proposal = await client.proposeOutcome(market.blockchain_market_address, outcome, proposerAddress)

    // Update database
    const newProposalCount = (market.uma_proposal_count || 0) + 1
    await update(
      "markets",
      {
        uma_proposal_count: newProposalCount,
        uma_liveness_ends_at: new Date(proposal.livenessEndsAt * 1000).toISOString(),
      },
      { column: "id", operator: "eq", value: marketId },
    )

    // Record proposal
    await insert("uma_proposals", {
      market_id: marketId,
      proposer_address: proposerAddress,
      outcome,
      bond_amount: 1000,
      proposal_timestamp: new Date().toISOString(),
      is_early_settlement: false,
      liveness_ends_at: new Date(proposal.livenessEndsAt * 1000).toISOString(),
      status: "pending",
    })

    // Log transaction
    await insert("blockchain_transactions", {
      market_id: marketId,
      transaction_type: "propose_outcome",
      transaction_hash: proposal.transactionHash,
      from_address: proposerAddress,
      status: "confirmed",
    })

    // Notify participants
    const participants = await select("positions", "DISTINCT user_id", [
      { column: "market_id", operator: "eq", value: marketId },
    ])

    if (participants && participants.length > 0) {
      const notifications = participants.map((p) => ({
        user_id: p.user_id,
        market_id: marketId,
        type: "settlement_initiated",
        title: "Outcome Proposed",
        message: `An outcome (${outcome ? "YES" : "NO"}) has been proposed for "${market.title}". Liveness period: 2 hours.`,
      }))

      await insert("notifications", notifications)
    }

    console.log("[UMA Settlement] Outcome proposed:", { outcome, proposerAddress })

    revalidatePath(`/market/${marketId}`)

    return {
      success: true,
      data: {
        transactionHash: proposal.transactionHash,
        livenessEndsAt: proposal.livenessEndsAt,
        proposalCount: newProposalCount,
      },
    }
  } catch (error: any) {
    console.error("[UMA Settlement] Proposal error:", error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// PHASE 4: Finalize Settlement
// ============================================================================

export async function finalizeUMASettlement(marketId: string) {
  try {
    // Fetch market
    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    // Validate
    if (!market.uma_request_id) {
      return { success: false, error: "No UMA request found" }
    }

    if (market.status === "settled") {
      return { success: false, error: "Market already settled" }
    }

    // Check if liveness period has expired
    const client = getUMAClient()
    const status = await client.getMarketStatus(market.blockchain_market_address)

    if (!status.canSettle) {
      return {
        success: false,
        error: `Liveness period not expired. Time remaining: ${status.timeRemaining} seconds`,
      }
    }

    // Get the final outcome from proposals
    const proposals = await select("uma_proposals", "*", [{ column: "market_id", operator: "eq", value: marketId }])

    if (!proposals || proposals.length === 0) {
      return { success: false, error: "No proposals found" }
    }

    // Use the last proposal's outcome
    const finalOutcome = proposals[proposals.length - 1].outcome

    // Settle on blockchain
    const settlement = await client.settleMarket(market.uma_request_id, finalOutcome)

    // Update market in database
    await update(
      "markets",
      {
        status: "settled",
        outcome: finalOutcome,
        winning_side: finalOutcome,
        settled_at: new Date().toISOString(),
        blockchain_status: "settled",
      },
      { column: "id", operator: "eq", value: marketId },
    )

    // Distribute payouts using existing RPC function
    // This reuses the internal oracle's payout logic
    const payoutResult = await rpc("settle_market", {
      p_market_id: marketId,
      p_outcome: finalOutcome,
    })

    if (payoutResult.error) {
      console.error("[UMA Settlement] Payout distribution failed:", payoutResult.error)
    }

    // Log transaction
    await insert("blockchain_transactions", {
      market_id: marketId,
      transaction_type: "settle",
      transaction_hash: settlement.transactionHash,
      from_address: "system",
      status: "confirmed",
    })

    // Update proposal statuses
    await update("uma_proposals", { status: "settled" }, { column: "market_id", operator: "eq", value: marketId })

    console.log("[UMA Settlement] Market settled:", { marketId, outcome: finalOutcome })

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/")

    return {
      success: true,
      data: {
        outcome: finalOutcome,
        transactionHash: settlement.transactionHash,
      },
    }
  } catch (error: any) {
    console.error("[UMA Settlement] Finalization error:", error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export async function getUMASettlementStatus(marketId: string) {
  try {
    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    if (!market.blockchain_market_address) {
      return {
        success: true,
        data: {
          isDeployed: false,
          status: "not_deployed",
        },
      }
    }

    // Get blockchain status
    const client = getUMAClient()
    const blockchainStatus = await client.getMarketStatus(market.blockchain_market_address)

    // Get proposals
    const proposals = await select("uma_proposals", "*", [{ column: "market_id", operator: "eq", value: marketId }])

    return {
      success: true,
      data: {
        isDeployed: true,
        blockchainStatus: market.blockchain_status,
        requestId: market.uma_request_id,
        proposalCount: market.uma_proposal_count || 0,
        livenessEndsAt: market.uma_liveness_ends_at,
        canSettle: blockchainStatus.canSettle,
        timeRemaining: blockchainStatus.timeRemaining,
        proposals: proposals || [],
      },
    }
  } catch (error: any) {
    console.error("[UMA Settlement] Status check error:", error)
    return { success: false, error: error.message }
  }
}
