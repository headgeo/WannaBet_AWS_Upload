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

    // Fetch markets
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

    // Fetch stats
    const stats = await select("markets", "total_volume", [
      { column: "status", operator: "not.in", value: "(settled,cancelled)" },
    ])

    const totalVolume = stats?.reduce((sum, market) => sum + Number.parseFloat(market.total_volume || "0"), 0) || 0
    const activeMarkets = markets?.length || 0

    return NextResponse.json({
      markets: markets || [],
      totalVolume,
      activeMarkets,
    })
  } catch (error) {
    console.error("[v0] Error fetching markets:", error)
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 })
  }
}
