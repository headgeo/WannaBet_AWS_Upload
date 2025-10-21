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

    // Fetch only sell transactions with P&L data from database
    const pnlResult = await selectWithJoin<any>("transactions", {
      select: `
        transactions.id,
        transactions.market_id,
        transactions.shares,
        transactions.price_per_share,
        transactions.cost_basis,
        transactions.realized_pnl,
        transactions.amount,
        transactions.side,
        transactions.created_at,
        markets.title as market_title,
        markets.status as market_status,
        markets.outcome as market_outcome
      `,
      joins: [{ table: "markets", on: "transactions.market_id = markets.id", type: "INNER" }],
      where: [
        { column: "transactions.user_id", value: user.id },
        { column: "transactions.type", value: "sell" },
      ],
      orderBy: { column: "transactions.created_at", ascending: false },
    })

    if (pnlResult.error) {
      console.error("[v0] Error fetching P&L history:", pnlResult.error)
      throw pnlResult.error
    }

    const pnlData = Array.isArray(pnlResult.data) ? pnlResult.data : []
    console.log("[v0] P&L history fetched:", pnlData.length)

    const pnlHistory: PnLHistory[] = pnlData.map((tx: any) => ({
      id: tx.id,
      market_id: tx.market_id,
      market_title: tx.market_title,
      side: tx.side === true || tx.side === "true" || tx.side === "YES" || tx.side === "Yes" ? "Yes" : "No",
      shares: Number.parseFloat(tx.shares) || 0,
      price_per_share: Number.parseFloat(tx.price_per_share) || 0,
      cost_basis: Number.parseFloat(tx.cost_basis) || 0,
      realized_pnl: Number.parseFloat(tx.realized_pnl) || 0,
      total_amount: Number.parseFloat(tx.amount) || 0,
      created_at: tx.created_at,
      market_status: tx.market_status,
      market_outcome: tx.market_outcome,
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
      (p) => p.shares > 0.01 && p.market.status === "active" && p.market.outcome === null,
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
      ],
      [
        { column: "creator_id", value: user.id },
        { column: "status", operator: "!=", value: "cancelled" },
        { column: "outcome", operator: "=", value: null },
      ],
      { column: "created_at", ascending: false },
    )

    console.log("[v0] Created markets fetched:", createdMarkets.length)

    const transformedCreatedMarkets: CreatedMarket[] = createdMarkets.map((m: any) => ({
      ...m,
      cumulative_creator_fees: m.creator_fees_earned || 0,
    }))

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

    return {
      user,
      positions: activePositions,
      createdMarkets: transformedCreatedMarkets,
      privateMarkets,
      pnlHistory,
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
    }
  }
}
