"use server"

import { select } from "@/lib/database/adapter"
import { createClient } from "@/lib/supabase/server"

export interface Profile {
  id: string
  username: string
  display_name: string
  bio: string
  balance: number
  created_at: string
}

export interface UserStats {
  totalBets: number
  totalVolume: number
  marketsCreated: number
  winRate: number
  totalFeesEarned: number
}

export async function getProfileData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated", user: null, profile: null, stats: null }
  }

  try {
    // Get profile data
    const profiles = await select<Profile>("profiles", "*", [{ column: "id", value: user.id }], undefined, 1)

    if (!profiles || profiles.length === 0) {
      return { error: "Profile not found", user, profile: null, stats: null }
    }

    const profile = profiles[0]

    const [positions, marketsCreated, transactions, creatorFees] = await Promise.all([
      select("positions", "id", [{ column: "user_id", value: user.id }]),
      select("markets", "id", [{ column: "creator_id", value: user.id }]),
      select("transactions", "amount", [
        { column: "user_id", value: user.id },
        { column: "type", value: "bet" },
      ]),
      select("transactions", "amount", [
        { column: "user_id", value: user.id },
        { column: "type", value: "creator_payout" },
      ]),
    ])

    const stats: UserStats = {
      totalBets: positions?.length || 0,
      marketsCreated: marketsCreated?.length || 0,
      totalVolume: transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
      totalFeesEarned: creatorFees?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
      winRate: 0, // Would need resolved markets to calculate
    }

    return {
      user,
      profile,
      stats,
      error: null,
    }
  } catch (error: any) {
    console.error("[v0] Error loading profile data:", error)
    return { error: error.message, user, profile: null, stats: null }
  }
}
