"use server"

import { createServerClient } from "@/lib/supabase/server"
import { rpc, select } from "@/lib/database/adapter"
import { revalidatePath } from "next/cache"
import { checkRateLimit } from "@/lib/rate-limit-enhanced"

export type SettlementStatus = "pending_contest" | "contested" | "resolved" | null

export type BondType = "settlement" | "contest" | "verification"

export interface SettlementBond {
  id: string
  market_id: string
  creator_id: string
  bond_amount: number
  outcome_chosen: boolean
  status: "active" | "returned" | "forfeited"
  created_at: string
  market?: {
    question: string
    status: string
  }
}

export interface ContestBond {
  id: string
  market_id: string
  contestant_id: string
  contest_bond_amount: number
  status: "active" | "returned" | "forfeited"
  created_at: string
  vote_deadline: string
  market?: {
    question: string
  }
}

export interface VerificationBond {
  id: string
  contest_id: string
  voter_id: string
  vote_outcome: boolean
  vote_bond_amount: number
  is_correct: boolean | null
  status: "active" | "won" | "lost"
  created_at: string
}

/**
 * Initiates settlement for a private market
 * Creator posts their fees as collateral and chooses an outcome
 */
export async function initiateSettlement(marketId: string, outcome: boolean) {
  try {
    console.log("[v0] initiateSettlement: Starting settlement for market:", marketId, "outcome:", outcome)

    const supabase = await createServerClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] initiateSettlement: Auth error:", authError)
      return { success: false, error: "Not authenticated" }
    }

    const rateLimit = await checkRateLimit(user.id, "settlement")
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt.toLocaleTimeString()
      return {
        success: false,
        error: `Rate limit exceeded. You can initiate ${rateLimit.remaining} more settlements. Limit resets at ${resetTime}.`,
      }
    }

    console.log("[v0] initiateSettlement: User authenticated:", user.id)
    console.log("[v0] initiateSettlement: Calling RPC with params:", {
      p_creator_id: user.id,
      p_market_id: marketId,
      p_outcome: outcome,
    })

    const { data, error } = await rpc("initiate_settlement", {
      p_creator_id: user.id,
      p_market_id: marketId,
      p_outcome: outcome,
    })

    if (error) {
      console.error("[v0] initiateSettlement: RPC error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] initiateSettlement: RPC success! Data:", data)

    const { data: bondCheck, error: bondError } = await supabase
      .from("settlement_bonds")
      .select("*")
      .eq("market_id", marketId)
      .single()

    console.log("[v0] initiateSettlement: Bond check result:", {
      bond: bondCheck,
      error: bondError,
    })

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/my-bets")

    return {
      success: true,
      data: {
        bondAmount: data.bond_amount,
        contestDeadline: data.contest_deadline,
      },
    }
  } catch (error) {
    console.error("[v0] initiateSettlement: Exception:", error)
    return { success: false, error: "Failed to initiate settlement" }
  }
}

/**
 * Contests a settlement by posting a $50 bond
 * Triggers the voting process
 */
