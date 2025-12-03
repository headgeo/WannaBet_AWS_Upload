"use server"

import { rpc, selectWithJoin } from "@/lib/database/adapter"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { canTrade, getMarketStatus } from "@/lib/market-status"
import { revalidatePath } from "next/cache"
import { checkTradeRateLimit } from "@/lib/rate-limit"

export async function executeTradeV2(
  marketId: string,
  betAmount: number,
  betSide: "YES" | "NO",
  userId: string,
  expectedPrice: number, // Current price shown to user for slippage validation
) {
  try {
    const supabase = await createSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("User not authenticated")
    }

    const rateLimit = await checkTradeRateLimit(userId)
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt.toLocaleTimeString()
      throw new Error(
        `Rate limit exceeded. You can make ${rateLimit.remaining} more trades. Limit resets at ${resetTime}.`,
      )
    }

    const { data: marketData, error: marketError } = await selectWithJoin("markets", {
      select: "id, title, description, end_date, status, settled_at, winning_side, creator_id, is_private",
      where: [{ column: "id", value: marketId }],
      single: true,
    })

    if (marketError || !marketData) {
      throw new Error(`Market not found: ${marketError?.message || "Unknown error"}`)
    }

    if (marketData.is_private && marketData.creator_id === userId) {
      throw new Error(
        "You cannot trade on your own private market due to conflict of interest (you have settlement authority)",
      )
    }

    if (!canTrade(marketData)) {
      const status = getMarketStatus(marketData)
      if (status === "expired") {
        throw new Error("Trading is closed - market has expired and is awaiting settlement")
      } else if (status === "settled") {
        throw new Error("Trading is closed - market has been settled")
      }
      throw new Error("Trading is not available for this market")
    }

    console.log("[v0] Executing trade v2:", {
      marketId,
      betAmount,
      betSide,
      expectedPrice,
    })

    // Call the new v2 function - server handles all calculations, locking, and 2% slippage validation
    const { data: tradeResult, error: rpcError } = await rpc("execute_trade_lmsr_v2", {
      p_market_id: marketId,
      p_user_id: userId,
      p_bet_amount: betAmount,
      p_bet_side: betSide.toLowerCase(),
      p_expected_price: expectedPrice,
    })

    if (rpcError) {
      console.error("[v0] Trade RPC error:", rpcError)
      // Check for slippage error
      if (rpcError.message?.includes("slippage")) {
        throw new Error(rpcError.message)
      }
      throw new Error(`Trade execution failed: ${rpcError.message}`)
    }

    console.log("[v0] Trade v2 executed successfully:", tradeResult)

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/")
    revalidatePath("/my-bets")

    return { success: true, data: tradeResult }
  } catch (error) {
    console.error("Trade execution failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function sellSharesV2(
  marketId: string,
  userId: string,
  sharesToSell: number,
  betSide: "YES" | "NO",
  expectedPrice: number, // Current price shown to user for slippage validation
) {
  try {
    const supabase = await createSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error("User not authenticated")
    }

    const rateLimit = await checkTradeRateLimit(userId)
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt.toLocaleTimeString()
      throw new Error(
        `Rate limit exceeded. You can make ${rateLimit.remaining} more trades. Limit resets at ${resetTime}.`,
      )
    }

    const { data: marketData, error: marketError } = await selectWithJoin("markets", {
      select: "id, title, description, end_date, status, settled_at, winning_side, creator_id, is_private",
      where: [{ column: "id", value: marketId }],
      single: true,
    })

    if (marketError || !marketData) {
      throw new Error(`Market not found: ${marketError?.message || "Unknown error"}`)
    }

    if (marketData.is_private && marketData.creator_id === userId) {
      throw new Error(
        "You cannot trade on your own private market due to conflict of interest (you have settlement authority)",
      )
    }

    if (!canTrade(marketData)) {
      const status = getMarketStatus(marketData)
      if (status === "expired") {
        throw new Error("Trading is closed - market has expired and is awaiting settlement")
      } else if (status === "settled") {
        throw new Error("Trading is closed - market has been settled")
      }
      throw new Error("Trading is not available for this market")
    }

    console.log("[v0] Executing sell v2:", {
      marketId,
      sharesToSell,
      betSide,
      expectedPrice,
    })

    // Call the new v2 function - server handles all calculations, locking, and 2% slippage validation
    const { data: sellResult, error: rpcError } = await rpc("sell_shares_lmsr_v2", {
      p_market_id: marketId,
      p_user_id: userId,
      p_shares_to_sell: sharesToSell,
      p_bet_side: betSide.toLowerCase(),
      p_expected_price: expectedPrice,
    })

    if (rpcError) {
      console.error("[v0] Sell RPC error:", rpcError)
      // Check for slippage error
      if (rpcError.message?.includes("slippage")) {
        throw new Error(rpcError.message)
      }
      throw new Error(`Sell execution failed: ${rpcError.message}`)
    }

    console.log("[v0] Sell v2 executed successfully:", sellResult)

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/")
    revalidatePath("/my-bets")

    return { success: true, data: sellResult }
  } catch (error) {
    console.error("Sell execution failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Keep legacy functions for backwards compatibility during transition
export async function executeTrade(
  marketId: string,
  betAmount: number,
  betSide: "YES" | "NO",
  userId: string,
  newQy: number,
  newQn: number,
  calculatedShares: number,
  totalVolume: number,
  yesShares: number,
  noShares: number,
  newLiquidityPool: number,
  feeAmount: number,
  netAmount: number,
  maxSlippagePercent = 5,
  expectedPrice: number,
) {
  console.log("[v0] Legacy executeTrade called, redirecting to v2")
  return executeTradeV2(marketId, betAmount, betSide, userId, expectedPrice)
}

export async function sellShares(
  positionId: string,
  sharesToSell: number,
  expectedValue: number,
  marketId: string,
  userId: string,
  newQy: number,
  newQn: number,
  totalVolume: number,
  yesShares: number,
  noShares: number,
  newLiquidityPool: number,
  feeAmount: number,
  netValue: number,
  maxSlippagePercent = 5,
  expectedPricePerShare: number,
) {
  console.log("[v0] Legacy sellShares called, redirecting to v2")

  // Get position to determine side
  const { data: position } = await selectWithJoin("positions", {
    select: "side",
    where: [{ column: "id", value: positionId }],
    single: true,
  })

  const betSide = position?.side ? "YES" : "NO"

  return sellSharesV2(marketId, userId, sharesToSell, betSide, expectedPricePerShare)
}
