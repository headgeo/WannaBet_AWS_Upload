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
    const marketsData = await select<Market>(
      "markets",
      "*",
      [
        { column: "is_private", operator: "=", value: false },
        { column: "status", operator: "not.in", value: "(settled,cancelled,closed)" },
      ],
      { column: "created_at", ascending: false },
    )

    markets = marketsData || []
  } catch (err: any) {
    console.error("[v0] Error fetching markets:", err)
    error = "Failed to load markets. Please try again later."
  }

  return <MarketsClient initialMarkets={markets} error={error} />
}
