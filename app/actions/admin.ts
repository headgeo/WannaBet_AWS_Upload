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

export async function runLedgerBalanceAudit() {
  try {
    await requireAdmin()

    console.log("[v0] Starting ledger balance audit...")

    // Sum all credits and debits from ledger_entries - they should equal zero
    const { rows, error } = await query(
      `SELECT 
        COALESCE(SUM(credit), 0) as total_credits,
        COALESCE(SUM(debit), 0) as total_debits,
        COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) as difference,
        COUNT(*) as total_entries
      FROM ledger_entries`,
      [],
    )

    if (error) {
      throw new Error(`Ledger balance audit failed: ${error.message}`)
    }

    const result = rows?.[0] || { total_credits: 0, total_debits: 0, difference: 0, total_entries: 0 }

    const totalCredits = Number(result.total_credits)
    const totalDebits = Number(result.total_debits)
    const difference = Number(result.difference)
    const totalEntries = Number(result.total_entries)

    const isBalanced = Math.abs(difference) < 0.01 // Allow for rounding errors up to 1 cent

    console.log("[v0] Ledger balance audit complete:", { totalCredits, totalDebits, difference, isBalanced })

    return {
      success: true,
      data: {
        total_credits: totalCredits,
        total_debits: totalDebits,
        difference: difference,
        total_entries: totalEntries,
        is_balanced: isBalanced,
        status: isBalanced ? "PASS" : "FAIL",
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error("Ledger balance audit error:", error)
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

    // Run all three audits in parallel
    const [positionsResult, marketSharesResult, liquidityResult, summaryResult] = await Promise.all([
      query("SELECT * FROM run_positions_audit()", []),
      query("SELECT * FROM run_market_shares_audit()", []),
      query("SELECT * FROM run_liquidity_audit()", []),
      query("SELECT * FROM run_audit_summary()", []),
    ])

    if (positionsResult.error) throw new Error(`Positions audit failed: ${positionsResult.error.message}`)
    if (marketSharesResult.error) throw new Error(`Market shares audit failed: ${marketSharesResult.error.message}`)
    if (liquidityResult.error) throw new Error(`Liquidity audit failed: ${liquidityResult.error.message}`)
    if (summaryResult.error) throw new Error(`Summary audit failed: ${summaryResult.error.message}`)

    const summary = summaryResult.rows?.[0] || {
      positions_mismatches: 0,
      market_qy_mismatches: 0,
      market_qn_mismatches: 0,
      liquidity_mismatches: 0,
      total_issues: 0,
      status: "PASS",
    }

    return {
      success: true,
      data: {
        summary: {
          status: summary.status,
          position_issues: summary.positions_mismatches,
          market_qy_issues: summary.market_qy_mismatches,
          market_qn_issues: summary.market_qn_mismatches,
          liquidity_issues: summary.liquidity_mismatches,
          total_issues: summary.total_issues,
          timestamp: new Date().toISOString(),
        },
        position_discrepancies: (positionsResult.rows || []).map((row: any) => ({
          user_id: row.user_id,
          market_id: row.market_id,
          side: row.side_display,
          positions_shares: Number(row.positions_shares),
          transactions_shares: Number(row.transactions_shares),
          difference: Number(row.difference),
          has_mismatch: row.has_mismatch,
        })),
        market_share_discrepancies: (marketSharesResult.rows || [])
          .filter((row: any) => row.qy_mismatch || row.qn_mismatch)
          .map((row: any) => ({
            market_id: row.market_id,
            market_title: row.market_title,
            qy: {
              markets: Number(row.qy_markets),
              transactions: Number(row.qy_transactions),
              ledger: Number(row.qy_ledger),
              has_mismatch: row.qy_mismatch,
            },
            qn: {
              markets: Number(row.qn_markets),
              transactions: Number(row.qn_transactions),
              ledger: Number(row.qn_ledger),
              has_mismatch: row.qn_mismatch,
            },
          })),
        liquidity_discrepancies: (liquidityResult.rows || [])
          .filter((row: any) => row.lp_mismatch)
          .map((row: any) => ({
            market_id: row.market_id,
            market_title: row.market_title,
            markets: Number(row.lp_markets),
            ledger: Number(row.lp_ledger),
            transactions: Number(row.lp_transactions),
            has_mismatch: row.lp_mismatch,
          })),
      },
    }
  } catch (error: any) {
    console.error("[v0] Positions audit error:", error)
    return { success: false, error: error.message }
  }
}

export async function getPrivateMarketSettlements() {
  try {
    await requireAdmin()

    console.log("[v0] Fetching private market settlements...")

    const { data: markets, error } = await selectWithJoin("markets", {
      select: `
        id,
        title,
        status,
        is_private,
        settlement_status,
        contest_deadline,
        creator_settlement_outcome,
        creator_settlement_outcome_text,
        end_date,
        created_at,
        creator_id
      `,
      where: [
        { column: "is_private", value: true },
        {
          column: "settlement_status",
          operator: "IN",
          value: ["proposed", "contested", "pending_contest", "ending_contest"],
        },
      ],
      orderBy: { column: "contest_deadline", ascending: true },
    })

    if (error) {
      throw new Error(`Failed to fetch private market settlements: ${error.message}`)
    }

    // Get creator profiles
    const creatorIds = [...new Set((markets || []).map((m: any) => m.creator_id).filter(Boolean))]

    let profiles: any[] = []
    if (creatorIds.length > 0) {
      const { data: profilesData } = await selectWithJoin("profiles", {
        select: "id, username, display_name",
        where: [{ column: "id", operator: "IN", value: creatorIds }],
      })
      profiles = profilesData || []
    }

    const now = new Date()

    const marketsWithDeadlines = (markets || []).map((market: any) => {
      const creator = profiles.find((p: any) => p.id === market.creator_id)
      const contestDeadline = market.contest_deadline ? new Date(market.contest_deadline) : null
      const isPastDeadline = contestDeadline ? contestDeadline < now : false
      const timeRemaining = contestDeadline ? contestDeadline.getTime() - now.getTime() : null

      return {
        ...market,
        creator: creator || { username: "Unknown", display_name: "Unknown" },
        is_past_deadline: isPastDeadline,
        time_remaining_ms: timeRemaining,
        time_remaining_formatted: timeRemaining ? formatTimeRemaining(timeRemaining) : "No deadline set",
      }
    })

    console.log("[v0] Found", marketsWithDeadlines.length, "private markets with settlement status")

    return {
      success: true,
      data: {
        markets: marketsWithDeadlines,
        summary: {
          total: marketsWithDeadlines.length,
          proposed: marketsWithDeadlines.filter((m: any) => m.settlement_status === "proposed").length,
          contested: marketsWithDeadlines.filter((m: any) => m.settlement_status === "contested").length,
          pending_contest: marketsWithDeadlines.filter((m: any) => m.settlement_status === "pending_contest").length,
          ending_contest: marketsWithDeadlines.filter((m: any) => m.settlement_status === "ending_contest").length,
          past_deadline: marketsWithDeadlines.filter((m: any) => m.is_past_deadline).length,
        },
      },
    }
  } catch (error) {
    console.error("Error fetching private market settlements:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "EXPIRED"

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h remaining`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m remaining`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s remaining`
  } else {
    return `${seconds}s remaining`
  }
}

export async function runSiteNetAudit() {
  try {
    await requireAdmin()

    console.log("[v0] Starting site net audit...")

    // Get total deposits
    const { rows: depositRows, error: depositError } = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'deposit'`,
      [],
    )
    if (depositError) throw new Error(`Failed to get deposits: ${depositError.message}`)
    const totalDeposits = Number(depositRows?.[0]?.total || 0)

    // Get total withdrawals
    const { rows: withdrawalRows, error: withdrawalError } = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'withdrawal'`,
      [],
    )
    if (withdrawalError) throw new Error(`Failed to get withdrawals: ${withdrawalError.message}`)
    const totalWithdrawals = Number(withdrawalRows?.[0]?.total || 0)

    // Get platform account balance from ledger_balance_snapshots
    const { rows: platformRows, error: platformError } = await query(
      `SELECT COALESCE(SUM(lbs.balance), 0) as total 
       FROM ledger_balance_snapshots lbs
       JOIN ledger_accounts la ON lbs.account_id = la.id
       WHERE la.account_type = 'platform'`,
      [],
    )
    if (platformError) throw new Error(`Failed to get platform balance: ${platformError.message}`)
    const platformBalance = Number(platformRows?.[0]?.total || 0)

    // Get all user balances from profiles
    const { rows: userBalanceRows, error: userBalanceError } = await query(
      `SELECT COALESCE(SUM(balance), 0) as total FROM profiles`,
      [],
    )
    if (userBalanceError) throw new Error(`Failed to get user balances: ${userBalanceError.message}`)
    const totalUserBalances = Number(userBalanceRows?.[0]?.total || 0)

    // Site Net = Deposits - Withdrawals - Platform Balance - User Balances
    // This should equal zero if all money is accounted for
    const siteNet = totalDeposits - totalWithdrawals - platformBalance - totalUserBalances

    const isBalanced = Math.abs(siteNet) < 0.01 // Allow for rounding errors

    console.log("[v0] Site net audit complete:", {
      totalDeposits,
      totalWithdrawals,
      platformBalance,
      totalUserBalances,
      siteNet,
      isBalanced,
    })

    return {
      success: true,
      data: {
        total_deposits: totalDeposits,
        total_withdrawals: totalWithdrawals,
        platform_balance: platformBalance,
        total_user_balances: totalUserBalances,
        site_net: siteNet,
        is_balanced: isBalanced,
        status: isBalanced ? "PASS" : "FAIL",
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error("Site net audit error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
