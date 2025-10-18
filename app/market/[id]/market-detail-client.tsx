"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Users, DollarSign, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { executeTrade } from "@/app/actions/trade"
import { settlePrivateMarket, cancelPrivateMarket } from "@/app/actions/admin"
import {
  calculateSharesToBuyWithFee,
  calculatePricePerShare,
  getMarketOdds,
  calculateYesProbability,
  calculateNoProbability,
} from "@/lib/lmsr"
import { FEE_PERCENTAGE } from "@/lib/fees"
import { getMarketStatusDisplay, canTrade, isSettled } from "@/lib/market-status"
import type { Position } from "@/types/position"
import { MarketPriceChart } from "@/components/market-price-chart"

interface Market {
  id: string
  title: string
  description: string
  category: string
  end_date: string
  resolution_date: string | null
  outcome: boolean | null
  total_volume: number
  yes_shares: number
  no_shares: number
  status: string
  creator_id: string
  qy: number
  qn: number
  liquidity_pool: number
  b: number
  settled_at?: string | null
  winning_side?: boolean | null
  creator: {
    username: string
    display_name: string
  }
  is_private: boolean
  group_id?: string
}

interface Group {
  id: string
  name: string
  description: string | null
}

interface MarketDetailClientProps {
  initialMarket: Market
  initialUserPositions: Position[]
  initialUserBalance: number
  initialAccessibleGroups: Group[]
  currentUserId: string
  marketId: string
}