export async function contestSettlement(marketId: string) {
  try {
    console.log("[v0] contestSettlement: Starting contest for market:", marketId)

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] contestSettlement: Auth error:", authError)
      return { success: false, error: "Not authenticated" }
    }

    const rateLimit = await checkRateLimit(user.id, "contest")
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt.toLocaleTimeString()
      return {
        success: false,
        error: `Rate limit exceeded. You can create ${rateLimit.remaining} more contests. Limit resets at ${resetTime}.`,
      }
    }

    console.log("[v0] contestSettlement: User authenticated:", user.id)
    console.log("[v0] contestSettlement: Calling RPC with params:", {
      p_market_id: marketId,
      p_contestant_id: user.id,
    })

    const { data, error } = await rpc("contest_settlement", {
      p_market_id: marketId,
      p_contestant_id: user.id,
    })

    if (error) {
      console.error("[v0] contestSettlement: RPC error:", error)
      console.error("[v0] contestSettlement: Error details:", JSON.stringify(error, null, 2))
      return { success: false, error: error.message }
    }

    console.log("[v0] contestSettlement: RPC success! Data:", data)

    const { data: contestCheck, error: contestError } = await supabase
      .from("settlement_contests")
      .select("*")
      .eq("market_id", marketId)
      .single()

    console.log("[v0] contestSettlement: Contest check result:", {
      contest: contestCheck,
      error: contestError,
    })

    const { data: marketCheck, error: marketError } = await supabase
      .from("markets")
      .select("status, settlement_status")
      .eq("id", marketId)
      .single()

    console.log("[v0] contestSettlement: Market status check:", {
      market: marketCheck,
      error: marketError,
    })

    revalidatePath(`/market/${marketId}`)
    revalidatePath("/my-bets")

    return {
      success: true,
      data: {
        contestId: data.contest_id,
        voteDeadline: data.vote_deadline,
        verifiersNotified: data.verifiers_notified,
      },
    }
  } catch (error) {
    console.error("[v0] contestSettlement: Exception:", error)
    return { success: false, error: "Failed to contest settlement" }
  }
}

/**
 * Submits a vote on a contested settlement
 * Verifier posts $25 bond and votes
 */
export async function submitVote(contestId: string, voteOutcome: boolean) {
  try {
    console.log("[v0] submitVote: Starting vote submission", {
      contestId,
      voteOutcome,
      voteOutcomeType: typeof voteOutcome,
    })

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] submitVote: Auth error:", authError)
      return { success: false, error: "Not authenticated" }
    }

    const rateLimit = await checkRateLimit(user.id, "vote")
    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt.toLocaleTimeString()
      return {
        success: false,
        error: `Rate limit exceeded. You can submit ${rateLimit.remaining} more votes. Limit resets at ${resetTime}.`,
      }
    }

    console.log("[v0] submitVote: User authenticated:", user.id)

    const contests = await select<any>(
      "settlement_contests",
      ["id", "status", "vote_deadline", "market_id"],
      [{ column: "id", value: contestId }],
    )

    console.log("[v0] submitVote: Contest query result:", {
      found: contests && contests.length > 0,
      contest: contests?.[0],
    })

    if (!contests || contests.length === 0) {
      console.error("[v0] submitVote: Contest not found in database!")
      return { success: false, error: "Contest not found" }
    }

    const contest = contests[0]
    console.log("[v0] submitVote: Contest details:", {
      id: contest.id,
      status: contest.status,
      vote_deadline: contest.vote_deadline,
      market_id: contest.market_id,
    })

    console.log("[v0] submitVote: Calling RPC with params:", {
      p_contest_id: contestId,
      p_voter_id: user.id,
      p_vote_outcome: voteOutcome,
    })

    const { data: rpcData, error: rpcError } = await rpc("submit_vote", {
      p_contest_id: contestId,
      p_voter_id: user.id,
      p_vote_outcome: voteOutcome,
    })

    if (rpcError) {
      console.error("[v0] submitVote: RPC error:", rpcError)
      console.error("[v0] RPC error for submit_vote:", rpcError)
      return { success: false, error: rpcError.message }
    }

    console.log("[v0] submitVote: RPC success! Data:", rpcData)

    revalidatePath(`/market/${contest.market_id}`)
    revalidatePath("/my-bets")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error submitting vote:", error)
    console.error("[v0] Exception in submitVote:", error)
    return { success: false, error: "Failed to submit vote" }
  }
}

/**
 * Gets the settlement status for a market
 */
