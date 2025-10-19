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
      market_id_param: marketId,
      outcome_param: winningSide,
      admin_user_id: user.id,
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
      throw new Error("Only the market creator can settle private markets")
    }

    if (market.status === "settled") {
      throw new Error("Market is already settled")
    }

    const { data: result, error } = await rpc("settle_market", {
      market_id_param: marketId,
      outcome_param: winningSide,
      admin_user_id: user.id,
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
        { column: "status", operator: "!=", value: "settled" },
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

    const { data: allFeesDebug, error: debugError } = await selectWithJoin("fees", {
      select: "fee_type, fee_amount",
      limit: 100,
    })

    console.log("[v0] All fees (debug):", allFeesDebug)
    console.log(
      "[v0] Unique fee types:",
      Array.isArray(allFeesDebug) ? [...new Set(allFeesDebug.map((f: any) => f.fee_type))] : [],
    )

    const { data: feesData, error: feesError } = await selectWithJoin("fees", {
      select: "fee_amount, fee_type",
      where: [{ column: "fee_type", operator: "IN", value: ["sit_fee", "site_fee"] }],
    })

    console.log("[v0] Fees data:", feesData)
    console.log("[v0] Fees error:", feesError)

    if (feesError) {
      throw new Error(`Failed to fetch fees: ${feesError.message}`)
    }

    const totalSitFees = Array.isArray(feesData)
      ? feesData.reduce((sum: number, fee: any) => sum + Number(fee.fee_amount || 0), 0)
      : 0
    console.log("[v0] Total sit fees calculated:", totalSitFees)

    const { data: marketsData, error: marketsError } = await selectWithJoin("markets", {
      select: "liquidity_pool",
      where: [{ column: "status", operator: "IN", value: ["settled", "cancelled"] }],
    })

    if (marketsError) {
      throw new Error(`Failed to fetch settled markets: ${marketsError.message}`)
    }

    const totalSettledLiquidity = Array.isArray(marketsData)
      ? marketsData.reduce((sum: number, market: any) => sum + Number(market.liquidity_pool || 0), 0)
      : 0

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
      market_id_param: marketId,
      admin_user_id: user.id,
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
      market_id_param: marketId,
      admin_user_id: user.id,
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
