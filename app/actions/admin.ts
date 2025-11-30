"use server"

import { rpc, selectWithJoin, update, query } from "@/lib/database/adapter"
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

export async function runPositionsAudit() {
  try {
    await requireAdmin()

    console.log("[v0] Starting positions audit...")

    const { rows, error } = await query("SELECT * FROM run_positions_audit()", [])

    if (error) {
      throw new Error(`Positions audit failed: ${error.message}`)
    }

    console.log("[v0] Positions audit raw result:", rows)
    console.log("[v0] Positions audit rows count:", rows?.length || 0)

    const allRows = rows || []

    // Separate user position discrepancies from market state discrepancies
    const userPositionRows = allRows.filter((r: any) => r.audit_type === "user_position")
    const marketLiquidityRows = allRows.filter((r: any) => r.audit_type === "market_liquidity_pool")
    const marketQyRows = allRows.filter((r: any) => r.audit_type === "market_qy")
    const marketQnRows = allRows.filter((r: any) => r.audit_type === "market_qn")

    console.log(
      "[v0] Filtered rows - LP:",
      marketLiquidityRows.length,
      "QY:",
      marketQyRows.length,
      "QN:",
      marketQnRows.length,
      "User:",
      userPositionRows.length,
    )

    // Build position discrepancies
    const position_discrepancies = userPositionRows.map((row: any) => ({
      user_id: row.user_id,
      market_id: row.market_id,
      username: row.user_id?.substring(0, 8) || "Unknown",
      market_title: row.market_id?.substring(0, 8) || "Unknown",
      side: row.position_side ? "YES" : "NO",
      position_table_shares: row.positions_table || 0,
      transaction_snapshot_shares: row.transactions_snapshot || 0,
      calculated_shares: row.calculated || 0,
      discrepancy_vs_snapshot: row.discrepancy || 0,
    }))

    // Build market share discrepancies - group by market_id
    const marketIds = [
      ...new Set([
        ...marketLiquidityRows.map((r: any) => r.market_id),
        ...marketQyRows.map((r: any) => r.market_id),
        ...marketQnRows.map((r: any) => r.market_id),
      ]),
    ]

    const market_share_discrepancies = marketIds.map((marketId: string) => {
      const lpRow = marketLiquidityRows.find((r: any) => r.market_id === marketId)
      const qyRow = marketQyRows.find((r: any) => r.market_id === marketId)
      const qnRow = marketQnRows.find((r: any) => r.market_id === marketId)

      const lpStored = Number(lpRow?.positions_table || 0)
      const lpTxnSnapshot = Number(lpRow?.transactions_snapshot || 0)
      const lpLedgerSnapshot = Number(lpRow?.ledger_snapshot || 0)

      // Discrepancy if ANY of these don't match
      const lpDiscrepancyVsTxn = Math.abs(lpStored - lpTxnSnapshot)
      const lpDiscrepancyVsLedger = Math.abs(lpStored - lpLedgerSnapshot)
      const hasLpDiscrepancy = lpDiscrepancyVsTxn > 0.01 || lpDiscrepancyVsLedger > 0.01

      const qyStored = Number(qyRow?.positions_table || 0)
      const qyTxnSnapshot = Number(qyRow?.transactions_snapshot || 0)
      const qyDiscrepancy = Math.abs(qyStored - qyTxnSnapshot)

      const qnStored = Number(qnRow?.positions_table || 0)
      const qnTxnSnapshot = Number(qnRow?.transactions_snapshot || 0)
      const qnDiscrepancy = Math.abs(qnStored - qnTxnSnapshot)

      const hasDiscrepancy = hasLpDiscrepancy || qyDiscrepancy > 0.01 || qnDiscrepancy > 0.01

      console.log("[v0] Market discrepancy check:", {
        marketId: marketId?.substring(0, 8),
        lpStored,
        lpTxnSnapshot,
        lpLedgerSnapshot,
        lpDiscrepancyVsTxn,
        lpDiscrepancyVsLedger,
        hasLpDiscrepancy,
        hasDiscrepancy,
      })

      return {
        market_id: marketId,
        market_title: marketId?.substring(0, 8) || "Unknown",
        has_discrepancy: hasDiscrepancy,
        qy: {
          stored: qyStored,
          transaction_snapshot: qyTxnSnapshot,
          calculated: Number(qyRow?.calculated || 0),
          discrepancy: qyDiscrepancy,
        },
        qn: {
          stored: qnStored,
          transaction_snapshot: qnTxnSnapshot,
          calculated: Number(qnRow?.calculated || 0),
          discrepancy: qnDiscrepancy,
        },
        liquidity_pool: {
          stored: lpStored,
          transaction_snapshot: lpTxnSnapshot,
          ledger_snapshot: lpLedgerSnapshot,
          calculated: Number(lpRow?.calculated || 0),
          discrepancy_vs_txn: lpDiscrepancyVsTxn,
          discrepancy_vs_ledger: lpDiscrepancyVsLedger,
        },
      }
    })

    const marketsWithIssues = market_share_discrepancies.filter((m) => m.has_discrepancy)

    // Build summary
    const position_issues = position_discrepancies.length
    const market_share_issues = marketsWithIssues.length
    const total_issues = position_issues + market_share_issues

    const auditData = {
      summary: {
        status: total_issues === 0 ? "PASS" : "FAIL",
        position_issues,
        market_share_issues,
        total_issues,
        timestamp: new Date().toISOString(),
      },
      position_discrepancies,
      market_share_discrepancies: marketsWithIssues, // Only return markets with issues
    }

    console.log("[v0] Positions audit transformed:", auditData)

    return { success: true, data: auditData }
  } catch (error) {
    console.error("Positions audit error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