export async function getSettlementStatus(marketId: string) {
  try {
    console.log("[v0] getSettlementStatus: Fetching status for market:", marketId)

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("[v0] getSettlementStatus: User:", user?.id || "not authenticated")

    const markets = await select<any>(
      "markets",
      ["settlement_status", "settlement_initiated_at", "contest_deadline", "creator_settlement_outcome", "status"],
      [{ column: "id", value: marketId }],
    )

    if (!markets || markets.length === 0) {
      console.log("[v0] getSettlementStatus: Market not found")
      return { success: false, error: "Market not found" }
    }

    const market = markets[0]
    console.log("[v0] getSettlementStatus: Market data:", market)

    const bonds = await select<any>("settlement_bonds", ["*"], [{ column: "market_id", value: marketId }])
    const bond = bonds && bonds.length > 0 ? bonds[0] : null
    console.log("[v0] getSettlementStatus: Bond data:", bond)

    const contests = await select<any>("settlement_contests", ["*"], [{ column: "market_id", value: marketId }])
    const contest = contests && contests.length > 0 ? contests[0] : null
    console.log("[v0] getSettlementStatus: Contest data:", contest)

    let voteCount = 0
    if (contest) {
      const votes = await select<any>("settlement_votes", ["id"], [{ column: "contest_id", value: contest.id }])
      voteCount = votes?.length || 0
      console.log("[v0] getSettlementStatus: Vote count:", voteCount)
    }

    let isNotifiedVoter = false
    let hasVoted = false

    if (user && contest) {
      console.log("[v0] getSettlementStatus: Checking if user is notified voter...")

      const notifications = await select<any>(
        "settlement_notifications",
        ["responded_at", "vote_submitted"],
        [
          { column: "contest_id", value: contest.id },
          { column: "user_id", value: user.id },
        ],
      )

      console.log("[v0] getSettlementStatus: Notification query result:", {
        found: notifications && notifications.length > 0,
        data: notifications,
      })

      if (notifications && notifications.length > 0) {
        const notification = notifications[0]
        isNotifiedVoter = true
        hasVoted = notification.vote_submitted || false
        console.log("[v0] getSettlementStatus: User is notified voter! hasVoted:", hasVoted)
      } else {
        console.log("[v0] getSettlementStatus: User is NOT a notified voter")
      }
    }

    // Calculate time remaining for contest deadline
    let timeRemaining = null
    if (market.contest_deadline) {
      const deadline = new Date(market.contest_deadline)
      const now = new Date()
      const diffMs = deadline.getTime() - now.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins > 0) {
        timeRemaining = `${diffMins} minutes remaining`
      } else {
        timeRemaining = "Expired"
      }
    }

    const result = {
      status: market.settlement_status,
      initiatedAt: market.settlement_initiated_at,
      contestDeadline: market.contest_deadline,
      timeRemaining,
      creatorOutcome: market.creator_settlement_outcome,
      bondAmount: bond?.bond_amount,
      bond,
      contest_id: contest?.id,
      contest: contest
        ? {
            ...contest,
            voteCount,
          }
        : null,
      is_notified_voter: isNotifiedVoter,
      has_voted: hasVoted,
      creator_outcome: market.creator_settlement_outcome,
      vote_count: voteCount,
      voting_deadline: contest?.vote_deadline ? new Date(contest.vote_deadline).toLocaleString() : null,
    }

    console.log("[v0] getSettlementStatus: Final result:", result)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error("[v0] getSettlementStatus: Exception:", error)
    return { success: false, error: "Failed to get settlement status" }
  }
}

/**
 * Gets all bonds for the current user
 */
