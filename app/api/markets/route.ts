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

    const userGroups = await select("user_groups", "group_id", [{ column: "user_id", operator: "eq", value: user.id }])

    const groupIds = userGroups?.map((ug) => ug.group_id) || []

    console.log("[v0] User ID:", user.id)
    console.log("[v0] User groups:", groupIds)

    const privateMarketsMap = new Map()
    if (groupIds.length > 0) {
      for (const groupId of groupIds) {
        const groupMarkets = await select(
          "markets",
          "*, settled_at, winning_side",
          [
            { column: "is_private", operator: "eq", value: true },
            { column: "group_id", operator: "eq", value: groupId },
            { column: "status", operator: "eq", value: "active" },
            { column: "outcome", operator: "=", value: null },
          ],
          { column: "created_at", ascending: false },
        )
        if (groupMarkets) {
          // Only add markets that haven't been added yet
          groupMarkets.forEach((market) => {
            if (!privateMarketsMap.has(market.id)) {
              privateMarketsMap.set(market.id, market)
            }
          })
        }
      }
    }
    const privateMarketsData = Array.from(privateMarketsMap.values())

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
      console.log("[v0] Created markets with fees:", createdMarkets[0])
    }

    console.log("[v0] Created markets query result:", createdMarkets?.length || 0, "markets")

    // Fetch stats
    const stats = await select("markets", "total_volume", [
      { column: "status", operator: "not.in", value: "(settled,cancelled)" },
    ])

    const totalVolume = stats?.reduce((sum, market) => sum + Number.parseFloat(market.total_volume || "0"), 0) || 0
    const activeMarkets = markets?.length || 0

    console.log(
      "[v0] Markets API - Public:",
      markets?.length,
      "Private:",
      privateMarketsData?.length,
      "Created:",
      createdMarkets?.length,
    )

    return NextResponse.json({
      markets: markets || [],
      privateMarkets: privateMarketsData || [],
      createdMarkets: createdMarkets || [],
      totalVolume,
      activeMarkets,
    })
  } catch (error) {
    console.error("[v0] Error fetching markets:", error)
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 })
  }
}
