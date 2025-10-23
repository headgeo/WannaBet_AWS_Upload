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

    console.log("[v0] Fetching creator fees for user:", user.id)

    const { data: creatorFeesData, error: feesError } = await supabase
      .from("fees")
      .select(`
        fee_amount,
        markets!inner(
          id,
          status,
          creator_id
        )
      `)
      .eq("fee_type", "creator_fee")
      .eq("markets.creator_id", user.id)
      .eq("markets.status", "settled")

    if (feesError) {
      console.error("[v0] Error fetching creator fees:", feesError)
    }

    console.log("[v0] Creator fees result:", creatorFeesData)
    console.log("[v0] Number of fees found:", creatorFeesData?.length || 0)

    const totalFees = creatorFeesData?.reduce((sum, f) => sum + (Number(f.fee_amount) || 0), 0) || 0
    console.log("[v0] Total fees amount:", totalFees)
    console.log(
      "[v0] Individual fees:",
      creatorFeesData?.map((f) => ({ fee_amount: f.fee_amount, market_id: f.markets?.id })),
    )

    const [positions, marketsCreated, transactions] = await Promise.all([
      select("positions", "id", [{ column: "user_id", value: user.id }]),
      select("markets", "id", [{ column: "creator_id", value: user.id }]),
      select("transactions", "amount", [
        { column: "user_id", value: user.id },
        { column: "type", value: "bet" },
      ]),
    ])

    const stats: UserStats = {
      totalBets: positions?.length || 0,
      marketsCreated: marketsCreated?.length || 0,
      totalVolume: transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
      totalFeesEarned: totalFees,
      winRate: 0, // Would need resolved markets to calculate
    }

    console.log("[v0] Final stats:", stats)

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