export async function getUserBonds() {
  try {
    console.log("[v0] getUserBonds: Starting bond fetch")

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] getUserBonds: Not authenticated", authError)
      return { success: false, error: "Not authenticated" }
    }

    console.log("[v0] getUserBonds: Fetching bonds for user:", user.id)

    try {
      const { data, error } = await rpc("get_user_settlement_bonds", {
        p_user_id: user.id,
      })

      if (error) {
        console.error("[v0] getUserBonds: RPC error:", error)

        console.log("[v0] getUserBonds: Falling back to direct table queries")

        // Query settlement_bonds table
        const { data: settlementBonds, error: sbError } = await supabase
          .from("settlement_bonds")
          .select(`
            id,
            market_id,
            bond_amount,
            status,
            created_at,
            markets (
              title
            )
          `)
          .eq("creator_id", user.id)

        console.log("[v0] getUserBonds: Settlement bonds query result:", {
          count: settlementBonds?.length || 0,
          error: sbError,
          data: settlementBonds,
        })

        // Query settlement_contests table
        const { data: contestBonds, error: cbError } = await supabase
          .from("settlement_contests")
          .select(`
            id,
            market_id,
            contest_bond_amount,
            status,
            created_at,
            markets (
              title
            )
          `)
          .eq("contestant_id", user.id)

        console.log("[v0] getUserBonds: Contest bonds query result:", {
          count: contestBonds?.length || 0,
          error: cbError,
          data: contestBonds,
        })

        // Query settlement_votes table
        const { data: voteBonds, error: vbError } = await supabase
          .from("settlement_votes")
          .select(`
            id,
            contest_id,
            vote_bond_amount,
            status,
            created_at,
            settlement_contests (
              market_id,
              markets (
                title
              )
            )
          `)
          .eq("voter_id", user.id)

        console.log("[v0] getUserBonds: Vote bonds query result:", {
          count: voteBonds?.length || 0,
          error: vbError,
          data: voteBonds,
        })

        // Transform and combine all bonds
        const allBonds = [
          ...(settlementBonds || []).map((bond: any) => ({
            id: bond.id,
            type: "settlement" as const,
            market_id: bond.market_id,
            market_title: bond.markets?.title || "Unknown Market",
            amount: Number.parseFloat(bond.bond_amount),
            status: bond.status,
            potential_payout: null,
            created_at: bond.created_at,
            resolved_at: null,
          })),
          ...(contestBonds || []).map((bond: any) => ({
            id: bond.id,
            type: "contest" as const,
            market_id: bond.market_id,
            market_title: bond.markets?.title || "Unknown Market",
            amount: Number.parseFloat(bond.contest_bond_amount),
            status: bond.status,
            potential_payout: null,
            created_at: bond.created_at,
            resolved_at: null,
          })),
          ...(voteBonds || []).map((bond: any) => ({
            id: bond.id,
            type: "verification" as const,
            market_id: bond.settlement_contests?.market_id || "",
            market_title: bond.settlement_contests?.markets?.title || "Unknown Market",
            amount: Number.parseFloat(bond.vote_bond_amount),
            status: bond.status,
            potential_payout: bond.payout_amount ? Number.parseFloat(bond.payout_amount) : null,
            created_at: bond.created_at,
            resolved_at: null,
          })),
        ]

        console.log("[v0] getUserBonds: Total bonds found (fallback):", allBonds.length)

        return {
          success: true,
          data: allBonds,
        }
      }

      console.log("[v0] getUserBonds: RPC success, found bonds:", data?.length || 0)
      if (data && data.length > 0) {
        console.log("[v0] getUserBonds: First bond:", data[0])
      }

      // Transform the data to match the expected format
      const bonds = (data || []).map((bond: any) => ({
        id: bond.id,
        type: bond.type,
        market_id: bond.market_id,
        market_title: bond.market_title,
        amount: Number.parseFloat(bond.amount),
        status: bond.status,
        potential_payout: bond.potential_payout ? Number.parseFloat(bond.potential_payout) : null,
        created_at: bond.created_at,
        resolved_at: bond.resolved_at,
      }))

      return {
        success: true,
        data: bonds,
      }
    } catch (rpcError) {
      console.error("[v0] getUserBonds: Exception in RPC call:", rpcError)
      return { success: false, error: "Failed to fetch bonds" }
    }
  } catch (error) {
    console.error("[v0] getUserBonds: Top-level exception:", error)
    return { success: false, error: "Failed to get user bonds" }
  }
}

/**
 * Manually triggers resolution check for pending settlements
 * This would normally be called by a cron job
 */
