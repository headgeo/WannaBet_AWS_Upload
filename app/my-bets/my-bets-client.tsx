"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
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
} from "lucide-react"
import Link from "next/link"
import { SellSharesDialog } from "@/components/sell-shares-dialog"
import { sellShares } from "@/app/actions/trade"
import { settlePrivateMarket, cancelPrivateMarket } from "@/app/actions/admin"
import {
  calculateLMSRPrices,
  calculateBFromLiquidity,
  DEFAULT_LIQUIDITY_AMOUNT,
  calculateSellValueWithFee,
} from "@/lib/lmsr"
import type { Position, CreatedMarket, PrivateMarket, TradeHistory, PnLHistory } from "./actions"

interface MyBetsClientProps {
  userId: string
  activePositions: Position[]
  proposedToMe: PrivateMarket[]
  createdMarkets: CreatedMarket[]
  trades: TradeHistory[] // Added trades prop
  pnlHistory: PnLHistory[]
  initialError: string | null
}

export default function MyBetsClient({
  userId,
  activePositions: initialActivePositions,
  proposedToMe: initialProposedToMe,
  createdMarkets: initialCreatedMarkets,
  trades: initialTrades = [], // Added default empty array to prevent undefined error
  pnlHistory: initialPnlHistory = [],
  initialError,
}: MyBetsClientProps) {
  const [activePositions, setActivePositions] = useState(initialActivePositions)
  const [proposedToMe, setProposedToMe] = useState(initialProposedToMe)
  const [createdMarkets, setCreatedMarkets] = useState(initialCreatedMarkets)
  const [trades] = useState(initialTrades || []) // Added fallback to empty array
  const [pnlHistory] = useState(initialPnlHistory || [])
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
      const result = await settlePrivateMarket(marketId, winningSide)

      if (!result.success) {
        throw new Error(result.error || "Settlement failed")
      }

      router.refresh()
    } catch (error: any) {
      console.error("[v0] Settlement error:", error)
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
                    // Expanded view
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
                                {isWinner ? "Won" : "Lost"}
                              </Badge>
                            )}
                            {isCancelled && (
                              <Badge variant="outline" className="text-xs">
                                Cancelled - Refunded
                              </Badge>
                            )}
                          </div>
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
                          <div className="text-xs text-muted-foreground">Sale Price</div>
                          <div className="font-medium text-sm">${currentSharePrice.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Final Value</div>
                          <div className="font-medium text-sm">${currentValue.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">P&L</div>
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
      <div className="space-y-4">
        {Object.entries(pnlByMarket).map(([marketId, { market_title, pnls }]) => {
          const totalPnL = pnls.reduce((sum, pnl) => sum + pnl.realized_pnl, 0)

          return (
            <Card key={marketId} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm truncate flex-1 pr-4 max-w-[70%]">{market_title}</h3>
                  <div
                    className={`text-sm font-semibold shrink-0 ${totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                  </div>
                </div>

                <div className="divide-y">
                  {pnls.map((pnl) => {
                    const isExpanded = expandedPnlId === pnl.id

                    return (
                      <div
                        key={pnl.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedPnlId(isExpanded ? null : pnl.id)}
                      >
                        <div className={isExpanded ? "p-3" : "px-4 py-2"}>
                          {!isExpanded ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2 py-0 shrink-0 w-12 justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                >
                                  {pnl.side}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate">
                                  Sold {pnl.shares.toFixed(2)} @ ${pnl.price_per_share.toFixed(3)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div
                                  className={`text-sm font-semibold ${pnl.realized_pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {pnl.realized_pnl >= 0 ? "+" : ""}${pnl.realized_pnl.toFixed(2)}
                                </div>
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          ) : (
                            // Expanded view
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-2 py-0.5 w-12 justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                  >
                                    {pnl.side}
                                  </Badge>
                                  {pnl.market_outcome !== null && (
                                    <Badge
                                      variant={
                                        (pnl.side === "Yes" && pnl.market_outcome) ||
                                        (pnl.side === "No" && !pnl.market_outcome)
                                          ? "default"
                                          : "destructive"
                                      }
                                      className="text-xs px-2 py-0.5"
                                    >
                                      {(pnl.side === "Yes" && pnl.market_outcome) ||
                                      (pnl.side === "No" && !pnl.market_outcome)
                                        ? "Won"
                                        : "Lost"}
                                    </Badge>
                                  )}
                                </div>
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                                <div>
                                  <div className="text-xs text-muted-foreground">Shares Sold</div>
                                  <div className="font-medium text-sm">{pnl.shares.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Sale Price</div>
                                  <div className="font-medium text-sm">${pnl.price_per_share.toFixed(3)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Cost Basis</div>
                                  <div className="font-medium text-sm">${pnl.cost_basis.toFixed(3)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Total Received</div>
                                  <div className="font-medium text-sm">${pnl.total_amount.toFixed(2)}</div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-xs text-muted-foreground">Realized P&L</div>
                                  <div
                                    className={`font-semibold text-base ${pnl.realized_pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {pnl.realized_pnl >= 0 ? "+" : ""}${pnl.realized_pnl.toFixed(2)}
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-xs text-muted-foreground">Time</div>
                                  <div className="font-medium text-sm">{new Date(pnl.created_at).toLocaleString()}</div>
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
                                  <Link href={`/market/${pnl.market_id}`}>View Market</Link>
                                </Button>
                              </div>
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
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
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
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 md:gap-1 bg-transparent md:bg-muted p-0 md:p-1">
            <TabsTrigger
              value="active"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <Activity className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Active</span>
              <span className="sm:hidden">Active</span>
              <span className="ml-0.5">({activePositions.length})</span>
            </TabsTrigger>
            {/* Removed Historical and Trade History tabs */}
            <TabsTrigger
              value="private-markets"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <Users className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Private Markets</span>
              <span className="sm:hidden">Private</span>
              <span className="ml-0.5">({proposedToMe.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="my-markets"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <Building2 className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">My Markets</span>
              <span className="sm:hidden">Markets</span>
              <span className="ml-0.5">({createdMarkets.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="pnl-history"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">P&L History</span>
              <span className="sm:hidden">P&L</span>
              <span className="ml-0.5">({pnlHistory.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {renderPositions(activePositions, false)}
          </TabsContent>

          {/* Removed Historical tab content */}
          <TabsContent value="private-markets" className="mt-6">
            {renderPrivateBets(proposedToMe)}
          </TabsContent>

          <TabsContent value="my-markets" className="mt-6">
            {renderCreatedMarkets(createdMarkets)}
          </TabsContent>

          <TabsContent value="pnl-history" className="mt-6">
            {renderPnLHistory(pnlHistory)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
