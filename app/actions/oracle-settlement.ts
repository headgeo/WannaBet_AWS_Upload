"use server"

import { createServerClient } from "@/lib/supabase/server"
import { rpc, select } from "@/lib/database/adapter"
import { revalidatePath } from "next/cache"

export type SettlementStatus = "pending_contest" | "contested" | "resolved" | null

export type BondType = "settlement" | "contest" | "verification"

export type OutcomeChoice = "yes" | "no" | "cancel"

export interface SettlementBond {
  id: string
  market_id: string
  creator_id: string
  bond_amount: number
  outcome_chosen: boolean
  outcome_chosen_text?: OutcomeChoice
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
  contested_outcome_text?: OutcomeChoice
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
  vote_outcome_text?: OutcomeChoice
  vote_bond_amount: number
  is_correct: boolean | null
  status: "active" | "won" | "lost"
  created_at: string
}

function outcomeToBoolean(outcome: OutcomeChoice): boolean | null {
  if (outcome === "yes") return true
  if (outcome === "no") return false
  return null
}

function booleanToOutcome(value: boolean | null): OutcomeChoice | null {
  if (value === true) return "yes"
  if (value === false) return "no"
  return null
}

export async function initiateSettlement(marketId: string, outcome: OutcomeChoice | boolean) {
  try {
    const outcomeText: OutcomeChoice = typeof outcome === "boolean" ? (outcome ? "yes" : "no") : outcome

    console.log("[v0] initiateSettlement: Starting settlement for market:", marketId, "outcome:", outcomeText)

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] initiateSettlement: Auth error:", authError)
      return { success: false, error: "Not authenticated" }
    }

    console.log("[v0] initiateSettlement: User authenticated:", user.id)

    let result
    try {
      console.log("[v0] initiateSettlement: Trying v2 RPC with text outcome:", outcomeText)
      result = await rpc("initiate_settlement_v2", {
        p_creator_id: user.id,
        p_market_id: marketId,
        p_outcome: outcomeText,
      })
    } catch (v2Error) {
      console.log("[v0] initiateSettlement: v2 not available, falling back to v1")
      if (outcomeText === "cancel") {
        return { success: false, error: "Cancel outcome requires database upgrade. Please contact support." }
      }
      result = await rpc("initiate_settlement", {
        p_creator_id: user.id,
        p_market_id: marketId,
        p_outcome: outcomeText === "yes",
      })
    }

    const { data, error } = result

    if (error) {
      console.error("[v0] initiateSettlement: RPC error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] initiateSettlement: RPC success! Data:", data)

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

export async function contestSettlement(marketId: string, contestedOutcome?: OutcomeChoice) {
  try {
    console.log("[v0] contestSettlement: Starting contest for market:", marketId, "with outcome:", contestedOutcome)

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] contestSettlement: Auth error:", authError)
      return { success: false, error: "Not authenticated" }
    }

    console.log("[v0] contestSettlement: User authenticated:", user.id)

    let result
    if (contestedOutcome) {
      try {
        console.log("[v0] contestSettlement: Trying v2 RPC with contested outcome:", contestedOutcome)
        result = await rpc("contest_settlement_v2", {
          p_market_id: marketId,
          p_contestant_id: user.id,
          p_contested_outcome: contestedOutcome,
        })
      } catch (v2Error) {
        console.log("[v0] contestSettlement: v2 not available, falling back to v1")
        result = await rpc("contest_settlement", {
          p_market_id: marketId,
          p_contestant_id: user.id,
        })
      }
    } else {
      result = await rpc("contest_settlement", {
        p_market_id: marketId,
        p_contestant_id: user.id,
      })
    }

    const { data, error } = result

    if (error) {
      console.error("[v0] contestSettlement: RPC error:", error)
      if (error.message?.includes("Insufficient balance")) {
        return {
          success: false,
          error: "Insufficient balance. Please deposit at least $50 to contest this settlement.",
        }
      }
      return { success: false, error: error.message || "Failed to contest settlement" }
    }

    console.log("[v0] contestSettlement: RPC success! Data:", data)

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

export async function submitVote(contestId: string, voteOutcome: OutcomeChoice | boolean) {
  try {
    const outcomeText: OutcomeChoice = typeof voteOutcome === "boolean" ? (voteOutcome ? "yes" : "no") : voteOutcome

    console.log("[v0] submitVote: Starting vote submission", {
      contestId,
      voteOutcome: outcomeText,
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

    console.log("[v0] submitVote: User authenticated:", user.id)

    const contests = await select<any>(
      "settlement_contests",
      ["id", "status", "vote_deadline", "market_id"],
      [{ column: "id", value: contestId }],
    )

    if (!contests || contests.length === 0) {
      console.error("[v0] submitVote: Contest not found in database!")
      return { success: false, error: "Contest not found" }
    }

    const contest = contests[0]

    let result
    try {
      console.log("[v0] submitVote: Trying v2 RPC with text outcome:", outcomeText)
      result = await rpc("submit_vote_v2", {
        p_contest_id: contestId,
        p_voter_id: user.id,
        p_vote_outcome: outcomeText,
      })
    } catch (v2Error) {
      console.log("[v0] submitVote: v2 not available, falling back to v1")
      if (outcomeText === "cancel") {
        return { success: false, error: "Cancel vote requires database upgrade. Please contact support." }
      }
      result = await rpc("submit_vote", {
        p_contest_id: contestId,
        p_voter_id: user.id,
        p_vote_outcome: outcomeText === "yes",
      })
    }

    const { data: rpcData, error: rpcError } = result

    if (rpcError) {
      console.error("[v0] submitVote: RPC error:", rpcError)
      return { success: false, error: rpcError.message }
    }

    console.log("[v0] submitVote: RPC success! Data:", rpcData)

    revalidatePath(`/market/${contest.market_id}`)
    revalidatePath("/my-bets")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error submitting vote:", error)
    return { success: false, error: "Failed to submit vote" }
  }
}

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
      [
        "settlement_status",
        "settlement_initiated_at",
        "contest_deadline",
        "creator_settlement_outcome",
        "creator_settlement_outcome_text",
        "status",
      ],
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

    const voteCounts = { yes: 0, no: 0, cancel: 0 }
    if (contest) {
      const votes = await select<any>(
        "settlement_votes",
        ["vote_outcome", "vote_outcome_text"],
        [{ column: "contest_id", value: contest.id }],
      )
      if (votes) {
        votes.forEach((vote: any) => {
          const outcome = vote.vote_outcome_text || booleanToOutcome(vote.vote_outcome)
          if (outcome === "yes") voteCounts.yes++
          else if (outcome === "no") voteCounts.no++
          else if (outcome === "cancel") voteCounts.cancel++
        })
      }
      console.log("[v0] getSettlementStatus: Vote counts:", voteCounts)
    }

    let isNotifiedVoter = false
    let hasVoted = false

    if (user && contest) {
      // Check if user received a vote_requested notification for this market
      const notifications = await select<any>(
        "notifications",
        ["id", "type"],
        [
          { column: "market_id", value: marketId },
          { column: "user_id", value: user.id },
          { column: "type", value: "vote_requested" },
        ],
      )

      if (notifications && notifications.length > 0) {
        isNotifiedVoter = true
        console.log("[v0] getSettlementStatus: User is notified voter")
      }

      // Check if user has already voted in this contest
      const existingVotes = await select<any>(
        "settlement_votes",
        ["id"],
        [
          { column: "contest_id", value: contest.id },
          { column: "voter_id", value: user.id },
        ],
      )

      if (existingVotes && existingVotes.length > 0) {
        hasVoted = true
        console.log("[v0] getSettlementStatus: User has already voted")
      }
    }

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

    // Priority: 1. market.creator_settlement_outcome_text, 2. bond.outcome_chosen_text, 3. convert boolean
    let creatorOutcomeText: string | null = null
    let creatorOutcome: boolean | null = null

    // First try to get from market table
    if (market.creator_settlement_outcome_text) {
      creatorOutcomeText = market.creator_settlement_outcome_text
      creatorOutcome = market.creator_settlement_outcome
    }
    // Then try from bond table
    else if (bond?.outcome_chosen_text) {
      creatorOutcomeText = bond.outcome_chosen_text
      creatorOutcome = bond.outcome_chosen
    }
    // Finally try boolean conversion
    else if (market.creator_settlement_outcome !== null && market.creator_settlement_outcome !== undefined) {
      creatorOutcome = market.creator_settlement_outcome
      creatorOutcomeText = booleanToOutcome(market.creator_settlement_outcome)
    } else if (bond?.outcome_chosen !== null && bond?.outcome_chosen !== undefined) {
      creatorOutcome = bond.outcome_chosen
      creatorOutcomeText = booleanToOutcome(bond.outcome_chosen)
    }

    console.log(
      "[v0] getSettlementStatus: Resolved creatorOutcome:",
      creatorOutcome,
      "creatorOutcomeText:",
      creatorOutcomeText,
    )

    const result = {
      status: market.settlement_status,
      initiatedAt: market.settlement_initiated_at,
      contestDeadline: market.contest_deadline,
      timeRemaining,
      creatorOutcome: creatorOutcome,
      creatorOutcomeText: creatorOutcomeText,
      bondAmount: bond?.bond_amount,
      bond,
      contest_id: contest?.id,
      contest: contest
        ? {
            ...contest,
            voteCounts,
          }
        : null,
      is_notified_voter: isNotifiedVoter,
      has_voted: hasVoted,
      creator_outcome: creatorOutcome,
      creator_outcome_text: creatorOutcomeText,
      vote_counts: voteCounts,
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

export async function checkPendingSettlements() {
  try {
    console.log("[v0] checkPendingSettlements: Calling check_pending_settlements RPC...")

    const { data, error } = await rpc("check_pending_settlements", {})

    if (error) {
      console.error("[v0] checkPendingSettlements: RPC error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] checkPendingSettlements: RPC Success! Result:", { data })

    return { success: true, data }
  } catch (error) {
    console.error("[v0] checkPendingSettlements: Exception:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function forceSettlePendingSettlements() {
  try {
    console.log("[v0] forceSettlePendingSettlements: Calling force_settle_pending_settlements RPC...")

    const { data, error } = await rpc("force_settle_pending_settlements", {})

    if (error) {
      console.error("[v0] forceSettlePendingSettlements: RPC error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] forceSettlePendingSettlements: RPC Success! Result:", data)

    revalidatePath("/admin")
    revalidatePath("/markets")

    return { success: true, data }
  } catch (error) {
    console.error("[v0] forceSettlePendingSettlements: Exception:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getAllBondsDebug() {
  try {
    console.log("[v0] getAllBondsDebug: Fetching all bonds from AWS RDS...")

    const settlementBonds = await select<any>(
      "settlement_bonds",
      ["id", "market_id", "creator_id", "bond_amount", "status", "created_at"],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getAllBondsDebug: Settlement bonds from RDS:", {
      count: settlementBonds?.length || 0,
    })

    const contestBonds = await select<any>(
      "settlement_contests",
      ["id", "market_id", "contestant_id", "contest_bond_amount", "status", "created_at"],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getAllBondsDebug: Contest bonds from RDS:", {
      count: contestBonds?.length || 0,
    })

    const voteBonds = await select<any>(
      "settlement_votes",
      ["id", "contest_id", "voter_id", "vote_bond_amount", "is_correct", "payout_amount", "created_at"],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getAllBondsDebug: Vote bonds from RDS:", {
      count: voteBonds?.length || 0,
    })

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
        "creator_settlement_outcome_text",
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