export async function checkPendingSettlements() {
  try {
    console.log("[v0] checkPendingSettlements: Calling check_pending_settlements RPC...")

    const { data, error } = await rpc("check_pending_settlements", {})

    if (error) {
      console.error("[v0] checkPendingSettlements: RPC error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] checkPendingSettlements: RPC Success! Result:", data)

    revalidatePath("/admin")
    revalidatePath("/my-bets")

    return {
      success: true,
      data: {
        processed: data,
      },
    }
  } catch (error) {
    console.error("[v0] checkPendingSettlements: Exception:", error)
    return { success: false, error: "Failed to check pending settlements" }
  }
}

/**
 * Force settles all pending settlements immediately (for testing)
 * Bypasses the 1-hour waiting period
 */
export async function forceSettlePendingSettlements() {
  try {
    console.log("[v0] forceSettlePendingSettlements: Calling force_settle_pending_settlements RPC...")

    const markets = await select<any>(
      "markets",
      ["id", "title", "status", "settlement_status"],
      [
        {
          column: "settlement_status",
          operator: "IN",
          value: ["pending_contest", "contested"],
        },
      ],
    )

    console.log("[v0] forceSettlePendingSettlements: Found markets before RPC:", {
      count: markets?.length || 0,
      markets: markets?.map((m: any) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        settlement_status: m.settlement_status,
      })),
    })

    const { data, error } = await rpc("force_settle_pending_settlements", {})

    if (error) {
      console.error("[v0] forceSettlePendingSettlements: RPC error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] forceSettlePendingSettlements: RPC Success! Result:", data)

    revalidatePath("/admin")
    revalidatePath("/my-bets")

    return {
      success: true,
      data: {
        processed: data,
      },
    }
  } catch (error) {
    console.error("[v0] forceSettlePendingSettlements: Exception:", error)
    return { success: false, error: "Failed to force settle pending settlements" }
  }
}

/**
 * Gets all bonds from all tables for debugging purposes (admin only)
 */
export async function getAllBondsDebug() {
  try {
    console.log("[v0] getAllBondsDebug: Fetching all bonds from AWS RDS...")

    // Query all settlement bonds
    const settlementBonds = await select<any>(
      "settlement_bonds",
      ["id", "market_id", "creator_id", "bond_amount", "status", "created_at"],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getAllBondsDebug: Settlement bonds from RDS:", {
      count: settlementBonds?.length || 0,
    })

    // Query all contest bonds
    const contestBonds = await select<any>(
      "settlement_contests",
      ["id", "market_id", "contestant_id", "contest_bond_amount", "status", "created_at"],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getAllBondsDebug: Contest bonds from RDS:", {
      count: contestBonds?.length || 0,
    })

    // Query all vote bonds
    const voteBonds = await select<any>(
      "settlement_votes",
      ["id", "contest_id", "voter_id", "vote_bond_amount", "is_correct", "payout_amount", "created_at"],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getAllBondsDebug: Vote bonds from RDS:", {
      count: voteBonds?.length || 0,
    })

    // Get market titles for each bond
    const allMarketIds = [
      ...(settlementBonds || []).map((b: any) => b.market_id),
      ...(contestBonds || []).map((b: any) => b.market_id),
    ]
    const uniqueMarketIds = [...new Set(allMarketIds)]

    const markets = await select<any>(
      "markets",
      ["id", "title", "status"],
      uniqueMarketIds.length > 0 ? [{ column: "id", operator: "IN", value: uniqueMarketIds }] : undefined,
    )

    const marketMap = new Map(markets?.map((m: any) => [m.id, m]) || [])

    // Transform data for display
    const transformedSettlementBonds = (settlementBonds || []).map((bond: any) => {
      const market = marketMap.get(bond.market_id)
      return {
        id: bond.id,
        market_id: bond.market_id,
        user_id: bond.creator_id,
        bond_amount: bond.bond_amount,
        status: bond.status,
        created_at: bond.created_at,
        market_title: market?.title || "Unknown",
        market_status: market?.status || "Unknown",
      }
    })

    const transformedContestBonds = (contestBonds || []).map((bond: any) => {
      const market = marketMap.get(bond.market_id)
      return {
        id: bond.id,
        market_id: bond.market_id,
        contestant_id: bond.contestant_id,
        contest_bond_amount: bond.contest_bond_amount,
        status: bond.status,
        created_at: bond.created_at,
        market_title: market?.title || "Unknown",
        market_status: market?.status || "Unknown",
      }
    })

    const transformedVoteBonds = (voteBonds || []).map((bond: any) => {
      // Derive status: if is_correct is null, it's still active (voting in progress)
      // if is_correct is true and payout > 0, it's won
      // if is_correct is false, it's lost
      let derivedStatus = "active"
      if (bond.is_correct === true && bond.payout_amount > 0) {
        derivedStatus = "won"
      } else if (bond.is_correct === false) {
        derivedStatus = "lost"
      } else if (bond.is_correct === null) {
        derivedStatus = "active"
      }

      return {
        id: bond.id,
        contest_id: bond.contest_id,
        voter_id: bond.voter_id,
        vote_bond_amount: bond.vote_bond_amount,
        is_correct: bond.is_correct,
        payout_amount: bond.payout_amount,
        status: derivedStatus,
        created_at: bond.created_at,
      }
    })

    console.log("[v0] getAllBondsDebug: Total bonds found:", {
      settlement: transformedSettlementBonds.length,
      contest: transformedContestBonds.length,
      vote: transformedVoteBonds.length,
    })

    return {
      success: true,
      data: {
        settlementBonds: transformedSettlementBonds,
        contestBonds: transformedContestBonds,
        voteBonds: transformedVoteBonds,
      },
    }
  } catch (error: any) {
    console.error("[v0] getAllBondsDebug: Exception:", error)
    return {
      success: false,
      error: error.message || "Failed to get all bonds",
    }
  }
}

