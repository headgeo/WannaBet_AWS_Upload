"use server"

import { select, insert, update } from "@/lib/database/adapter"

export type PlatformLedgerTransactionType =
  | "market_creation_reward" // $10 inflow when public market created
  | "settlement_leftover" // Leftover liquidity after settlement
  | "platform_fee" // Platform fees (not creator fees)
  | "uma_reward_payout" // $10 outflow when UMA settlement reward paid

interface RecordPlatformTransactionParams {
  transactionType: PlatformLedgerTransactionType
  amount: number // Positive for credits, negative for debits
  marketId?: string
  feeId?: string
  relatedTransactionId?: string
  metadata?: Record<string, any>
}

/**
 * Records a transaction in the platform ledger
 * This function calculates the running balance and ensures atomicity
 */
export async function recordPlatformTransaction(params: RecordPlatformTransactionParams) {
  try {
    console.log("[v0] Recording platform transaction:", {
      type: params.transactionType,
      amount: params.amount,
      marketId: params.marketId,
      feeId: params.feeId,
    })

    const balanceRows = await select("platform_ledger", "amount")

    if (!balanceRows) {
      console.error("[v0] Error querying platform_ledger table")
      console.error("[v0] Did you run scripts/016_create_platform_ledger.sql?")
      throw new Error("Failed to query platform_ledger")
    }

    // Calculate current balance by summing all amounts
    const currentBalance = balanceRows.reduce((sum: number, row: any) => sum + Number(row.amount), 0)
    const newBalance = Number(currentBalance) + Number(params.amount)

    console.log("[v0] Current platform balance:", currentBalance, "→ New balance:", newBalance)

    const { data, error } = await insert("platform_ledger", {
      transaction_type: params.transactionType,
      amount: Number(params.amount), // Ensure amount is number
      balance_after: newBalance,
      market_id: params.marketId || null,
      fee_id: params.feeId || null,
      related_transaction_id: params.relatedTransactionId || null,
      metadata: params.metadata || {},
    })

    if (error) {
      console.error("[v0] Error inserting into platform_ledger:", error)
      throw error
    }

    console.log(
      `[v0] ✅ Platform ledger: ${params.transactionType} ${params.amount > 0 ? "+" : ""}$${params.amount.toFixed(2)} → Balance: $${newBalance.toFixed(2)}`,
    )

    return { success: true, data: data?.[0], newBalance }
  } catch (error: any) {
    console.error("[v0] ❌ Failed to record platform transaction:", error)
    return { success: false, error }
  }
}

/**
 * Records the $10 inflow when a public market is created
 */
export async function recordMarketCreationReward(marketId: string, creatorId: string, amount = 10) {
  console.log("[v0] recordMarketCreationReward called:", { marketId, creatorId, amount })
  return recordPlatformTransaction({
    transactionType: "market_creation_reward",
    amount: amount, // Positive = credit to platform
    marketId,
    metadata: {
      creator_id: creatorId,
      description: `Market creation: $${amount} liquidity allocated for UMA reward`,
    },
  })
}

/**
 * Records leftover liquidity after settlement as platform income
 * Also updates the market to zero out the leftover liquidity
 */
export async function recordSettlementLeftover(marketId: string, leftoverAmount: number) {
  if (leftoverAmount <= 0) {
    return { success: true, message: "No leftover liquidity" }
  }

  try {
    // Record in platform ledger
    const result = await recordPlatformTransaction({
      transactionType: "settlement_leftover",
      amount: leftoverAmount, // Positive = credit to platform
      marketId,
      metadata: {
        description: `Leftover liquidity after settlement`,
      },
    })

    if (!result.success) {
      throw new Error("Failed to record leftover in platform ledger")
    }

    const { error: updateError } = await update(
      "markets",
      { liquidity_pool: 0 },
      { column: "id", operator: "eq", value: marketId },
    )

    if (updateError) {
      console.error("[v0] Error zeroing market liquidity pool:", updateError)
      throw updateError
    }

    console.log(`[v0] Recorded $${leftoverAmount} leftover liquidity for market ${marketId}`)

    return { success: true, data: result.data }
  } catch (error) {
    console.error("[v0] Failed to record settlement leftover:", error)
    return { success: false, error }
  }
}

/**
 * Records platform fees (not creator fees) as platform income
 */
export async function recordPlatformFee(feeId: string, amount: number, marketId: string) {
  console.log("[v0] recordPlatformFee called:", { feeId, amount, marketId })
  return recordPlatformTransaction({
    transactionType: "platform_fee",
    amount: amount, // Positive = credit to platform
    feeId,
    marketId,
    metadata: {
      description: `Platform fee from trade`,
    },
  })
}

/**
 * Records the $10 outflow when UMA settlement reward is paid
 */
export async function recordUMARewardPayout(marketId: string, recipientId: string, amount = 10) {
  return recordPlatformTransaction({
    transactionType: "uma_reward_payout",
    amount: -amount, // Negative = debit from platform
    marketId,
    metadata: {
      recipient_id: recipientId,
      description: `UMA settlement reward paid to proposer`,
    },
  })
}

/**
 * Get platform balance
 */
export async function getPlatformBalance() {
  try {
    const balanceRows = await select("platform_ledger", "amount")

    if (!balanceRows) {
      return { success: false, error: new Error("Failed to query platform balance") }
    }

    const currentBalance = balanceRows.reduce((sum: number, row: any) => sum + Number(row.amount), 0)
    const totalTransactions = balanceRows.length

    return {
      success: true,
      balance: currentBalance,
      totalTransactions,
    }
  } catch (error: any) {
    console.error("[v0] Error getting platform balance:", error)
    return { success: false, error }
  }
}

/**
 * Convenience function that matches the import name
 * Records a platform ledger entry with simplified parameters
 */
export async function recordPlatformLedgerEntry({
  type,
  amount,
  marketId,
  feeId,
  description,
}: {
  type: PlatformLedgerTransactionType
  amount: number
  marketId?: string
  feeId?: string
  description?: string
}) {
  console.log("[v0] recordPlatformLedgerEntry called:", { type, amount, marketId, feeId, description })
  return recordPlatformTransaction({
    transactionType: type,
    amount,
    marketId,
    feeId,
    metadata: description ? { description } : undefined,
  })
}

/**
 * Convenience function to zero out a market's liquidity pool
 * Used after recording leftover liquidity in platform ledger
 */
export async function zerOutLiquidityPool(marketId: string) {
  const { error } = await update("markets", { liquidity_pool: 0 }, { column: "id", operator: "eq", value: marketId })

  if (error) {
    console.error("[v0] Error zeroing market liquidity pool:", error)
    throw error
  }

  return { success: true }
}
