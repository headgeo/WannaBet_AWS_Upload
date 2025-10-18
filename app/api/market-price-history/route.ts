import { type NextRequest, NextResponse } from "next/server"
import { select } from "@/lib/database/adapter"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const marketId = searchParams.get("marketId")

    if (!marketId) {
      return NextResponse.json({ error: "Market ID is required" }, { status: 400 })
    }

    console.log("[v0] API: Fetching price history for market:", marketId)

    const data = await select(
      "market_price_history",
      ["timestamp", "yes_probability", "no_probability", "total_volume"],
      [{ column: "market_id", operator: "eq", value: marketId }],
      { column: "timestamp", ascending: true },
    )

    console.log("[v0] API: Found", data?.length || 0, "price history points")
    if (data && data.length > 0) {
      console.log("[v0] API: First data point:", data[0])
      console.log("[v0] API: Latest data point:", data[data.length - 1])
    } else {
      console.log("[v0] API: No price history data found for market:", marketId)
      console.log("[v0] API: This is normal for new markets or markets with no trades yet")
    }

    return NextResponse.json(data || [], {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("[v0] API: Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
