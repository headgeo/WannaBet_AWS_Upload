import { getMarketData } from "./actions"
import { MarketDetailClient } from "./market-detail-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { isAdmin } from "@/lib/auth/admin"

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getMarketData(id)

  if (data.error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card>
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-muted-foreground mb-4">{data.error}</p>
            <Button asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  let userIsAdmin = false
  if (data.user) {
    try {
      userIsAdmin = await isAdmin(data.user.id)
    } catch {
      userIsAdmin = false
    }
  }

  return (
    <MarketDetailClient
      initialMarket={data.market}
      initialUserPositions={data.userPositions}
      initialUserBalance={data.userBalance}
      initialAccessibleGroups={data.accessibleGroups}
      currentUserId={data.user.id}
      marketId={id}
      userIsAdmin={userIsAdmin}
    />
  )
}
