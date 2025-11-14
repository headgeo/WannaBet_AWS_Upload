"use server"

import { rpc, selectWithJoin } from "@/lib/database/adapter"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { canTrade, getMarketStatus } from "@/lib/market-status"
import { revalidatePath } from "next/cache"
import { checkTradeRateLimit } from "@/lib/rate-limit"

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

    const actualPricePerShare = netAmount / calculatedShares
    const priceDifference = Math.abs(actualPricePerShare - expectedPrice)
    const slippagePercent = (priceDifference / expectedPrice) * 100

    console.log("[v0] Slippage check:", {
      expectedPrice,
      actualPricePerShare,
      slippagePercent: slippagePercent.toFixed(2) + "%",
      maxAllowed: maxSlippagePercent + "%",
    })

    if (slippagePercent > maxSlippagePercent) {
      throw new Error(
        `Price moved too much! Expected $${expectedPrice.toFixed(4)}/share but current price is $${actualPricePerShare.toFixed(4)}/share (${slippagePercent.toFixed(1)}% slippage). Please try again with updated prices.`,
      )
    }

    console.log("[v0] Trade amounts:", {
      betAmount,
      feeAmount,
      netAmount,
      calculatedShares,
    })

    const { data: tradeResult, error: rpcError } = await rpc("execute_trade_lmsr", {
      p_market_id: marketId,
      p_user_id: userId,
      p_bet_amount: betAmount,
      p_fee_amount: feeAmount,
      p_net_amount: netAmount,
      p_bet_side: betSide.toLowerCase(),
      p_qy: newQy,
      p_qn: newQn,
      p_yes_shares: yesShares,
      p_no_shares: noShares,
      p_total_volume: totalVolume,
      p_calculated_shares: calculatedShares,
      p_liquidity_pool: newLiquidityPool,
    })

    if (rpcError) {
      console.error("[v0] Trade RPC error:", rpcError)
      throw new Error(`Trade execution failed: ${rpcError.message}`)
    }

    console.log("[v0] Trade executed successfully:", tradeResult)

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/")
    revalidatePath("/my-bets")

    return { success: true, data: tradeResult }
  } catch (error) {
    console.error("Trade execution failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
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

    const actualPricePerShare = netValue / sharesToSell
    const priceDifference = Math.abs(actualPricePerShare - expectedPricePerShare)
    const slippagePercent = (priceDifference / expectedPricePerShare) * 100

    console.log("[v0] Sell slippage check:", {
      expectedPricePerShare,
      actualPricePerShare,
      slippagePercent: slippagePercent.toFixed(2) + "%",
      maxAllowed: maxSlippagePercent + "%",
    })

    if (slippagePercent > maxSlippagePercent) {
      throw new Error(
        `Price moved too much! Expected $${expectedPricePerShare.toFixed(4)}/share but current price is $${actualPricePerShare.toFixed(4)}/share (${slippagePercent.toFixed(1)}% slippage). Please try again with updated prices.`,
      )
    }

    const rpcParams = {
      p_position_id: positionId,
      p_shares_to_sell: sharesToSell,
      p_expected_value: expectedValue,
      p_market_id: marketId,
      p_user_id: userId,
      p_qy: newQy,
      p_qn: newQn,
      p_yes_shares: yesShares,
      p_no_shares: noShares,
      p_total_volume: totalVolume,
      p_liquidity_pool: newLiquidityPool,
    }

    const { data: sellResult, error: rpcError } = await rpc("sell_shares_lmsr", rpcParams)

    if (rpcError) {
      throw new Error(`Sell execution failed: ${rpcError.message}`)
    }

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/")
    revalidatePath("/my-bets")

    return { success: true, data: sellResult }
  } catch (error) {
    console.error("Sell execution failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
