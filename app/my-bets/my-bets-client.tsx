"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TrendingUp,
  TrendingDown,
  History,
  Activity,
  Users,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Receipt,
  DollarSign,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { SellSharesDialog } from "@/components/sell-shares-dialog"
import { sellShares } from "@/app/actions/trade"
import { cancelPrivateMarket } from "@/app/actions/admin"
import { initiateSettlement } from "@/app/actions/oracle-settlement"
import {
  calculateLMSRPrices,
  calculateBFromLiquidity,
  DEFAULT_LIQUIDITY_AMOUNT,
  calculateSellValueWithFee,
} from "@/lib/lmsr"
import { MobileHeader } from "@/components/mobile-header"
import type { Position, CreatedMarket, PrivateMarket, TradeHistory, PnLHistory, Bond } from "./actions"

interface MyBetsClientProps {
  userId: string
  activePositions: Position[]
  proposedToMe: PrivateMarket[]
  createdMarkets: CreatedMarket[]
  trades: TradeHistory[]
  pnlHistory: PnLHistory[]
  initialError: string | null
  bonds: Bond[]
}

export default function MyBetsClient({
  userId,
  activePositions: initialActivePositions,
  proposedToMe: initialProposedToMe,
  createdMarkets: initialCreatedMarkets,
  trades: initialTrades = [], // Added default empty array to prevent undefined error
  pnlHistory: initialPnlHistory = [],
  initialError,
  bonds: initialBonds = [], // Receive bonds as prop
}: MyBetsClientProps) {
  const [activePositions, setActivePositions] = useState(initialActivePositions)
  const [proposedToMe, setProposedToMe] = useState(initialProposedToMe)
  const [createdMarkets, setCreatedMarkets] = useState(initialCreatedMarkets)
  const [trades] = useState(initialTrades || []) // Added fallback to empty array
  const [pnlHistory] = useState(initialPnlHistory || [])
  const [bonds] = useState<Bond[]>(initialBonds) // Use bonds from props
  const [error, setError] = useState<string | null>(initialError)
  const [isSettling, setIsSettling] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null) // Changed from expandedHistoricalId to expandedTradeId
  const [expandedPnlId, setExpandedPnlId] = useState<string | null>(null)
  const router = useRouter()

  const getCurrentSharePrice = (qy: number, qn: number, side: boolean) => {
    const prices = calculateLMSRPrices(qy, qn)
    return side ? prices.yes : prices.no
  }

  const handleSellShares = async (positionId: string, sharesToSell: number, expectedValue: number) => {
    try {
      const position = activePositions.find((p) => p.id === positionId)
      if (!position) throw new Error("Position not found")

      const isSellingAll = Math.abs(sharesToSell - position.shares) < 0.001
      const actualSharesToSell = isSellingAll ? position.shares : sharesToSell

      const newQy = position.side ? position.market.qy - actualSharesToSell : position.market.qy
      const newQn = position.side ? position.market.qn : position.market.qn - actualSharesToSell

      const liquidityAmount = position.market.liquidity_pool || DEFAULT_LIQUIDITY_AMOUNT
      const b = position.market.b || calculateBFromLiquidity(liquidityAmount)
      const sellCalculation = calculateSellValueWithFee(
        actualSharesToSell,
        position.market.qy,
        position.market.qn,
        b,
        position.side,
      )

      const newYesShares = position.side ? position.market.yes_shares - actualSharesToSell : position.market.yes_shares
      const newNoShares = position.side ? position.market.no_shares : position.market.no_shares - actualSharesToSell
      const newLiquidityPool = position.market.liquidity_pool - sellCalculation.netValue

      const result = await sellShares(
        positionId, // 1. positionId
        actualSharesToSell, // 2. sharesToSell
        sellCalculation.grossValue, // 3. expectedValue
        position.market.id, // 4. marketId
        userId, // 5. userId - from props
        newQy, // 6. newQy
        newQn, // 7. newQn
        position.market.total_volume, // 8. totalVolume
        newYesShares, // 9. yesShares
        newNoShares, // 10. noShares
        newLiquidityPool, // 11. newLiquidityPool
        sellCalculation.feeAmount, // 12. feeAmount
        sellCalculation.netValue, // 13. netValue
      )

      if (result.success) {
        if (isSellingAll) {
          setActivePositions((prev) => prev.filter((p) => p.id !== positionId))
        }
        router.refresh()
      } else {
        throw new Error(result.error || "Sell failed")
      }
    } catch (error: any) {
      console.error("Sell shares failed:", error)
      setError(error.message)
    }
  }

  const handleSettleMarket = async (marketId: string, winningSide: boolean) => {
    setIsSettling(marketId)
    setError(null)

    try {
      const result = await initiateSettlement(marketId, winningSide)

      if (!result.success) {
        throw new Error(result.error || "Settlement initiation failed")
      }

      router.refresh()
    } catch (error: any) {
      console.error("[v0] Settlement initiation error:", error)
      setError(error.message)
    } finally {
      setIsSettling(null)
    }
  }

  const handleCancelMarket = async (marketId: string) => {
    setIsCancelling(marketId)
    setError(null)

    try {
      const result = await cancelPrivateMarket(marketId)

      if (!result.success) {
        throw new Error(result.error || "Cancellation failed")
      }

      router.refresh()
    } catch (error: any) {
      console.error("[v0] Cancellation error:", error)
      setError(error.message)
    } finally {
      setIsCancelling(null)
    }
  }

  // Removed fetchBonds function

  const renderPositions = (positions: Position[], isHistorical = false) => {
    if (positions.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            {isHistorical ? (
              <>
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Historical Bets</h3>
                <p className="text-muted-foreground">Your completed bets will appear here once markets are resolved.</p>
              </>
            ) : (
              <>
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Bets</h3>
                <p className="text-muted-foreground mb-4">
                  Start trading on prediction markets to see your positions here.
                </p>
                <Button asChild>
                  <Link href="/">Browse Markets</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {positions.map((position) => {
          const isExpired = new Date(position.market.end_date) < new Date()
          const isCancelled = position.market.status === "cancelled"
          const isWinner = position.market.outcome !== null && position.market.outcome === position.side
          const isLoser = position.market.outcome !== null && position.market.outcome !== position.side
          const canSell = !isHistorical && position.market.status === "active" && position.market.outcome === null

          const refundAmount = isCancelled ? position.amount_invested : 0

          const currentSharePrice =
            position.market.outcome !== null
              ? isWinner
                ? 1.0
                : 0.0
              : isCancelled
                ? 0.0
                : getCurrentSharePrice(position.market.qy || 0, position.market.qn || 0, position.side)

          const currentValue = isCancelled ? 0 : position.shares * currentSharePrice
          const pnl = isCancelled ? 0 : currentValue - position.amount_invested
          const pnlPerShare = isCancelled ? 0 : currentSharePrice - position.avg_price

          const isExpanded = isHistorical && expandedTradeId === position.id

          if (isHistorical) {
            return (
              <Card
                key={position.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setExpandedTradeId(isExpanded ? null : position.id)}
              >
                <CardContent className="p-4">
                  {!isExpanded ? (
                    // Compact view
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={position.side ? "default" : "destructive"} className="text-xs px-1.5 py-0">
                            {position.side ? "YES" : "NO"}
                          </Badge>
                          {position.market.outcome !== null && (
                            <Badge variant={isWinner ? "default" : "destructive"} className="text-xs px-1.5 py-0">
                              {isWinner ? "Won" : "Lost"}
                            </Badge>
                          )}
                          {isCancelled && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              Cancelled
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{position.market.title}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">P&L</div>
                          <div className={`font-semibold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-2">{position.market.title}</h3>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {position.market.category}
                            </Badge>
                            <Badge variant={position.side ? "default" : "destructive"} className="text-xs">
                              {position.side ? "YES" : "NO"}
                            </Badge>
                            {position.market.outcome !== null && (
                              <Badge variant={isWinner ? "default" : "destructive"} className="text-xs">
                                {isWinner ? "✓ Won" : "✗ Lost"}
                              </Badge>
                            )}
                            {isCancelled && (
                              <Badge variant="outline" className="text-xs">
                                Cancelled - Refunded
                              </Badge>
                            )}
                          </div>
                          {isWinner && (
                            <p className="text-xs text-green-600 font-medium mb-2">
                              Congratulations! Your prediction was correct.
                            </p>
                          )}
                          {isLoser && (
                            <p className="text-xs text-red-600 font-medium mb-2">Your prediction was incorrect.</p>
                          )}
                        </div>
                        <ChevronUp className="w-4 h-4 text-muted-foreground ml-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        <div>
                          <div className="text-xs text-muted-foreground">Shares</div>
                          <div className="font-medium text-sm">
                            {Number.parseFloat(position.shares.toString()).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Avg Price</div>
                          <div className="font-medium text-sm">
                            ${Number.parseFloat(position.avg_price.toString()).toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Invested</div>
                          <div className="font-medium text-sm">
                            ${Number.parseFloat(position.amount_invested.toString()).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{isWinner ? "Payout" : "Final"} Price</div>
                          <div className="font-medium text-sm">${currentSharePrice.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {isWinner ? "Total Payout" : "Final Value"}
                          </div>
                          <div className={`font-medium text-sm ${isWinner ? "text-green-600" : ""}`}>
                            ${currentValue.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Profit/Loss</div>
                          <div className={`font-semibold text-sm ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          asChild
                          size="sm"
                          className="w-full bg-transparent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/market/${position.market.id}`}>View Market</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          // Active positions - existing full card view
          return (
            <Card key={position.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm md:text-lg mb-2">{position.market.title}</h3>
                    <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3 flex-wrap">
                      <Badge variant="secondary" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                        {position.market.category}
                      </Badge>
                      <Badge
                        variant={isExpired ? "destructive" : "default"}
                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                      >
                        {position.market.status}
                      </Badge>
                      {isCancelled && (
                        <Badge
                          variant="outline"
                          className="bg-gray-100 dark:bg-gray-800 text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                        >
                          Cancelled - Refunded
                        </Badge>
                      )}
                      {position.market.outcome !== null && !isCancelled && (
                        <Badge
                          variant={isWinner ? "default" : "destructive"}
                          className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                        >
                          {isWinner ? "Won" : "Lost"}
                        </Badge>
                      )}
                      {position.market.is_private && (
                        <Badge variant="outline" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                          Private
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div
                      className={`flex items-center gap-1 mb-1 md:mb-2 ${position.side ? "text-green-600" : "text-red-600"}`}
                    >
                      {position.side ? (
                        <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                      ) : (
                        <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
                      )}
                      <span className="font-semibold text-xs md:text-sm">{position.side ? "YES" : "NO"}</span>
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">
                      {Number.parseFloat(position.shares.toString()).toFixed(2)} shares @ $
                      {Number.parseFloat(position.avg_price.toString()).toFixed(3)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 pt-2 md:pt-4 border-t">
                  <div>
                    <div className="text-xs md:text-sm text-muted-foreground">Invested</div>
                    <div className="font-semibold text-xs md:text-base">
                      ${Number.parseFloat(position.amount_invested.toString()).toFixed(2)}
                    </div>
                  </div>
                  {isCancelled ? (
                    <>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground">Refund</div>
                        <div className="font-semibold text-xs md:text-base text-blue-600">
                          ${refundAmount.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground">Status</div>
                        <div className="font-semibold text-xs md:text-base text-gray-600">Refunded</div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground">Net</div>
                        <div className="font-semibold text-xs md:text-base text-gray-600">$0.00</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground">Price</div>
                        <div className="font-semibold text-xs md:text-base">${currentSharePrice.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground">Value</div>
                        <div className="font-semibold text-xs md:text-base">${currentValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground">P&L</div>
                        <div
                          className={`font-semibold text-xs md:text-base ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] md:text-xs text-muted-foreground">
                          ({pnlPerShare >= 0 ? "+" : ""}${pnlPerShare.toFixed(3)}/sh)
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-2 md:mt-4 flex gap-1 md:gap-2">
                  <Button variant="outline" asChild size="sm" className="text-xs md:text-sm bg-transparent">
                    <Link href={`/market/${position.market.id}`}>View Market</Link>
                  </Button>
                  {canSell && <SellSharesDialog position={position} onSell={handleSellShares} />}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderPrivateBets = (markets: PrivateMarket[]) => {
    if (markets.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Private Markets</h3>
            <p className="text-muted-foreground">
              Private markets you're invited to will appear here. You can trade on them just like public markets.
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {markets.map((market) => (
          <Card key={market.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-start justify-between mb-2 md:mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm md:text-lg mb-1 md:mb-2">{market.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3">{market.description}</p>
                  <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                      {market.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                      Private
                    </Badge>
                    <Badge variant="default" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                      Active
                    </Badge>
                    <span className="text-xs md:text-sm text-muted-foreground">
                      by {market.creator?.display_name || market.creator?.username || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 md:pt-4 border-t">
                <div className="text-xs md:text-sm text-muted-foreground">
                  Ends: {new Date(market.end_date).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" className="text-xs md:text-sm">
                    <Link href={`/market/${market.id}`}>View Market</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderCreatedMarkets = (markets: CreatedMarket[]) => {
    if (markets.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Markets</h3>
            <p className="text-muted-foreground mb-4">
              Markets you create will appear here. You earn 50% of trading fees from your markets.
            </p>
            <Button asChild>
              <Link href="/create-market">Create Market</Link>
            </Button>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {markets.map((market) => {
          const isExpired = new Date(market.end_date) < new Date()
          const canSettle = market.is_private && market.outcome === null

          return (
            <Card key={market.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-3 md:p-6">
                <div className="flex items-start justify-between mb-2 md:mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm md:text-lg mb-1 md:mb-2">{market.title}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3">{market.description}</p>
                    <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                        {market.category}
                      </Badge>
                      <Badge
                        variant={market.status === "active" ? "default" : "secondary"}
                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                      >
                        {market.status === "active" ? "Active" : "Pending"}
                      </Badge>
                      {isExpired && (
                        <Badge variant="destructive" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                          Expired
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                        Creator
                      </Badge>
                      {market.is_private && (
                        <Badge variant="outline" className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5">
                          Private
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 pt-2 md:pt-4 border-t">
                  <div>
                    <div className="text-xs md:text-sm text-muted-foreground">Total Volume</div>
                    <div className="font-semibold text-xs md:text-base">
                      ${Number.parseFloat(market.total_volume.toString()).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs md:text-sm text-muted-foreground">Fees Earned</div>
                    <div className="font-semibold text-xs md:text-base text-green-600">
                      ${Number.parseFloat(market.cumulative_creator_fees.toString()).toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-xs md:text-sm text-muted-foreground">Ends</div>
                    <div className="font-semibold text-xs md:text-base">
                      {new Date(market.end_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {canSettle && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-800 dark:text-orange-200">
                        {isExpired ? "Ready to Settle or Cancel" : "Settle or Cancel Market"}
                      </span>
                    </div>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                      {isExpired
                        ? "This private market has expired. Choose the winning outcome to settle it, or cancel to refund all participants:"
                        : "As the creator, you can settle this private market at any time, or cancel it to refund all participants:"}
                    </p>
                    <div className="flex gap-3 mb-2">
                      <Button
                        onClick={() => handleSettleMarket(market.id, true)}
                        disabled={isSettling === market.id || isCancelling === market.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isSettling === market.id ? "Settling..." : "Settle as YES"}
                      </Button>
                      <Button
                        onClick={() => handleSettleMarket(market.id, false)}
                        disabled={isSettling === market.id || isCancelling === market.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isSettling === market.id ? "Settling..." : "Settle as NO"}
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleCancelMarket(market.id)}
                      disabled={isSettling === market.id || isCancelling === market.id}
                      variant="outline"
                      className="w-full border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                    >
                      {isCancelling === market.id ? "Cancelling..." : "Cancel Market (Refund All)"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Cancelling will refund all participants at their average purchase price.
                    </p>
                  </div>
                )}

                <div className="mt-2 md:mt-4">
                  <Button variant="outline" asChild size="sm" className="text-xs md:text-sm bg-transparent">
                    <Link href={`/market/${market.id}`}>View Market</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderTradeHistory = (trades: TradeHistory[]) => {
    if (trades.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Trade History</h3>
            <p className="text-muted-foreground">Your buy and sell transactions will appear here.</p>
          </CardContent>
        </Card>
      )
    }

    // Group trades by market for better organization
    const tradesByMarket = trades.reduce(
      (acc, trade) => {
        if (!acc[trade.market_id]) {
          acc[trade.market_id] = {
            market_title: trade.market_title,
            trades: [],
          }
        }
        acc[trade.market_id].trades.push(trade)
        return acc
      },
      {} as Record<string, { market_title: string; trades: TradeHistory[] }>,
    )

    return (
      <div className="space-y-6">
        {Object.entries(tradesByMarket).map(([marketId, { market_title, trades: marketTrades }]) => {
          const totalPnL = marketTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0)

          return (
            <div key={marketId} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-semibold text-sm truncate flex-1">{market_title}</h3>
                {totalPnL !== 0 && (
                  <div className={`text-sm font-semibold ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                    Total: {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                  </div>
                )}
              </div>

              {marketTrades.map((trade) => {
                const isExpanded = expandedTradeId === trade.id

                return (
                  <Card
                    key={trade.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                  >
                    <CardContent className="p-3">
                      {!isExpanded ? (
                        // Compact view
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge
                              variant={trade.type === "buy" ? "default" : "secondary"}
                              className="text-xs px-1.5 py-0 shrink-0"
                            >
                              {trade.type.toUpperCase()}
                            </Badge>
                            <Badge
                              variant={trade.side === "YES" ? "default" : "destructive"}
                              className="text-xs px-1.5 py-0 shrink-0"
                            >
                              {trade.side}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate">
                              {trade.shares.toFixed(2)} shares @ ${trade.price_per_share.toFixed(3)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {trade.pnl !== null && (
                              <div
                                className={`text-sm font-semibold ${trade.pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                              </div>
                            )}
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      ) : (
                        // Expanded view
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={trade.type === "buy" ? "default" : "secondary"}
                                className="text-xs px-2 py-0.5"
                              >
                                {trade.type.toUpperCase()}
                              </Badge>
                              <Badge
                                variant={trade.side === "YES" ? "default" : "destructive"}
                                className="text-xs px-2 py-0.5"
                              >
                                {trade.side}
                              </Badge>
                              {trade.market_outcome !== null && (
                                <Badge
                                  variant={
                                    (trade.side === "YES" && trade.market_outcome) ||
                                    (trade.side === "NO" && !trade.market_outcome)
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="text-xs px-2 py-0.5"
                                >
                                  {(trade.side === "YES" && trade.market_outcome) ||
                                  (trade.side === "NO" && !trade.market_outcome)
                                    ? "Won"
                                    : "Lost"}
                                </Badge>
                              )}
                            </div>
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                            <div>
                              <div className="text-xs text-muted-foreground">Shares</div>
                              <div className="font-medium text-sm">{trade.shares.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Price/Share</div>
                              <div className="font-medium text-sm">${trade.price_per_share.toFixed(3)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Total Amount</div>
                              <div className="font-medium text-sm">${trade.total_amount.toFixed(2)}</div>
                            </div>
                            {trade.pnl !== null && (
                              <div>
                                <div className="text-xs text-muted-foreground">P&L</div>
                                <div
                                  className={`font-semibold text-sm ${trade.pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                                </div>
                              </div>
                            )}
                            <div className="col-span-2">
                              <div className="text-xs text-muted-foreground">Time</div>
                              <div className="font-medium text-sm">{new Date(trade.created_at).toLocaleString()}</div>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t">
                            <Button
                              variant="outline"
                              asChild
                              size="sm"
                              className="w-full bg-transparent"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link href={`/market/${trade.market_id}`}>View Market</Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const renderPnLHistory = (pnlHistory: PnLHistory[]) => {
    if (pnlHistory.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No P&L History</h3>
            <p className="text-muted-foreground">
              Your realized profits and losses from selling shares will appear here.
            </p>
          </CardContent>
        </Card>
      )
    }

    const totalPnL = pnlHistory.reduce((sum, pnl) => sum + pnl.realized_pnl, 0)
    const winningTrades = pnlHistory.filter((pnl) => pnl.realized_pnl > 0)
    const losingTrades = pnlHistory.filter((pnl) => pnl.realized_pnl < 0)
    const winRate = pnlHistory.length > 0 ? (winningTrades.length / pnlHistory.length) * 100 : 0
    const totalVolume = pnlHistory.reduce((sum, pnl) => sum + pnl.total_amount, 0)
    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, pnl) => sum + pnl.realized_pnl, 0) / winningTrades.length
        : 0
    const avgLoss =
      losingTrades.length > 0 ? losingTrades.reduce((sum, pnl) => sum + pnl.realized_pnl, 0) / losingTrades.length : 0

    // Group by market for better organization
    const pnlByMarket = pnlHistory.reduce(
      (acc, pnl) => {
        if (!acc[pnl.market_id]) {
          acc[pnl.market_id] = {
            market_title: pnl.market_title,
            pnls: [],
          }
        }
        acc[pnl.market_id].pnls.push(pnl)
        return acc
      },
      {} as Record<string, { market_title: string; pnls: PnLHistory[] }>,
    )

    return (
      <div className="space-y-6">
        <Card className="border-2 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Trading Performance</h3>
                <p className="text-sm text-muted-foreground">Realized P&L Summary</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Total Realized P&L</div>
                <div
                  className={`text-3xl font-bold ${totalPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-muted-foreground">Winning Trades</span>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{winningTrades.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Avg: +${avgWin.toFixed(2)}</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-medium text-muted-foreground">Losing Trades</span>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{losingTrades.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Avg: ${avgLoss.toFixed(2)}</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">Win Rate</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{winRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">{pnlHistory.length} total trades</div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-muted-foreground">Total Volume</span>
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">${totalVolume.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground mt-1">Traded</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white px-1">Trade History by Market</h3>

          {Object.entries(pnlByMarket).map(([marketId, { market_title, pnls }]) => {
            const marketTotalPnL = pnls.reduce((sum, pnl) => sum + pnl.realized_pnl, 0)
            const marketWins = pnls.filter((pnl) => pnl.realized_pnl > 0).length
            const marketLosses = pnls.filter((pnl) => pnl.realized_pnl < 0).length

            return (
              <Card key={marketId} className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div
                    className={`px-6 py-4 border-b-2 ${
                      marketTotalPnL >= 0
                        ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800"
                        : "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base mb-2 text-gray-900 dark:text-white line-clamp-2">
                          {market_title}
                        </h4>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{pnls.length} trades</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                              {marketWins}W
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                            <span className="text-sm text-red-700 dark:text-red-400 font-medium">{marketLosses}L</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground mb-1">Market P&L</div>
                        <div
                          className={`text-2xl font-bold ${
                            marketTotalPnL >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {marketTotalPnL >= 0 ? "+" : ""}${marketTotalPnL.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y bg-white dark:bg-gray-950">
                    {pnls.map((pnl) => {
                      const isExpanded = expandedPnlId === pnl.id
                      const isWin = pnl.realized_pnl > 0
                      const isBreakEven = Math.abs(pnl.realized_pnl) < 0.01

                      return (
                        <div
                          key={pnl.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedPnlId(isExpanded ? null : pnl.id)}
                        >
                          <div className={isExpanded ? "p-4" : "px-6 py-3"}>
                            {!isExpanded ? (
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className={`w-1 h-10 rounded-full ${
                                      isWin ? "bg-green-500" : isBreakEven ? "bg-gray-400" : "bg-red-500"
                                    }`}
                                  />
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Badge
                                      variant={pnl.side === "Yes" ? "default" : "destructive"}
                                      className="text-xs px-2 py-0.5 shrink-0 font-semibold"
                                    >
                                      {pnl.side.toUpperCase()}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {pnl.shares.toFixed(2)} shares @ ${pnl.price_per_share.toFixed(3)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Cost basis: ${pnl.cost_basis.toFixed(3)}/share
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-right">
                                    <div
                                      className={`text-lg font-bold ${
                                        isWin
                                          ? "text-green-600 dark:text-green-400"
                                          : isBreakEven
                                            ? "text-gray-600 dark:text-gray-400"
                                            : "text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      {pnl.realized_pnl >= 0 ? "+" : ""}${pnl.realized_pnl.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      ${pnl.total_amount.toFixed(2)} received
                                    </div>
                                  </div>
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={pnl.side === "Yes" ? "default" : "destructive"}
                                      className="text-xs px-2.5 py-0.5 font-semibold"
                                    >
                                      {pnl.side.toUpperCase()} POSITION
                                    </Badge>
                                    {pnl.market_outcome !== null && (
                                      <Badge
                                        variant={
                                          (pnl.side === "Yes" && pnl.market_outcome) ||
                                          (pnl.side === "No" && !pnl.market_outcome)
                                            ? "default"
                                            : "destructive"
                                        }
                                        className="text-xs px-2.5 py-0.5"
                                      >
                                        {(pnl.side === "Yes" && pnl.market_outcome) ||
                                        (pnl.side === "No" && !pnl.market_outcome)
                                          ? "✓ Market Won"
                                          : "✗ Market Lost"}
                                      </Badge>
                                    )}
                                  </div>
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                </div>

                                <div className="bg-muted/30 rounded-lg p-4 mb-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">Shares Sold</div>
                                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                                        {pnl.shares.toFixed(2)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">Sale Price</div>
                                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                                        ${pnl.price_per_share.toFixed(3)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">Cost Basis</div>
                                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                                        ${pnl.cost_basis.toFixed(3)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-muted-foreground mb-1">
                                        Total Received
                                      </div>
                                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        ${pnl.total_amount.toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className={`rounded-lg p-4 mb-4 ${
                                    isWin
                                      ? "bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800"
                                      : isBreakEven
                                        ? "bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700"
                                        : "bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800"
                                  }`}
                                >
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">
                                      Realized Profit/Loss
                                    </div>
                                    <div
                                      className={`text-4xl font-bold ${
                                        isWin
                                          ? "text-green-600 dark:text-green-400"
                                          : isBreakEven
                                            ? "text-gray-600 dark:text-gray-400"
                                            : "text-red-600 dark:text-red-400"
                                      }`}
                                    >
                                      {pnl.realized_pnl >= 0 ? "+" : ""}${pnl.realized_pnl.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2">
                                      {((pnl.realized_pnl / (pnl.shares * pnl.cost_basis)) * 100).toFixed(2)}% return
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                                  <span>Trade executed: {new Date(pnl.created_at).toLocaleString()}</span>
                                </div>

                                <Button
                                  variant="outline"
                                  asChild
                                  size="sm"
                                  className="w-full bg-transparent"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Link href={`/market/${pnl.market_id}`}>View Market Details →</Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const renderBonds = (bonds: Bond[]) => {
    if (bonds.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Settlement Bonds</h3>
            <p className="text-muted-foreground">
              When you participate in oracle settlements for private markets (as creator, contestant, or voter), your
              bonds will appear here.
            </p>
          </CardContent>
        </Card>
      )
    }

    const activeBonds = bonds.filter((b) => !b.resolved_at)
    const settledBonds = bonds
      .filter((b) => b.resolved_at)
      .sort((a, b) => {
        if (!a.resolved_at || !b.resolved_at) return 0
        return new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime()
      })

    return (
      <div className="space-y-6">
        {activeBonds.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Outstanding Bonds</h3>
            <div className="space-y-3">
              {activeBonds.map((bond) => (
                <Card
                  key={bond.id}
                  className="border-2 border-orange-400 dark:border-orange-600 bg-white dark:bg-gray-950"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {bond.bond_type === "creator_settlement"
                              ? "Creator Bond"
                              : bond.bond_type === "contest"
                                ? "Contest Bond"
                                : "Vote Bond"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 font-semibold shrink-0"
                          >
                            Outstanding
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mb-1 truncate">{bond.market_title}</p>
                        <p className="text-xs text-muted-foreground">Your bond is locked until the market settles</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                          ${bond.bond_amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Locked</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t gap-2">
                      <div className="text-xs text-muted-foreground">
                        Posted: {new Date(bond.created_at).toLocaleDateString()}
                      </div>
                      <Button variant="ghost" asChild size="sm" className="h-7 text-xs px-2">
                        <Link href={`/market/${bond.market_id}`}>View Market →</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {settledBonds.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Returned Bonds</h3>
            <div className="space-y-3">
              {settledBonds.map((bond) => {
                const payout = bond.payout_amount || 0
                const pnl = payout - bond.bond_amount
                const isProfitable = pnl > 0.01
                const isBreakEven = Math.abs(pnl) < 0.01
                const isLoss = pnl < -0.01

                return (
                  <Card
                    key={bond.id}
                    className={`border-2 bg-white dark:bg-gray-950 ${
                      isProfitable
                        ? "border-green-400 dark:border-green-600"
                        : isLoss
                          ? "border-red-400 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs shrink-0">
                              {bond.bond_type === "creator_settlement"
                                ? "Creator Bond"
                                : bond.bond_type === "contest"
                                  ? "Contest Bond"
                                  : "Vote Bond"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold shrink-0 ${
                                isProfitable
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                                  : isLoss
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {isProfitable ? "✓ Paid Out" : isLoss ? "✗ Lost" : "✓ Returned"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mb-1 truncate">{bond.market_title}</p>
                          {isProfitable && (
                            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                              You won! Received ${pnl.toFixed(2)} profit from losing bonds.
                            </p>
                          )}
                          {isBreakEven && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                              Bond returned in full.
                            </p>
                          )}
                          {isLoss && (
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                              Bond was on losing side. Lost ${Math.abs(pnl).toFixed(2)}.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                        <div>
                          <div className="text-xs text-muted-foreground">Bond Posted</div>
                          <div className="text-sm font-semibold">${bond.bond_amount.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Returned</div>
                          <div
                            className={`text-sm font-bold ${isProfitable ? "text-green-600 dark:text-green-400" : isLoss ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}
                          >
                            ${payout.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">P&L</div>
                          <div
                            className={`text-sm font-bold ${
                              isBreakEven
                                ? "text-black dark:text-white"
                                : isProfitable
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t gap-2">
                        {bond.resolved_at && (
                          <div className="text-xs text-muted-foreground">
                            Returned: {new Date(bond.resolved_at).toLocaleDateString()}
                          </div>
                        )}
                        <Button variant="ghost" asChild size="sm" className="h-7 text-xs px-2 ml-auto">
                          <Link href={`/market/${bond.market_id}`}>View Market →</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 pb-20 md:pb-0">
      <MobileHeader />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4 hidden md:block">
          <Button variant="ghost" asChild className="w-fit">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Bets</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Track all your prediction market positions</p>
        </div>

        {error && (
          <Card className="mb-6">
            <CardContent className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="w-full grid grid-cols-3 gap-1.5 bg-muted p-1 mb-6 rounded-lg">
            <TabsTrigger
              value="active"
              className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 md:px-3 py-1 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
            >
              <Activity className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Active</span>
              <span className="ml-0.5">({activePositions.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="leveraged-positions"
              className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 md:px-3 py-1 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
            >
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden md:inline">Settlement Bonds</span>
              <span className="md:hidden">Bonds</span>
            </TabsTrigger>
            <TabsTrigger
              value="pnl-history"
              className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 md:px-3 py-1 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
            >
              <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>P&L</span>
              <span className="ml-0.5">({pnlHistory.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {renderPositions(activePositions, false)}
          </TabsContent>

          <TabsContent value="leveraged-positions" className="mt-6">
            {renderBonds(bonds)}
          </TabsContent>

          <TabsContent value="pnl-history" className="mt-6">
            {renderPnLHistory(pnlHistory)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
