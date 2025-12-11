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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    // Get user's groups
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

    // Fetch user's created markets
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

    // Fetch stats
    const stats = await select("markets", "total_volume", [
      { column: "status", operator: "not.in", value: "(settled,cancelled)" },
    ])

    const totalVolume = stats?.reduce((sum, market) => sum + Number.parseFloat(market.total_volume || "0"), 0) || 0
    const activeMarkets = markets?.length || 0

    return NextResponse.json({
      markets: markets || [],
      privateMarkets: privateMarketsData || [],
      createdMarkets: createdMarkets || [],
      totalVolume,
      activeMarkets,
    })
  } catch (error) {
    console.error("[Markets API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 })
  }
}
