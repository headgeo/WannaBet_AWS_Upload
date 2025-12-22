import { createClient } from "@/lib/supabase/server"
import { select } from "@/lib/database/adapter"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const markets = await select(
      "markets",
      "*, settled_at, winning_side",
      [
        { column: "is_private", operator: "eq", value: false },
        { column: "status", operator: "eq", value: "active" },
        { column: "outcome", operator: "=", value: null },
      ],
      { column: "created_at", ascending: false },
      12,
    )

    if (!user) {
      const activeStats = await select("markets", "total_volume", [
        { column: "status", operator: "eq", value: "active" },
      ])
      const totalVolume =
        activeStats?.reduce((sum, market) => sum + Number.parseFloat(market.total_volume || "0"), 0) || 0
      const activeMarketsCount = activeStats?.length || 0

      return NextResponse.json({
        markets: Array.isArray(markets) ? markets : [],
        privateMarkets: [],
        createdMarkets: [],
        totalVolume,
        activeMarkets: activeMarketsCount,
      })
    }

    // User-specific data (only if logged in)
    const userGroups = await select("user_groups", "group_id", [{ column: "user_id", operator: "eq", value: user.id }])
    const groupIds = userGroups?.map((ug) => ug.group_id) || []

    let privateMarketsData: any[] = []
    if (groupIds.length > 0) {
      privateMarketsData = await select(
        "markets",
        "*, settled_at, winning_side",
        [
          { column: "is_private", operator: "eq", value: true },
          { column: "group_id", operator: "in", value: groupIds },
          { column: "status", operator: "eq", value: "active" },
          { column: "outcome", operator: "=", value: null },
        ],
        { column: "created_at", ascending: false },
      )
    }

    const createdMarkets = await select(
      "markets",
      "*, settled_at, winning_side, creator_fees_earned",
      [{ column: "creator_id", operator: "eq", value: user.id }],
      { column: "created_at", ascending: false },
    )

    if (createdMarkets && createdMarkets.length > 0) {
      for (const market of createdMarkets) {
        market.cumulative_creator_fees = Number.parseFloat(market.creator_fees_earned?.toString() || "0")
      }
    }

    const activeStats = await select("markets", "total_volume", [{ column: "status", operator: "eq", value: "active" }])
    const totalVolume =
      activeStats?.reduce((sum, market) => sum + Number.parseFloat(market.total_volume || "0"), 0) || 0
    const activeMarketsCount = activeStats?.length || 0

    return NextResponse.json({
      markets: Array.isArray(markets) ? markets : [],
      privateMarkets: Array.isArray(privateMarketsData) ? privateMarketsData : [],
      createdMarkets: Array.isArray(createdMarkets) ? createdMarkets : [],
      totalVolume,
      activeMarkets: activeMarketsCount,
    })
  } catch (error) {
    console.error("[Markets API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 })
  }
}
