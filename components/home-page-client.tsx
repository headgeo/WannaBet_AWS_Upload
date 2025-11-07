"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Plus, Shield, LogOut, Wallet, BarChart, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from "next/link"
import { NotificationBell } from "@/components/notifications"
import { ModeToggle } from "@/components/mode-toggle"
import { MarketCard } from "@/components/market-card"
import { MobileHeader } from "@/components/mobile-header"
import { useMarkets } from "@/lib/hooks/use-markets"
import { initiateSettlement } from "@/app/actions/oracle-settlement"
import { cancelPrivateMarket } from "@/app/actions/admin"
import { useRouter } from 'next/navigation'

interface HomePageProps {
  userId: string
  userIsAdmin: boolean
  initialProfile: any
}

export default function HomePage({ userId, userIsAdmin, initialProfile }: HomePageProps) {
  const [mode, setMode] = useState<"Trader" | "Earner">("Trader")
  const [isSettling, setIsSettling] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const { markets, totalVolume, activeMarkets, isLoading, createdMarkets, privateMarkets, mutate } = useMarkets()
  const router = useRouter()

  useEffect(() => {
    console.log("[v0] HomePage useEffect - Data updated:")
    console.log("[v0] - isLoading:", isLoading)
    console.log("[v0] - markets:", markets?.length || 0)
    console.log("[v0] - privateMarkets:", privateMarkets?.length || 0)
    console.log("[v0] - createdMarkets:", createdMarkets?.length || 0)
    console.log("[v0] - userId:", userId)
    if (createdMarkets && createdMarkets.length > 0) {
      console.log("[v0] - First created market:", createdMarkets[0])
    } else {
      console.log("[v0] - No created markets found")
    }
  }, [isLoading, markets, privateMarkets, createdMarkets, userId])

  const sortedCreatedMarkets = createdMarkets
    ? [...createdMarkets].sort((a, b) => {
        // Settled markets (outcome is not null) go to the bottom
        if (a.outcome !== null && b.outcome === null) return 1
        if (a.outcome === null && b.outcome !== null) return -1
        // Within each group, sort by created date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    : []

  const traderMarkets =
    mode === "Trader"
      ? Array.from(
          new Map([...(markets || []), ...(privateMarkets || [])].map((market) => [market.id, market])).values(),
        )
      : []
  const earnerMarkets = mode === "Earner" ? sortedCreatedMarkets : []

  console.log(
    "[v0] HomePage render - Mode:",
    mode,
    "Trader markets:",
    traderMarkets.length,
    "Earner markets:",
    earnerMarkets.length,
  )

  const handleSettleMarket = async (marketId: string, winningSide: boolean) => {
    setIsSettling(marketId)
    try {
      const result = await initiateSettlement(marketId, winningSide)
      if (!result.success) {
        throw new Error(result.error || "Settlement initiation failed")
      }
      await mutate()
      router.refresh()
    } catch (error: any) {
      console.error("[v0] Settlement initiation error:", error)
      alert(`Failed to initiate settlement: ${error.message}`)
    } finally {
      setIsSettling(null)
    }
  }

  const handleCancelMarket = async (marketId: string) => {
    setIsCancelling(marketId)
    try {
      const result = await cancelPrivateMarket(marketId)
      if (!result.success) {
        throw new Error(result.error || "Cancellation failed")
      }
      router.refresh()
    } catch (error: any) {
      console.error("[v0] Cancellation error:", error)
    } finally {
      setIsCancelling(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 pb-20 md:pb-0">
      <MobileHeader showModeToggle={true} onModeChange={setMode} />

      {/* Header */}
      <header className="hidden md:block bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
              <div className="hidden md:block">
                <ModeToggle onModeChange={setMode} />
              </div>
              <h1 className="hidden md:block text-lg md:text-2xl font-bold text-blue-900 dark:text-blue-100">
                WannaBet
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
                Beta
              </Badge>
            </div>

            <nav className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/markets">Browse Markets</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/profile">Profile</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/my-bets">My Bets</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/wallet">Wallet</Link>
              </Button>
              {userIsAdmin && (
                <Button variant="ghost" asChild className="text-blue-600 hover:text-blue-700">
                  <Link href="/admin" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button variant="ghost" asChild size="sm">
                <Link href="/wallet" className="px-2">
                  <Wallet className="w-4 h-4" />
                </Link>
              </Button>
              <NotificationBell />
              <Button asChild>
                <Link href="/create-market">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Market
                </Link>
              </Button>
              <form action="/auth/logout" method="post">
                <Button variant="outline" type="submit" className="flex items-center gap-2 bg-transparent">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </form>
            </nav>

            <nav className="hidden items-center gap-2">
              {userIsAdmin && (
                <Button variant="ghost" asChild size="sm">
                  <Link href="/admin" className="px-2">
                    <Shield className="w-4 h-4" />
                  </Link>
                </Button>
              )}
              <Button variant="ghost" asChild size="sm">
                <Link href="/wallet" className="px-2">
                  <Wallet className="w-4 h-4" />
                </Link>
              </Button>
              <NotificationBell />
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="md:hidden mb-8 flex flex-col items-center justify-center">
          <h1
            className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-800 via-indigo-800 to-purple-800 bg-clip-text text-transparent opacity-90 animate-in fade-in duration-1000 drop-shadow-2xl"
            style={{
              filter:
                "drop-shadow(0 10px 25px rgba(59, 130, 246, 0.3)) drop-shadow(0 5px 15px rgba(139, 92, 246, 0.2))",
            }}
          >
            WannaBet
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            Make Markets. Trade Odds. Earn Fees.
          </p>
        </div>

        <div className="hidden md:block mb-6 md:mb-8">
          <h2 className="text-sm md:text-3xl font-medium md:font-bold text-gray-400 md:text-gray-900 dark:text-gray-500 dark:md:text-white mb-2">
            Welcome back, {initialProfile?.display_name || initialProfile?.username || "User"}!
          </h2>
          <p className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
            Make Markets. Trade Odds. Earn Fees.
          </p>
        </div>

        {/* Reduced stats card padding and sizes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4 flex flex-col items-center justify-center space-y-1 md:space-y-1.5">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Wallet className="w-3 h-3 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Your Balance</p>
              <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">
                ${Number.parseFloat(initialProfile?.balance || "0").toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className="hidden md:block overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-1.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Markets</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{isLoading ? "..." : activeMarkets}</p>
            </CardContent>
          </Card>

          <Card className="hidden md:block overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-1.5">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <BarChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Volume</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {isLoading ? "..." : `$${(totalVolume || 0).toFixed(2)}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reduced grid gap for tighter layout */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              {mode === "Trader" ? "Active Markets" : "My Markets"}
            </h3>
            {mode === "Trader" && (
              <Button variant="outline" asChild size="sm" className="text-xs md:text-sm bg-transparent">
                <Link href="/markets">View All</Link>
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {mode === "Trader" && (
                <>
                  {traderMarkets && traderMarkets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                      {traderMarkets.map((market) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Active Markets</h3>
                        <p className="text-muted-foreground text-center mb-4">
                          Be the first to create a prediction market!
                        </p>
                        <Button asChild>
                          <Link href="/create-market">Create Market</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {mode === "Earner" && (
                <>
                  {earnerMarkets && earnerMarkets.length > 0 ? (
                    <div className="space-y-4">
                      {earnerMarkets.map((market) => {
                        const isExpired = new Date(market.end_date) < new Date()
                        const isSettled =
                          market.outcome !== null ||
                          market.status === "settled" ||
                          market.status === "cancelled" ||
                          market.status === "resolved"
                        const canSettle = market.is_private && !isSettled && market.status === "active"
                        const isPendingSettlement =
                          market.settlement_status === "pending_contest" || market.status === "suspended"

                        return (
                          <Card
                            key={market.id}
                            className={`hover:shadow-lg transition-shadow ${
                              isSettled ? "opacity-75 bg-gray-50 dark:bg-gray-900/50" : ""
                            }`}
                          >
                            <CardContent className="p-3 md:p-6">
                              <div className="flex items-start justify-between mb-2 md:mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1 md:mb-2">
                                    <h3 className="font-semibold text-sm md:text-lg">{market.title}</h3>
                                    {isSettled && (
                                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="text-xs font-medium">Settled</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3">
                                    {market.description}
                                  </p>
                                  <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                                    >
                                      {market.category}
                                    </Badge>
                                    {isSettled ? (
                                      <Badge
                                        variant="default"
                                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5 bg-green-600"
                                      >
                                        Settled - {market.outcome ? "YES" : "NO"} Won
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant={market.status === "active" ? "default" : "secondary"}
                                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                                      >
                                        {market.status === "active" ? "Active" : "Pending"}
                                      </Badge>
                                    )}
                                    {isPendingSettlement && !isSettled && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                                      >
                                        Settlement Pending
                                      </Badge>
                                    )}
                                    {isExpired && !isSettled && (
                                      <Badge
                                        variant="destructive"
                                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                                      >
                                        Expired
                                      </Badge>
                                    )}
                                    {market.is_private && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs md:text-sm px-1 md:px-2 py-0 md:py-0.5"
                                      >
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
                                    ${Number.parseFloat(market.cumulative_creator_fees?.toString() || "0").toFixed(2)}
                                  </div>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                  <div className="text-xs md:text-sm text-muted-foreground">
                                    {isSettled ? "Settled On" : "Ends"}
                                  </div>
                                  <div className="font-semibold text-xs md:text-base">
                                    {isSettled
                                      ? new Date(market.settled_at).toLocaleDateString()
                                      : new Date(market.end_date).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>

                              {canSettle && (
                                <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                  {market.settlement_status === "pending_contest" ||
                                  market.settlement_status === "contested" ? (
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-5 h-5 text-blue-600" />
                                      <span className="font-medium text-blue-800 dark:text-blue-200">
                                        Settlement in Progress
                                      </span>
                                    </div>
                                  ) : (
                                    <>
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
                                    </>
                                  )}
                                </div>
                              )}

                              <div className="mt-2 md:mt-4">
                                <Button
                                  variant="outline"
                                  asChild
                                  size="sm"
                                  className="text-xs md:text-sm bg-transparent"
                                >
                                  <Link href={`/market/${market.id}`}>View Market</Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Markets Created</h3>
                        <p className="text-muted-foreground text-center mb-4">
                          Create markets to earn 50% of trading fees!
                        </p>
                        <Button asChild>
                          <Link href="/create-market">Create Market</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
