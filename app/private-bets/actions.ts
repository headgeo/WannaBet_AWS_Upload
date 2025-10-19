"use server"

import { selectWithJoin } from "@/lib/database/adapter"
import { createClient } from "@/lib/supabase/server"

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

export async function getPrivateBetsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated", user: null, myActive: [] }
  }

  try {
    console.log("[v0] Fetching private bets data for user:", user.id)

    const createdMarketsResult = await selectWithJoin<any>("markets", {
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
      ],
      orderBy: { column: "markets.created_at", ascending: false },
    })

    const createdMarketsData = Array.isArray(createdMarketsResult.data) ? createdMarketsResult.data : []
    console.log("[v0] Private markets created by user:", createdMarketsData.length)

    const privateMarkets = createdMarketsData.map((m: any) => ({
      ...m,
      creator: {
        username: m.creator_username || "Unknown",
        display_name: m.creator_display_name || "Unknown User",
      },
    }))

    return {
      user,
      myActive: privateMarkets,
      error: null,
    }
  } catch (error: any) {
    console.error("[v0] Error loading private bets data:", error)
    return { error: error.message, user, myActive: [] }
  }
}
