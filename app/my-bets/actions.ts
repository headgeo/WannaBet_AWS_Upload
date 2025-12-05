"use server"

import { select, selectWithJoin } from "@/lib/database/adapter"
import { createClient } from "@/lib/supabase/server"

export interface Position {
  id: string
  side: boolean
  shares: number
  avg_price: number
  amount_invested: number
  market: {
    id: string
    title: string
    category: string
    status: string
    end_date: string
    outcome: boolean | null
    qy: number
    qn: number
    liquidity_pool: number
    yes_shares: number
    no_shares: number
    total_volume: number
    is_private: boolean
    b?: number
    creator?: {
      username: string
      display_name: string
    }
  }
}

export interface CreatedMarket {
  id: string
  title: string
  description: string
  category: string
  status: string
  end_date: string
  outcome: boolean | null
  creator_id: string
  created_at: string
  total_volume: number
  cumulative_creator_fees: number
  is_private: boolean
  settlement_status?: string
  settlement_initiated_at?: string
  contest_deadline?: string
  creator_settlement_outcome?: boolean
}

export interface PrivateMarket {
  id: string
  title: string
  description: string
  category: string
  status: string
  end_date: string
  outcome: boolean | null
  creator_id: string
  created_at: string
  creator?: {
    username: string
    display_name: string
  }
}

export interface TradeHistory {
  id: string
  market_id: string
  market_title: string
  type: "buy" | "sell"
  side: "YES" | "NO"
  shares: number
  price_per_share: number
  total_amount: number
  pnl: number | null
  created_at: string
  market_status: string
  market_outcome: boolean | null
}

export interface PnLHistory {
  id: string
  market_id: string
  market_title: string
  side: string
  shares: number
  price_per_share: number
  cost_basis: number
  realized_pnl: number
  total_amount: number
  created_at: string
  market_status: string
  market_outcome: boolean | null
  close_type?: "sell" | "settlement_win" | "settlement_loss" | "cancellation_refund"
}

export interface Bond {
  id: string
  market_id: string
  market_title: string
  bond_type: "creator_settlement" | "contest" | "vote"
  bond_amount: number
  payout_amount?: number
  resolved_at?: string
  status: string
  created_at: string
  can_claim: boolean
}

