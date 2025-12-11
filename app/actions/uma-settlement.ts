/**
 * UMA Oracle Settlement Actions
 * Server actions for UMA-based settlement using OptimisticOracleV3 directly
 * Handles blockchain interactions for public markets using UMA oracle
 */

"use server"
import { getUMAClient } from "@/lib/blockchain/client"
import { insert, update, select, rpc } from "@/lib/database/adapter"
import { revalidatePath } from "next/cache"
import { recordSettlementLeftover, recordUMARewardPayout } from "@/lib/platform-ledger"

// ============================================================================
// PHASE 1: Market Deployment to Blockchain
// ============================================================================

export async function deployMarketToBlockchain(marketId: string, userId?: string) {
  try {
    if (!userId) {
      return { success: false, error: "User ID required" }
    }

    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    if (market.blockchain_market_address) {
      return {
        success: false,
        error: "Market already deployed to blockchain",
        data: { marketAddress: market.blockchain_market_address },
      }
    }

    await update("markets", { blockchain_status: "not_deployed" }, { column: "id", operator: "eq", value: marketId })

    const client = getUMAClient()
    const expiryTimestamp = Math.floor(new Date(market.end_date).getTime() / 1000)
    const rewardAmount = market.liquidity_posted_for_reward?.toString() || "10"

    let deployment
    try {
      deployment = await client.deployMarket(marketId, market.title, expiryTimestamp, rewardAmount)
    } catch (deployError: any) {
      console.error("Blockchain deployment failed:", deployError.message)

      await update("markets", { blockchain_status: "not_deployed" }, { column: "id", operator: "eq", value: marketId })

      return {
        success: false,
        error: `Deployment failed: ${deployError.reason || deployError.message}`,
      }
    }

    await update(
      "markets",
      {
        blockchain_market_address: deployment.marketAddress,
        blockchain_status: "deployed",
      },
      { column: "id", operator: "eq", value: marketId },
    )

    try {
      revalidatePath(`/market/${marketId}`)
    } catch (e) {
      // Revalidation skipped (not in request context)
    }

    return {
      success: true,
      data: {
        marketAddress: deployment.marketAddress,
        transactionHash: deployment.transactionHash,
      },
    }
  } catch (error: any) {
    console.error("Deployment error:", error)

    try {
      await update("markets", { blockchain_status: "not_deployed" }, { column: "id", operator: "eq", value: marketId })
    } catch (dbError) {
      // Failed to update deployment status
    }

    return { success: false, error: error.message }
  }
}

// ============================================================================
// PHASE 2: Propose Outcome (Direct assertTruth call)
// ============================================================================

