"use server"

import { rpc, selectWithJoin } from "@/lib/database/adapter"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import type { FeeRecord } from "@/lib/fees"
import { canTrade, getMarketStatus } from "@/lib/market-status"

async function recordFee(feeRecord: FeeRecord, marketCreatorId: string) {
  try {
    console.log("[v0] Calling split_trading_fees_secure with:", {
      p_market_id: feeRecord.market_id,
      p_trader_id: feeRecord.user_id,
      p_creator_id: marketCreatorId,
      p_total_fee: feeRecord.fee_amount,
    })

    const { error } = await rpc("split_trading_fees_secure", {
      p_market_id: feeRecord.market_id,
      p_trader_id: feeRecord.user_id,
      p_creator_id: marketCreatorId,
      p_total_fee: feeRecord.fee_amount,
    })

    if (error) {
      console.error("[v0] Failed to record split fees:", error)
      throw new Error(`Fee recording failed: ${error.message}`)
    } else {
      console.log("[v0] Split fees recorded successfully")
    }
  } catch (error) {
    console.error("[v0] Fee recording error:", error)
    throw error
  }
}

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

    const { data: tradeResult, error: rpcError } = await rpc("execute_trade_lmsr", {
      p_market_id: marketId,
      p_user_id: userId,
      p_bet_amount: betAmount,
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
      throw new Error(`Trade execution failed: ${rpcError.message}`)
    }

    await recordFee(
      {
        user_id: userId,
        market_id: marketId,
        transaction_type: "buy",
        original_amount: betAmount,
        fee_amount: feeAmount,
        fee_percentage: 0.01,
        net_amount: netAmount,
      },
      marketData.creator_id,
    )

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

    const { data: sellResult, error: rpcError } = await rpc("sell_shares_lmsr", {
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
    })

    if (rpcError) {
      throw new Error(`Sell execution failed: ${rpcError.message}`)
    }

    await recordFee(
      {
        user_id: userId,
        market_id: marketId,
        transaction_type: "sell",
        original_amount: expectedValue,
        fee_amount: feeAmount,
        fee_percentage: 0.01,
        net_amount: netValue,
      },
      marketData.creator_id,
    )

    return { success: true, data: sellResult }
  } catch (error) {
    console.error("Sell execution failed:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
