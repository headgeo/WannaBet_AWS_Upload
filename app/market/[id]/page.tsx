import { getMarketData } from "./actions"
import { MarketDetailClient } from "./market-detail-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function MarketPage({ params }: { params: { id: string } }) {
  const data = await getMarketData(params.id)

  if (data.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
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

  return (
    <MarketDetailClient
      initialMarket={data.market}
      initialUserPositions={data.userPositions}
      initialUserBalance={data.userBalance}
      initialAccessibleGroups={data.accessibleGroups}
      initialSettlementBond={data.settlementBond}
      currentUserId={data.user.id}
      marketId={params.id}
    />
  )
}
