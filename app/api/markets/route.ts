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

    const privateMarketsData: any[] = []
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
          privateMarketsData.push(...groupMarkets)
        }
      }
    }

    const createdMarkets = await select(
      "markets",
      "*, settled_at, winning_side",
      [{ column: "creator_id", operator: "eq", value: user.id }],
      { column: "created_at", ascending: false },
    )

    if (createdMarkets && createdMarkets.length > 0) {
      for (const market of createdMarkets) {
        const fees = await select("fees", "fee_amount", [
          { column: "market_id", operator: "eq", value: market.id },
          { column: "fee_type", operator: "eq", value: "creator_fee" },
        ])

        const totalFees = fees?.reduce((sum, fee) => sum + Number.parseFloat(fee.fee_amount || "0"), 0) || 0
        market.cumulative_creator_fees = totalFees
      }
    }

    console.log("[v0] Created markets query result:", createdMarkets?.length || 0, "markets")
    if (createdMarkets && createdMarkets.length > 0) {
      console.log("[v0] First created market with fees:", createdMarkets[0])
    }

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