export function MarketDetailClient({
  initialMarket,
  initialUserPositions,
  initialUserBalance,
  initialAccessibleGroups,
  currentUserId,
  marketId,
}: MarketDetailClientProps) {
  const [market, setMarket] = useState(initialMarket)
  const [userPositions, setUserPositions] = useState(initialUserPositions)
  const [userBalance, setUserBalance] = useState(initialUserBalance)
  const [accessibleGroups] = useState(initialAccessibleGroups)
  const [betAmount, setBetAmount] = useState("")
  const [selectedSide, setSelectedSide] = useState<boolean>(true)
  const [isTrading, setIsTrading] = useState(false)
  const [isSettling, setIsSettling] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const marketStatus = getMarketStatusDisplay(market)

  const calculatePrice = (qy: number, qn: number, b: number, side: boolean, amount: number) => {
    try {
      const result = calculateSharesToBuyWithFee(amount, qy, qn, b, side)
      const avgPrice = calculatePricePerShare(result.effectiveAmount, result.shares)
      return {
        shares: result.shares,
        avgPrice,
        feeAmount: result.feeAmount,
        netAmount: result.netAmount,
        effectiveAmount: result.effectiveAmount,
      }
    } catch (error) {
      console.error("Error calculating price:", error)
      return { shares: 0, avgPrice: 0, feeAmount: 0, netAmount: 0, effectiveAmount: 0 }
    }
  }

  const getCurrentOdds = (qy: number, qn: number, b: number) => {
    return getMarketOdds(qy, qn, b)
  }

  const getCurrentImpliedProbability = (qy: number, qn: number, b: number, side: boolean) => {
    return side ? calculateYesProbability(qy, qn, b) * 100 : calculateNoProbability(qy, qn, b) * 100
  }

  const handleTrade = async () => {
    if (!market || !betAmount || Number.parseFloat(betAmount) <= 0) return

    setIsTrading(true)
    setError(null)

    try {
      const amount = Number.parseFloat(betAmount)

      if (amount > userBalance) {
        throw new Error("Insufficient balance")
      }

      const pricing = calculatePrice(market.qy, market.qn, market.b, selectedSide, amount)
      const shares = pricing.shares

      if (shares <= 0) {
        throw new Error("Invalid trade: would receive 0 or negative shares")
      }

      let newQy: number
      let newQn: number

      if (selectedSide) {
        newQy = market.qy + shares
        newQn = market.qn
      } else {
        newQy = market.qy
        newQn = market.qn + shares
      }

      const newLiquidityPool = market.liquidity_pool + pricing.netAmount

      const result = await executeTrade(
        market.id,
        amount,
        selectedSide ? "YES" : "NO",
        currentUserId,
        newQy,
        newQn,
        shares,
        market.total_volume + amount,
        selectedSide ? market.yes_shares + shares : market.yes_shares,
        !selectedSide ? market.no_shares + shares : market.no_shares,
        newLiquidityPool,
        pricing.feeAmount,
        pricing.netAmount,
      )

      if (!result.success) {
        throw new Error(result.error || "Trade execution failed")
      }

      setBetAmount("")
      router.refresh()
    } catch (error: any) {
      console.error("[v0] Trade failed:", error)
      setError(error.message)
    } finally {
      setIsTrading(false)
    }
  }

  const handlePrivateMarketSettlement = async (winningSide: boolean) => {
    setIsSettling(true)
    setError(null)

    try {
      const result = await settlePrivateMarket(market.id, winningSide)

      if (!result.success) {
        throw new Error(result.error || "Settlement failed")
      }

      router.refresh()
    } catch (error: any) {
      console.error("[v0] Settlement error:", error)
      setError(error.message)
    } finally {
      setIsSettling(false)
    }
  }

  const handlePrivateMarketCancellation = async () => {
    setIsCancelling(true)
    setError(null)

    try {
      const result = await cancelPrivateMarket(market.id)

      if (!result.success) {
        throw new Error(result.error || "Cancellation failed")
      }

      router.refresh()
    } catch (error: any) {
      console.error("[v0] Cancellation error:", error)
      setError(error.message)
    } finally {
      setIsCancelling(false)
    }
  }

  const odds = getCurrentOdds(market.qy, market.qn, market.b)
  const yesPercentage = odds.yesPercent
  const noPercentage = odds.noPercent

  const yesImpliedProbability = getCurrentImpliedProbability(market.qy, market.qn, market.b, true)
  const noImpliedProbability = getCurrentImpliedProbability(market.qy, market.qn, market.b, false)

  const betAmountNum = Number.parseFloat(betAmount) || 0
  const previewPricing =
    betAmountNum > 0 ? calculatePrice(market.qy, market.qn, market.b, selectedSide, betAmountNum) : null

  const tradingAllowed = canTrade(market)
  const marketSettled = isSettled(market)
  const canSettlePrivateMarket =
    market.is_private && market.creator_id === currentUserId && !marketSettled && new Date(market.end_date) < new Date()

  const yesPosition = userPositions.find((pos) => pos.side === true)
  const noPosition = userPositions.find((pos) => pos.side === false)
  const hasAnyPosition = userPositions.length > 0

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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{market.title}</CardTitle>
                    <p className="text-muted-foreground mb-4">{market.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{market.category}</Badge>
                  {marketStatus && (
                    <Badge variant={marketStatus.color} className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {marketStatus.label}
                    </Badge>
                  )}
                  <Badge variant="outline">by {market.creator.display_name || market.creator.username}</Badge>
                  {market.is_private && (
                    <Badge
                      variant="outline"
                      className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    >
                      Private
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="font-medium">YES</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{yesImpliedProbability.toFixed(1)}%</span>
                  </div>

                  <Progress value={yesPercentage} className="h-3" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                      <span className="font-medium">NO</span>
                    </div>
                    <span className="text-lg font-bold text-red-600">{noImpliedProbability.toFixed(1)}%</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Total Volume</span>
                      </div>
                      <div className="text-lg font-semibold">${market.total_volume.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">End Date</span>
                      </div>
                      <div className="text-lg font-semibold">{format(new Date(market.end_date), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {market.is_private && accessibleGroups.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Groups with Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {accessibleGroups.map((group) => (
                      <div
                        key={group.id}
                        className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                      >
                        <div className="font-medium text-purple-900 dark:text-purple-100">{group.name}</div>
                        {group.description && (
                          <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">{group.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    This private market is accessible to members of the groups listed above.
                  </p>
                </CardContent>
              </Card>
            )}

            <MarketPriceChart marketId={marketId} />

            {!tradingAllowed && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">{marketSettled ? "Market Settled" : "Trading Closed"}</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {marketSettled
                      ? `This market has been settled. ${market.winning_side !== undefined ? `${market.winning_side ? "YES" : "NO"} was the winning outcome.` : ""}`
                      : "This market has expired and is awaiting settlement by an administrator."}
                  </p>
                </CardContent>
              </Card>
            )}

            {hasAnyPosition && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Positions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {yesPosition && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-green-600">YES Position</span>
                        <span className="text-sm text-muted-foreground">{yesPosition.shares.toFixed(2)} shares</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Invested: </span>
                          <span className="font-medium">${yesPosition.amount_invested.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Price: </span>
                          <span className="font-medium">${yesPosition.avg_price.toFixed(3)} per share</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {noPosition && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-red-600">NO Position</span>
                        <span className="text-sm text-muted-foreground">{noPosition.shares.toFixed(2)} shares</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Invested: </span>
                          <span className="font-medium">${noPosition.amount_invested.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Price: </span>
                          <span className="font-medium">${noPosition.avg_price.toFixed(3)} per share</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canSettlePrivateMarket && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Settle or Cancel Your Private Market
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    This private market has expired and you can now settle it or cancel it.
                  </p>

                  {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handlePrivateMarketSettlement(true)}
                      disabled={isSettling || isCancelling}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isSettling ? "Settling..." : "Settle as YES"}
                    </Button>
                    <Button
                      onClick={() => handlePrivateMarketSettlement(false)}
                      disabled={isSettling || isCancelling}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {isSettling ? "Settling..." : "Settle as NO"}
                    </Button>
                  </div>

                  <Button
                    onClick={handlePrivateMarketCancellation}
                    disabled={isSettling || isCancelling}
                    variant="outline"
                    className="w-full bg-transparent"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Market (Refund All)"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${userBalance.toFixed(2)}</div>
              </CardContent>
            </Card>

            {tradingAllowed && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Place Bet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs value={selectedSide ? "yes" : "no"} onValueChange={(value) => setSelectedSide(value === "yes")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="yes" className="text-green-600">
                        YES
                      </TabsTrigger>
                      <TabsTrigger value="no" className="text-red-600">
                        NO
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="yes" className="space-y-4">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="text-2xl font-bold text-green-600">{yesImpliedProbability.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Current YES probability</div>
                      </div>
                    </TabsContent>
                    <TabsContent value="no" className="space-y-4">
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded">
                        <div className="text-2xl font-bold text-red-600">{noImpliedProbability.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Current NO probability</div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Bet Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min="0"
                      max={userBalance}
                      step="0.01"
                    />
                  </div>

                  {previewPricing && previewPricing.shares > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                      <div className="font-medium mb-1">Bet Preview:</div>
                      <div className="space-y-1">
                        <div>
                          You'll receive: <span className="font-medium">{previewPricing.shares.toFixed(2)} shares</span>
                        </div>
                        <div>
                          Unit price:{" "}
                          <span className="font-medium">${previewPricing.avgPrice.toFixed(3)} per share</span>
                        </div>
                        <div>
                          Fee ({(FEE_PERCENTAGE * 100).toFixed(1)}%): ${previewPricing.feeAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>
                  )}

                  <Button
                    onClick={handleTrade}
                    disabled={
                      isTrading ||
                      !betAmount ||
                      Number.parseFloat(betAmount) <= 0 ||
                      Number.parseFloat(betAmount) > userBalance
                    }
                    className="w-full"
                  >
                    {isTrading ? "Placing Bet..." : `Bet ${selectedSide ? "YES" : "NO"} - $${betAmount || "0.00"}`}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
