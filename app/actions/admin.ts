"use server"

import { rpc, selectWithJoin, update } from "@/lib/database/adapter"
import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/admin"
import { revalidatePath } from "next/cache"

export async function settleMarket(marketId: string, winningSide: boolean) {
  try {
    await requireAdmin()

    const supabase = await createSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Not authenticated")
    }

    const { data: result, error } = await rpc("settle_market", {
      p_market_id: marketId,
      p_outcome: winningSide,
      p_admin_user_id: user.id,
    })

    if (error) {
      throw new Error(`Settlement failed: ${error.message}`)
    }

    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath(`/market/${marketId}`)

    return { success: true, data: result }
  } catch (error) {
    console.error("Settlement error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function settlePrivateMarket(marketId: string, winningSide: boolean) {
  try {
    const supabase = await createSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Not authenticated")
    }

    const { data: market, error: marketError } = await selectWithJoin("markets", {
      select: "creator_id, is_private, status, liquidity_pool",
      where: [{ column: "id", value: marketId }],
      single: true,
    })

    if (marketError || !market) {
      throw new Error(`Failed to fetch market: ${marketError?.message || "Unknown error"}`)
    }

    if (!market.is_private) {
      throw new Error("This function is only for private markets")
    }

    if (market.creator_id !== user.id) {
      throw new Error("Only the market creator can settle private markets")
    }

    if (market.status === "settled") {
      throw new Error("Market is already settled")
    }

    const { data: result, error } = await rpc("settle_market", {
      p_market_id: marketId,
      p_outcome: winningSide,
      p_admin_user_id: user.id,
    })

    if (error) {
      throw new Error(`Settlement failed: ${error.message}`)
    }

    revalidatePath("/")
    revalidatePath(`/market/${marketId}`)

    return { success: true, data: result }
  } catch (error) {
    console.error("Private market settlement error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getAllMarkets() {
  try {
    await requireAdmin()

    console.log("[v0] getAllMarkets: Starting market fetch")

    // Fetch all markets
    const { data: marketsOnly, error: marketsError } = await selectWithJoin("markets", {
      select: "*",
      orderBy: { column: "created_at", ascending: false },
    })

    console.log("[v0] getAllMarkets: Markets query result:", {
      count: marketsOnly?.length,
      error: marketsError,
    })

    if (marketsError) {
      console.error("[v0] getAllMarkets: Error fetching markets:", marketsError)
      throw new Error(`Failed to fetch markets: ${marketsError.message}`)
    }

    if (!marketsOnly || !Array.isArray(marketsOnly)) {
      console.log("[v0] getAllMarkets: No markets found or invalid data")
      return { success: true, data: [] }
    }

    if (marketsOnly.length === 0) {
      console.log("[v0] getAllMarkets: No markets in database")
      return { success: true, data: [] }
    }

    // Get unique creator IDs
    const creatorIds = [...new Set(marketsOnly.map((m: any) => m.creator_id).filter(Boolean))]
    console.log("[v0] getAllMarkets: Fetching profiles for creator IDs:", creatorIds)

    // Fetch creator profiles
    const { data: profiles, error: profilesError } = await selectWithJoin("profiles", {
      select: "id, username, display_name",
      where: [{ column: "id", operator: "IN", value: creatorIds }],
    })

    console.log("[v0] getAllMarkets: Profiles query result:", {
      count: profiles?.length,
      error: profilesError,
    })

    // Map markets with creator information
    const marketsWithCreators = marketsOnly.map((market: any) => {
      const creator = Array.isArray(profiles) ? profiles.find((p: any) => p.id === market.creator_id) : null

      return {
        ...market,
        creator: creator || {
          username: "Unknown",
          display_name: "Unknown User",
        },
      }
    })

    console.log("[v0] getAllMarkets: Returning", marketsWithCreators.length, "markets")
    return { success: true, data: marketsWithCreators }
  } catch (error) {
    console.error("[v0] getAllMarkets: Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [],
    }
  }
}

export async function getExpiredMarkets() {
  try {
    await requireAdmin()

    const { data: markets, error } = await selectWithJoin("markets", {
      select: `
        *,
        profiles!inner(username, display_name)
      `,
      where: [
        { column: "end_date", operator: "<", value: new Date().toISOString() },
        { column: "status", operator: "NOT IN", value: ["settled", "cancelled"] },
      ],
      orderBy: { column: "end_date", ascending: true },
    })

    if (error) {
      throw new Error(`Failed to fetch expired markets: ${error.message}`)
    }

    return { success: true, data: markets }
  } catch (error) {
    console.error("Error fetching expired markets:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function updateUserRole(userId: string, newRole: "user" | "admin" | "moderator") {
  try {
    await requireAdmin()

    const { error } = await update("profiles", { role: newRole }, { column: "id", value: userId })

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`)
    }

    revalidatePath("/admin")

    return { success: true }
  } catch (error) {
    console.error("Error updating user role:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getFeesAndLiquiditySummary() {
  try {
    await requireAdmin()

    const { data: platformLedger, error: ledgerError } = await selectWithJoin("platform_ledger", {
      select: "transaction_type, amount",
    })

    if (ledgerError) {
      throw new Error(`Failed to fetch platform ledger: ${ledgerError.message}`)
    }

    const siteFees = Array.isArray(platformLedger)
      ? platformLedger
          .filter((entry: any) => entry.transaction_type === "platform_fee")
          .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      : 0

    const settledLiquidity = Array.isArray(platformLedger)
      ? platformLedger
          .filter((entry: any) => entry.transaction_type === "settlement_leftover")
          .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      : 0

    const creatorFeeIn = Array.isArray(platformLedger)
      ? platformLedger
          .filter((entry: any) => entry.transaction_type === "market_creation_reward")
          .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      : 0

    const creatorFeeOut = Array.isArray(platformLedger)
      ? platformLedger
          .filter((entry: any) => entry.transaction_type === "creator_fee_payout")
          .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      : 0

    const creatorRewardBalance = creatorFeeIn - creatorFeeOut

    const totalPosition = Array.isArray(platformLedger)
      ? platformLedger.reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      : 0

    return {
      success: true,
      data: {
        siteFees,
        settledLiquidity,
        creatorRewardBalance,
        totalPosition,
      },
    }
  } catch (error) {
    console.error("Error fetching platform summary:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function cancelMarket(marketId: string) {
  try {
    await requireAdmin()

    const supabase = await createSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Not authenticated")
    }

    const { data: result, error } = await rpc("cancel_market", {
      p_market_id: marketId,
      p_admin_user_id: user.id,
    })

    if (error) {
      throw new Error(`Cancellation failed: ${error.message}`)
    }

    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath(`/market/${marketId}`)

    return { success: true, data: result }
  } catch (error) {
    console.error("Cancellation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function cancelPrivateMarket(marketId: string) {
  try {
    const supabase = await createSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Not authenticated")
    }

    const { data: market, error: marketError } = await selectWithJoin("markets", {
      select: "creator_id, is_private, status",
      where: [{ column: "id", value: marketId }],
      single: true,
    })

    if (marketError || !market) {
      throw new Error(`Failed to fetch market: ${marketError?.message || "Unknown error"}`)
    }

    if (!market.is_private) {
      throw new Error("This function is only for private markets")
    }

    if (market.creator_id !== user.id) {
      throw new Error("Only the market creator can cancel private markets")
    }

    if (market.status === "cancelled") {
      throw new Error("Market is already cancelled")
    }

    if (market.status === "settled") {
      throw new Error("Market is already settled")
    }

    const { data: result, error } = await rpc("cancel_market", {
      p_market_id: marketId,
      p_admin_user_id: user.id,
    })

    if (error) {
      throw new Error(`Cancellation failed: ${error.message}`)
    }

    revalidatePath("/")
    revalidatePath(`/market/${marketId}`)
    revalidatePath("/my-bets")

    return { success: true, data: result }
  } catch (error) {
    console.error("Private market cancellation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function runBalanceReconciliation() {
  try {
    await requireAdmin()

    console.log("[v0] Starting balance reconciliation...")

    const { data: result, error } = await rpc("run_balance_reconciliation", {})

    if (error) {
      throw new Error(`Reconciliation failed: ${error.message}`)
    }

    console.log("[v0] Reconciliation complete:", result)

    const parsedResult = typeof result === "string" ? JSON.parse(result) : result
    const reconciliationData = parsedResult?.run_balance_reconciliation || parsedResult

    return { success: true, data: reconciliationData }
  } catch (error) {
    console.error("Balance reconciliation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
