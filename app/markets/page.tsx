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

    const userGroups = await select("user_groups", "group_id", [{ column: "user_id", operator: "eq", value: user.id }])
    const groupIds = userGroups?.map((ug) => ug.group_id) || []

    console.log("[v0] Browse page - User groups:", groupIds)

    const privateMarketsMap = new Map()
    if (groupIds.length > 0) {
      for (const groupId of groupIds) {
        const groupMarkets = await select<Market>(
          "markets",
          "*",
          [
            { column: "is_private", operator: "eq", value: true },
            { column: "group_id", operator: "eq", value: groupId },
            { column: "status", operator: "eq", value: "active" },
            { column: "outcome", operator: "=", value: null },
          ],
          { column: "created_at", ascending: false },
        )
        if (groupMarkets) {
          groupMarkets.forEach((market) => {
            if (!privateMarketsMap.has(market.id)) {
              privateMarketsMap.set(market.id, market)
            }
          })
        }
      }
    }
    const privateMarkets = Array.from(privateMarketsMap.values())

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
