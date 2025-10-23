import type { Market } from "./markets-client"
import { createClient } from "@/lib/supabase/server"
import { select } from "@/lib/database/adapter"
import { redirect } from "next/navigation"
import { MarketsClient } from "./markets-client"

const CATEGORIES = [
  "All Categories",
  "Sports",
  "Politics",
  "Technology",
  "Entertainment",
  "Business",
  "Science",
  "Crypto",
  "Weather",
  "Other",
]

export default async function BrowseMarketsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  let markets: Market[] = []
  let error: string | null = null

  try {
    console.log("[v0] Fetching active markets for browse page")

    const publicMarkets = await select<Market>(
      "markets",
      "*",
      [
        { column: "is_private", value: false },
        { column: "status", value: "active" },
        { column: "outcome", operator: "=", value: null },
      ],
      { column: "created_at", ascending: false },
    )

    const { data: participantMarkets } = await supabase
      .from("market_participants")
      .select("market_id")
      .eq("user_id", user.id)

    let privateMarkets: Market[] = []
    if (participantMarkets && participantMarkets.length > 0) {
      const marketIds = participantMarkets.map((p) => p.market_id)
      const { data: privMarkets } = await supabase
        .from("markets")
        .select("*")
        .in("id", marketIds)
        .eq("is_private", true)
        .eq("status", "active")
        .is("outcome", null)
        .order("created_at", { ascending: false })

      privateMarkets = (privMarkets as Market[]) || []
    }

    markets = [...(publicMarkets || []), ...privateMarkets]
    console.log(
      "[v0] Browse markets - Public:",
      publicMarkets?.length,
      "Private:",
      privateMarkets.length,
      "Total:",
      markets.length,
    )
  } catch (err: any) {
    console.error("[v0] Error fetching markets:", err)
    error = "Failed to load markets. Please try again later."
  }

  return <MarketsClient initialMarkets={markets} error={error} />
}
