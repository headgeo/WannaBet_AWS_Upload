import type { Market } from "./markets-client"
import { createClient } from "@/lib/supabase/server"
import { select } from "@/lib/database/adapter"
import { MarketsClient } from "./markets-client"
import UnifiedHeader from "@/components/unified-header"
import { isAdmin } from "@/lib/auth/admin"

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

export const revalidate = 300 // 5 minutes (increased from 30 seconds)

export default async function BrowseMarketsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userIsAdmin = false
  if (user) {
    try {
      userIsAdmin = await isAdmin(user.id)
    } catch {
      userIsAdmin = false
    }
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
        { column: "status", operator: "IN", value: ["active", "suspended", "contested"] },
        { column: "outcome", operator: "=", value: null },
      ],
      { column: "created_at", ascending: false },
    )

    const privateMarketsMap = new Map()
    if (user) {
      const userGroups = await select("user_groups", "group_id", [
        { column: "user_id", operator: "eq", value: user.id },
      ])
      const groupIds = userGroups?.map((ug) => ug.group_id) || []

      console.log("[v0] Browse page - User groups:", groupIds)

      if (groupIds.length > 0) {
        for (const groupId of groupIds) {
          const groupMarkets = await select<Market>(
            "markets",
            "*",
            [
              { column: "is_private", operator: "eq", value: true },
              { column: "group_id", operator: "eq", value: groupId },
              { column: "status", operator: "IN", value: ["active", "suspended", "contested"] },
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

  return (
    <>
      <UnifiedHeader userId={user?.id} userIsAdmin={userIsAdmin} />
      <MarketsClient initialMarkets={markets} error={error} userId={user?.id} userIsAdmin={userIsAdmin} />
    </>
  )
}