/**
 * Direct database query to verify settlement columns exist
 */
export async function verifySettlementColumns() {
  try {
    console.log("[v0] verifySettlementColumns: Checking database schema...")

    const markets = await select<any>(
      "markets",
      [
        "id",
        "status",
        "settlement_status",
        "settlement_initiated_at",
        "contest_deadline",
        "creator_settlement_outcome",
      ],
      undefined,
      undefined,
      1,
    )

    if (!markets || markets.length === 0) {
      console.log("[v0] verifySettlementColumns: No markets found in database")
      return {
        success: true,
        columnsExist: true,
        sampleData: null,
      }
    }

    const sampleData = markets[0]
    console.log("[v0] verifySettlementColumns: Successfully queried settlement columns!")
    console.log("[v0] verifySettlementColumns: Sample data:", sampleData)

    return {
      success: true,
      columnsExist: true,
      sampleData,
    }
  } catch (error: any) {
    console.error("[v0] verifySettlementColumns: Exception:", error)
    return {
      success: false,
      error: error.message || "Failed to verify columns",
      columnsExist: false,
    }
  }
}

/**
 * Gets all suspended and contested markets for debugging auto-settlement
 */
export async function getSuspendedMarketsDebug() {
  try {
    console.log("[v0] getSuspendedMarketsDebug: Fetching suspended markets...")

    const markets = await select<any>(
      "markets",
      "*",
      [{ column: "status", operator: "IN", value: ["suspended", "contested"] }],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getSuspendedMarketsDebug: Found markets:", markets?.length || 0)

    if (markets && markets.length > 0) {
      markets.forEach((market, index) => {
        const now = new Date()
        const contestDeadline = market.contest_deadline ? new Date(market.contest_deadline) : null
        const isExpired = contestDeadline ? now > contestDeadline : false

        console.log(`[v0] Market ${index + 1}:`, {
          id: market.id,
          title: market.title,
          status: market.status,
          settlement_status: market.settlement_status,
          settlement_initiated_at: market.settlement_initiated_at,
          contest_deadline: market.contest_deadline,
          is_expired: isExpired,
          minutes_since_deadline: contestDeadline
            ? Math.floor((now.getTime() - contestDeadline.getTime()) / 60000)
            : null,
        })
      })
    }

    return {
      success: true,
      data: markets || [],
    }
  } catch (error) {
    console.error("[v0] getSuspendedMarketsDebug: Exception:", error)
    return { success: false, error: "Failed to get suspended markets" }
  }
}