export async function getUserBonds() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated", bonds: [] }
  }

  try {
    console.log("[v0] getUserBonds: Fetching bonds for user:", user.id)

    const bonds: Bond[] = []

    console.log("[v0] getUserBonds: Fetching creator settlement bonds from RDS...")
    const creatorBondsResult = await select<any>(
      "settlement_bonds",
      ["id", "market_id", "bond_amount", "payout_amount", "status", "created_at", "resolved_at"],
      [{ column: "creator_id", value: user.id }],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getUserBonds: Creator bonds from RDS:", creatorBondsResult.length)

    for (const bond of creatorBondsResult) {
      const marketResult = await select<any>("markets", ["title"], [{ column: "id", value: bond.market_id }])
      const market_title = marketResult[0]?.title || "Unknown Market"

      const isReturned = bond.resolved_at !== null
      const payout_amount = isReturned ? Number.parseFloat(bond.payout_amount || "0") : undefined

      bonds.push({
        id: bond.id,
        market_id: bond.market_id,
        market_title,
        bond_type: "creator_settlement" as const,
        bond_amount: Number.parseFloat(bond.bond_amount) || 0,
        payout_amount,
        resolved_at: bond.resolved_at,
        status: bond.status,
        created_at: bond.created_at,
        can_claim: isReturned,
      })
    }

    console.log("[v0] getUserBonds: Fetching contest bonds from RDS...")
    const contestBondsResult = await select<any>(
      "settlement_contests",
      ["id", "market_id", "contest_bond_amount", "payout_amount", "status", "created_at", "resolved_at"],
      [{ column: "contestant_id", value: user.id }],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getUserBonds: Contest bonds from RDS:", contestBondsResult.length)

    for (const bond of contestBondsResult) {
      const marketResult = await select<any>("markets", ["title"], [{ column: "id", value: bond.market_id }])
      const market_title = marketResult[0]?.title || "Unknown Market"

      const isReturned = bond.resolved_at !== null
      const payout_amount = isReturned ? Number.parseFloat(bond.payout_amount || "0") : undefined

      bonds.push({
        id: bond.id,
        market_id: bond.market_id,
        market_title,
        bond_type: "contest" as const,
        bond_amount: Number.parseFloat(bond.contest_bond_amount) || 0,
        payout_amount,
        resolved_at: bond.resolved_at,
        status: bond.status,
        created_at: bond.created_at,
        can_claim: isReturned,
      })
    }

    console.log("[v0] getUserBonds: Fetching voting bonds from RDS...")
    const voteBondsResult = await select<any>(
      "settlement_votes",
      ["id", "contest_id", "vote_bond_amount", "is_correct", "payout_amount", "created_at"],
      [{ column: "voter_id", value: user.id }],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] getUserBonds: Vote bonds from RDS:", voteBondsResult.length)

    for (const vote of voteBondsResult) {
      const contestResult = await select<any>(
        "settlement_contests",
        ["market_id", "status", "resolved_at"],
        [{ column: "id", value: vote.contest_id }],
      )

      if (contestResult.length > 0) {
        const contest = contestResult[0]
        const marketResult = await select<any>("markets", ["title"], [{ column: "id", value: contest.market_id }])
        const market_title = marketResult[0]?.title || "Unknown Market"

        const isReturned = contest.resolved_at !== null
        const payout_amount = isReturned ? Number.parseFloat(vote.payout_amount || "0") : undefined

        let status = contest.status
        if (vote.is_correct !== null) {
          status = vote.is_correct ? "won" : "lost"
        }

        bonds.push({
          id: vote.id,
          market_id: contest.market_id,
          market_title,
          bond_type: "vote" as const,
          bond_amount: Number.parseFloat(vote.vote_bond_amount) || 0,
          payout_amount,
          resolved_at: contest.resolved_at,
          status,
          created_at: vote.created_at,
          can_claim: isReturned,
        })
      }
    }

    console.log("[v0] getUserBonds: Total bonds fetched:", bonds.length)
    console.log("[v0] getUserBonds: Bonds breakdown:", {
      creator: bonds.filter((b) => b.bond_type === "creator_settlement").length,
      contest: bonds.filter((b) => b.bond_type === "contest").length,
      vote: bonds.filter((b) => b.bond_type === "vote").length,
    })

    return { bonds, error: null }
  } catch (error: any) {
    console.error("[v0] getUserBonds: Error:", error)
    return { bonds: [], error: error.message }
  }
}

export async function getUserPnLHistory() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated", pnlHistory: [] }
  }

  try {
    console.log("[v0] Fetching P&L history for user:", user.id)

    const pnlResult = await select<any>(
      "closed_positions",
      [
        "id",
        "market_id",
        "market_title",
        "side",
        "shares",
        "exit_price",
        "cost_basis",
        "proceeds",
        "realized_pnl",
        "close_type",
        "created_at",
        "market_status",
        "market_outcome",
      ],
      [{ column: "user_id", value: user.id }],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] P&L history fetched:", pnlResult.length)

    const pnlHistory: PnLHistory[] = pnlResult.map((cp: any) => ({
      id: cp.id,
      market_id: cp.market_id,
      market_title: cp.market_title || "Unknown Market",
      side: cp.side === "yes" ? "Yes" : "No",
      shares: Number.parseFloat(cp.shares) || 0,
      price_per_share: Number.parseFloat(cp.exit_price) || 0,
      cost_basis: Number.parseFloat(cp.cost_basis) || 0,
      realized_pnl: Number.parseFloat(cp.realized_pnl) || 0,
      total_amount: Number.parseFloat(cp.proceeds) || 0,
      created_at: cp.created_at,
      market_status: cp.market_status || "unknown",
      market_outcome: cp.market_outcome,
      close_type: cp.close_type,
    }))

    console.log("[v0] P&L history processed:", pnlHistory.length)
    return { pnlHistory, error: null }
  } catch (error: any) {
    console.error("[v0] Error loading P&L history:", error)
    return { pnlHistory: [], error: error.message }
  }
}