export async function proposeUMAOutcome(marketId: string, outcome: boolean, userId?: string) {
  try {
    if (!userId) {
      return { success: false, error: "User ID required" }
    }

    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    if (!market.blockchain_market_address) {
      return { success: false, error: "Market not deployed to blockchain" }
    }

    if (market.status === "settled") {
      return { success: false, error: "Market already settled" }
    }

    const now = new Date()
    const endDate = new Date(market.end_date)
    if (endDate > now) {
      return {
        success: false,
        error: "Market has not expired yet. Wait until after the closing date to propose outcome.",
      }
    }

    const client = getUMAClient()
    const expiryTimestamp = Math.floor(new Date(market.end_date).getTime() / 1000)

    const proposal = await client.proposeOutcome(marketId, market.title, outcome, expiryTimestamp)

    const newProposalCount = (market.uma_proposal_count || 0) + 1
    await update(
      "markets",
      {
        uma_request_id: proposal.assertionId,
        uma_proposal_count: newProposalCount,
        uma_liveness_ends_at: new Date(proposal.livenessEndsAt * 1000).toISOString(),
        blockchain_status: "proposal_pending",
      },
      { column: "id", operator: "eq", value: marketId },
    )

    await insert("uma_proposals", {
      market_id: marketId,
      proposer_address: userId,
      outcome,
      bond_amount: 500,
      proposal_timestamp: new Date().toISOString(),
      is_early_settlement: false,
      liveness_ends_at: new Date(proposal.livenessEndsAt * 1000).toISOString(),
      status: "pending",
    })

    await insert("blockchain_transactions", {
      market_id: marketId,
      transaction_type: "propose_outcome",
      transaction_hash: proposal.transactionHash,
      from_address: userId,
      status: "confirmed",
    })

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
          title: "Outcome Proposed",
          message: `An outcome (${outcome ? "YES" : "NO"}) has been proposed for "${market.title}". Challenge period: 2 hours.`,
        }))

      if (notifications.length > 0) {
        await insert("notifications", notifications)
      }
    }

    try {
      revalidatePath(`/market/${marketId}`)
    } catch (e) {
      // Revalidation skipped
    }

    return {
      success: true,
      data: {
        assertionId: proposal.assertionId,
        transactionHash: proposal.transactionHash,
        livenessEndsAt: proposal.livenessEndsAt,
        proposalCount: newProposalCount,
      },
    }
  } catch (error: any) {
    console.error("Proposal error:", error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// PHASE 3: Finalize Settlement (settleAssertion)
// ============================================================================

export async function finalizeUMASettlement(marketId: string) {
  try {
    const markets = await select("markets", "*", [{ column: "id", operator: "eq", value: marketId }])

    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]

    if (!market.uma_request_id) {
      return { success: false, error: "No assertion found for this market" }
    }

    if (market.status === "settled") {
      return { success: false, error: "Market already settled" }
    }

    const client = getUMAClient()
    const assertionStatus = await client.getAssertionStatus(market.uma_request_id)

    if (!assertionStatus.canSettle) {
      return {
        success: false,
        error: `Challenge period not expired. Time remaining: ${Math.ceil(assertionStatus.timeRemaining / 60)} minutes`,
      }
    }

    const proposals = await select("uma_proposals", "*", [{ column: "market_id", operator: "eq", value: marketId }], {
      column: "proposal_timestamp",
      direction: "desc",
    })

    if (!proposals || proposals.length === 0) {
      return { success: false, error: "No proposals found" }
    }

    const finalOutcome = proposals[0].outcome

    const settlement = await client.settleAssertion(market.uma_request_id)

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

    const payoutResult = await rpc("settle_market", {
      p_market_id: marketId,
      p_outcome: finalOutcome,
      p_admin_user_id: "00000000-0000-0000-0000-000000000000",
    })

    if (payoutResult.error) {
      console.error("Payout distribution failed:", payoutResult.error)
    }

    const marketsAfterSettlement = await select("markets", "liquidity_pool", [
      { column: "id", operator: "eq", value: marketId },
    ])

    if (marketsAfterSettlement && marketsAfterSettlement.length > 0) {
      const leftoverLiquidity = Number(marketsAfterSettlement[0].liquidity_pool || 0)

      if (leftoverLiquidity > 0) {
        await recordSettlementLeftover(marketId, leftoverLiquidity)
      }
    }

    if (proposals && proposals.length > 0) {
      const proposerId = proposals[0].proposer_address
      await recordUMARewardPayout(marketId, proposerId, 10)
    }

    await insert("blockchain_transactions", {
      market_id: marketId,
      transaction_type: "settle_market",
      transaction_hash: settlement.transactionHash,
      from_address: "system",
      status: "confirmed",
    })

    await update("uma_proposals", { status: "settled" }, { column: "market_id", operator: "eq", value: marketId })

    try {
      revalidatePath(`/market/${marketId}`)
      revalidatePath("/")
    } catch (e) {
      // Revalidation skipped
    }

    return {
      success: true,
      data: {
        outcome: finalOutcome,
        transactionHash: settlement.transactionHash,
      },
    }
  } catch (error: any) {
    console.error("Finalization error:", error)
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

    let blockchainStatus = null
    if (market.uma_request_id) {
      const client = getUMAClient()
      blockchainStatus = await client.getAssertionStatus(market.uma_request_id)
    }

    const proposals = await select("uma_proposals", "*", [{ column: "market_id", operator: "eq", value: marketId }])

    return {
      success: true,
      data: {
        isDeployed: true,
        blockchainStatus: market.blockchain_status,
        assertionId: market.uma_request_id,
        proposalCount: market.uma_proposal_count || 0,
        livenessEndsAt: market.uma_liveness_ends_at,
        canSettle: blockchainStatus?.canSettle || false,
        timeRemaining: blockchainStatus?.timeRemaining || 0,
        isSettled: blockchainStatus?.isSettled || false,
        proposals: proposals || [],
      },
    }
  } catch (error: any) {
    console.error("Status check error:", error)
    return { success: false, error: error.message }
  }
}
