"use server"
import { requireAdmin } from "@/lib/auth/admin"
import { select } from "@/lib/database/adapter"

export async function getFeesAndLiquiditySummary() {
  try {
    await requireAdmin()

    const feesResult = await select(
      "fees",
      ["fee_amount", "fee_type"],
      [
        { column: "fee_type", operator: "eq", value: "sit_fee" },
        { column: "fee_type", operator: "eq", value: "site_fee" },
      ],
    )

    if (feesResult.error) {
      throw new Error(`Failed to fetch fees: ${feesResult.error.message}`)
    }

    const totalSitFees = feesResult.data?.reduce((sum, fee) => sum + Number(fee.fee_amount || 0), 0) || 0
    console.log("[v0] Total sit fees calculated:", totalSitFees)

    const marketsResult = await select(
      "markets",
      ["liquidity_pool"],
      [{ column: "outcome", operator: "neq", value: null }],
    )

    if (marketsResult.error) {
      throw new Error(`Failed to fetch settled markets: ${marketsResult.error.message}`)
    }

    const totalSettledLiquidity =
      marketsResult.data?.reduce((sum, market) => sum + Number(market.liquidity_pool || 0), 0) || 0

    return {
      success: true,
      data: {
        totalSitFees,
        totalSettledLiquidity,
      },
    }
  } catch (error) {
    console.error("Error fetching fees and liquidity summary:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
