"use server"

import { select, query } from "@/lib/database/adapter"
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
    // Get user's group IDs
    const userGroups = await select<any>("user_groups", ["group_id"], [{ column: "user_id", value: user.id }])

    const userGroupIds = userGroups.map((ug: any) => ug.group_id)

    let privateMarkets: any[] = []

    if (userGroupIds.length > 0) {
      // Get markets created by user
      const createdMarkets = await query<any>(
        `
        SELECT 
          m.*,
          p.username as creator_username,
          p.display_name as creator_display_name
        FROM markets m
        LEFT JOIN profiles p ON m.creator_id = p.id
        WHERE m.is_private = true 
          AND m.creator_id = $1
        ORDER BY m.created_at DESC
      `,
        [user.id],
      )

      // Get markets from user's groups
      const groupMarkets = await query<any>(
        `
        SELECT 
          m.*,
          p.username as creator_username,
          p.display_name as creator_display_name
        FROM markets m
        LEFT JOIN profiles p ON m.creator_id = p.id
        WHERE m.is_private = true 
          AND m.group_id = ANY($1::uuid[])
        ORDER BY m.created_at DESC
      `,
        [userGroupIds],
      )

      // Combine and deduplicate
      const allMarkets = [...createdMarkets.rows, ...groupMarkets.rows]
      const uniqueMarkets = allMarkets.filter(
        (market, index, self) => index === self.findIndex((m: any) => m.id === market.id),
      )

      privateMarkets = uniqueMarkets.map((m: any) => ({
        ...m,
        creator: {
          username: m.creator_username || "Unknown",
          display_name: m.creator_display_name || "Unknown User",
        },
      }))
    } else {
      // Only get markets created by user
      const createdMarkets = await query<any>(
        `
        SELECT 
          m.*,
          p.username as creator_username,
          p.display_name as creator_display_name
        FROM markets m
        LEFT JOIN profiles p ON m.creator_id = p.id
        WHERE m.is_private = true 
          AND m.creator_id = $1
        ORDER BY m.created_at DESC
      `,
        [user.id],
      )

      privateMarkets = createdMarkets.rows.map((m: any) => ({
        ...m,
        creator: {
          username: m.creator_username || "Unknown",
          display_name: m.creator_display_name || "Unknown User",
        },
      }))
    }

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