export async function getMyBetsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      error: "Not authenticated",
      user: null,
      positions: [],
      historicalPositions: [],
      createdMarkets: [],
      privateMarkets: [],
      pnlHistory: [],
      bonds: [], // Added bonds to return
    }
  }

  try {
    console.log("[v0] Fetching my bets data for user:", user.id)

    const positionsResult = await selectWithJoin<any>("positions", {
      select: `
        positions.*,
        markets.id as market_id,
        markets.title as market_title,
        markets.category as market_category,
        markets.status as market_status,
        markets.end_date as market_end_date,
        markets.outcome as market_outcome,
        markets.qy as market_qy,
        markets.qn as market_qn,
        markets.liquidity_pool as market_liquidity_pool,
        markets.yes_shares as market_yes_shares,
        markets.no_shares as market_no_shares,
        markets.total_volume as market_total_volume,
        markets.is_private as market_is_private,
        markets.b as market_b,
        markets.creator_id as market_creator_id,
        profiles.username as creator_username,
        profiles.display_name as creator_display_name
      `,
      joins: [
        { table: "markets", on: "positions.market_id = markets.id", type: "INNER" },
        { table: "profiles", on: "markets.creator_id = profiles.id", type: "LEFT" },
      ],
      where: [{ column: "positions.user_id", value: user.id }],
      orderBy: { column: "positions.created_at", ascending: false },
    })

    if (positionsResult.error) {
      console.error("[v0] Error fetching positions:", positionsResult.error)
      throw positionsResult.error
    }

    const positionsData = Array.isArray(positionsResult.data) ? positionsResult.data : []
    console.log("[v0] Positions fetched:", positionsData.length)

    const transformedPositions: Position[] = positionsData.map((p: any) => ({
      id: p.id,
      side: p.side,
      shares: p.shares,
      avg_price: p.avg_price,
      amount_invested: p.amount_invested,
      market: {
        id: p.market_id,
        title: p.market_title,
        category: p.market_category,
        status: p.market_status,
        end_date: p.market_end_date,
        outcome: p.market_outcome,
        qy: p.market_qy || 0,
        qn: p.market_qn || 0,
        liquidity_pool: p.market_liquidity_pool || 0,
        yes_shares: p.market_yes_shares || 0,
        no_shares: p.market_no_shares || 0,
        total_volume: p.market_total_volume || 0,
        is_private: p.market_is_private || false,
        b: p.market_b,
        creator: {
          username: p.creator_username || "Unknown",
          display_name: p.creator_display_name || "Unknown User",
        },
      },
    }))

    const activePositions = transformedPositions.filter(
      (p) =>
        p.shares > 0.01 &&
        (p.market.status === "active" || p.market.status === "suspended" || p.market.status === "contested") &&
        p.market.outcome === null,
    )

    console.log("[v0] Active positions:", activePositions.length)

    const createdMarkets = await select<any>(
      "markets",
      [
        "id",
        "title",
        "description",
        "category",
        "status",
        "end_date",
        "outcome",
        "creator_id",
        "created_at",
        "total_volume",
        "creator_fees_earned",
        "is_private",
        "settlement_status",
        "settlement_initiated_at",
        "contest_deadline",
        "creator_settlement_outcome",
      ],
      [
        { column: "creator_id", value: user.id },
        { column: "status", operator: "!=", value: "cancelled" },
        { column: "outcome", operator: "=", value: null },
      ],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] Created markets fetched:", createdMarkets.length)

    createdMarkets.forEach((m: any) => {
      console.log(`[v0] Market ${m.id}: creator_fees_earned = ${m.creator_fees_earned}`)
    })

    const transformedCreatedMarkets: CreatedMarket[] = createdMarkets.map((m: any) => ({
      ...m,
      cumulative_creator_fees: m.creator_fees_earned || 0,
    }))

    console.log(
      "[v0] Transformed markets:",
      transformedCreatedMarkets.map((m) => ({
        id: m.id,
        cumulative_creator_fees: m.cumulative_creator_fees,
      })),
    )

    const userGroups = await select<any>("user_groups", ["group_id"], [{ column: "user_id", value: user.id }])

    const userGroupIds = userGroups.map((ug: any) => ug.group_id)
    console.log("[v0] User groups:", userGroupIds.length, userGroupIds)

    let privateMarkets: any[] = []

    if (userGroupIds.length > 0) {
      console.log("[v0] Fetching private markets for groups:", userGroupIds)

      const groupPrivateResult = await selectWithJoin<any>("markets", {
        select: `
          markets.*,
          profiles.username as creator_username,
          profiles.display_name as creator_display_name
        `,
        joins: [{ table: "profiles", on: "markets.creator_id = profiles.id", type: "LEFT" }],
        where: [
          { column: "markets.is_private", value: true },
          { column: "markets.group_id", operator: "IN", value: userGroupIds },
          { column: "markets.status", operator: "!=", value: "cancelled" },
          { column: "markets.outcome", operator: "=", value: null },
        ],
        orderBy: { column: "markets.created_at", ascending: false },
      })

      if (groupPrivateResult.error) {
        console.error("[v0] Error fetching group private markets:", groupPrivateResult.error)
      } else {
        const groupPrivateData = Array.isArray(groupPrivateResult.data) ? groupPrivateResult.data : []
        console.log("[v0] Group private markets fetched:", groupPrivateData.length)

        privateMarkets = groupPrivateData.map((m: any) => ({
          ...m,
          creator: {
            username: m.creator_username || "Unknown",
            display_name: m.creator_display_name || "Unknown User",
          },
        }))
      }
    } else {
      console.log("[v0] User is not in any groups, skipping group private markets")
    }

    const createdPrivateResult = await selectWithJoin<any>("markets", {
      select: `
        markets.*,
        profiles.username as creator_username,
        profiles.display_name as creator_display_name
      `,
      joins: [{ table: "profiles", on: "markets.creator_id = profiles.id", type: "LEFT" }],
      where: [
        { column: "markets.is_private", value: true },
        { column: "markets.creator_id", value: user.id },
        { column: "markets.status", operator: "!=", value: "cancelled" },
        { column: "markets.outcome", operator: "=", value: null },
      ],
      orderBy: { column: "markets.created_at", ascending: false },
    })

    if (createdPrivateResult.error) {
      console.error("[v0] Error fetching created private markets:", createdPrivateResult.error)
    } else {
      const createdPrivateData = Array.isArray(createdPrivateResult.data) ? createdPrivateResult.data : []
      console.log("[v0] Created private markets fetched:", createdPrivateData.length)

      const createdMapped = createdPrivateData.map((m: any) => ({
        ...m,
        creator: {
          username: m.creator_username || "Unknown",
          display_name: m.creator_display_name || "Unknown User",
        },
      }))

      const allMarkets = [...privateMarkets, ...createdMapped]
      privateMarkets = allMarkets.filter(
        (market, index, self) => index === self.findIndex((m: any) => m.id === market.id),
      )
    }

    console.log("[v0] Total private markets:", privateMarkets.length)

    const pnlHistoryResult = await getUserPnLHistory()
    const pnlHistory = pnlHistoryResult.pnlHistory || []

    console.log("[v0] P&L history fetched:", pnlHistory.length)

    const bondsResult = await getUserBonds()
    const bonds = bondsResult.bonds || []
    console.log("[v0] Bonds fetched:", bonds.length)

    return {
      user,
      positions: activePositions,
      createdMarkets: transformedCreatedMarkets,
      privateMarkets,
      pnlHistory,
      bonds, // Added bonds to return
      error: null,
    }
  } catch (error: any) {
    console.error("[v0] Error loading bets data:", error)
    return {
      error: error.message,
      user,
      positions: [],
      createdMarkets: [],
      privateMarkets: [],
      pnlHistory: [],
      bonds: [], // Added bonds to return
    }
  }
}
