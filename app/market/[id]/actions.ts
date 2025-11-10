"use server"

import { select } from "@/lib/database/adapter"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function getMarketData(marketId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const marketData = await select(
    "markets",
    "*, settled_at, winning_side, settlement_status, settlement_initiated_at, contest_deadline, creator_settlement_outcome, blockchain_market_address, blockchain_status, uma_request_id, uma_liveness_ends_at",
    [{ column: "id", operator: "eq", value: marketId }],
  )

  if (!marketData || marketData.length === 0) {
    return { error: "Market not found", user }
  }

  const market = marketData[0]

  // Check private market access
  if (market.is_private) {
    if (market.creator_id !== user.id) {
      if (market.group_id) {
        const groupMembership = await select("user_groups", "*", [
          { column: "group_id", operator: "eq", value: market.group_id },
          { column: "user_id", operator: "eq", value: user.id },
        ])

        if (!groupMembership || groupMembership.length === 0) {
          return { error: "You don't have access to this private market", user }
        }
      } else {
        return { error: "You don't have access to this private market", user }
      }
    }
  }

  // Fetch creator profile
  const creatorData = await select(
    "profiles",
    ["username", "display_name"],
    [{ column: "id", operator: "eq", value: market.creator_id }],
  )

  const marketWithCreator = {
    ...market,
    creator: creatorData?.[0] || { username: "Unknown", display_name: "Unknown" },
  }

  // Fetch accessible groups for private markets
  let accessibleGroups = []
  if (market.is_private) {
    const groupsData = await select("market_participants", "group_id", [
      { column: "market_id", operator: "eq", value: marketId },
      { column: "group_id", operator: "!=", value: null },
    ])

    if (groupsData && groupsData.length > 0) {
      const groupIds = [...new Set(groupsData.map((g: any) => g.group_id).filter(Boolean))]

      if (groupIds.length > 0) {
        accessibleGroups = await select(
          "groups",
          ["id", "name", "description"],
          [{ column: "id", operator: "in", value: groupIds }],
        )
      }
    }
  }

  // Fetch user positions
  const positionsData = await select("positions", "*", [
    { column: "market_id", operator: "eq", value: marketId },
    { column: "user_id", operator: "eq", value: user.id },
  ])

  // Fetch user balance
  const profileData = await select("profiles", ["balance"], [{ column: "id", operator: "eq", value: user.id }])

  let settlementBond = null
  if (market.settlement_status) {
    const bondData = await select("settlement_bonds", "*", [{ column: "market_id", operator: "eq", value: marketId }])
    settlementBond = bondData?.[0] || null
  }

  return {
    market: marketWithCreator,
    userPositions: positionsData || [],
    userBalance: profileData?.[0]?.balance || 0,
    accessibleGroups: accessibleGroups || [],
    settlementBond,
    user,
  }
}
