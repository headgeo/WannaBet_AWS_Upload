"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@supabase/ssr"
import {
  TrendingUp,
  Plus,
  Shield,
  LogOut,
  Wallet,
  BarChart,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Home,
  Search,
  Briefcase,
  User,
} from "lucide-react"
import Link from "next/link"
import { NotificationBell } from "@/components/notifications"
import { ModeToggle } from "@/components/mode-toggle"
import { MarketCard } from "@/components/market-card"
import { MobileHeader } from "@/components/mobile-header"
import { useMarkets } from "@/lib/hooks/use-markets"
import { initiateSettlement } from "@/app/actions/oracle-settlement"
import { cancelPrivateMarket } from "@/app/actions/admin"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

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
  const pathname = usePathname()

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

  const navItems = [
    { href: "/", label: "Home", icon: Home, public: true },
    { href: "/markets", label: "Browse Markets", icon: Search, public: true },
    { href: "/my-bets", label: "My Bets", icon: Briefcase },
    { href: "/profile", label: "Profile", icon: User },
  ]

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      await supabase.auth.signOut()
      window.location.href = "/auth/login"
    } catch (error) {
      console.error("Error signing out:", error)
      alert("Failed to sign out. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 pb-20 md:pb-0">
      <MobileHeader showModeToggle={true} onModeChange={setMode} userId={userId} userIsAdmin={userIsAdmin} />

      <header className="hidden md:block bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6 flex-shrink-0">
              <Link href="/" className="flex items-center space-x-2">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">WannaBet</h1>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-0"
                >
                  Beta
                </Badge>
              </Link>
              {userId && (
                <div className="hidden md:block">
                  <ModeToggle onModeChange={setMode} />
                </div>
              )}
            </div>

            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isProtected = !item.public
                const isDisabled = isProtected && !userId

                return (
                  <Button
                    key={item.href}
                    variant="ghost"
                    asChild={!isDisabled}
                    disabled={isDisabled}
                    onClick={(e) => {
                      if (isDisabled) {
                        e.preventDefault()
                        router.push("/auth/login?redirect=" + item.href)
                      }
                    }}
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isDisabled
                        ? "text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50"
                        : pathname === item.href
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
                    )}
                  >
                    {isDisabled ? (
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 lg:hidden" />
                        <span className="hidden lg:inline">{item.label}</span>
                      </span>
                    ) : (
                      <Link href={item.href} className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 lg:hidden" />
                        <span className="hidden lg:inline">{item.label}</span>
                        <Icon className="w-3.5 h-3.5 hidden" />
                      </Link>
                    )}
                  </Button>
                )
              })}
              {userId && userIsAdmin && (
                <Button
                  variant="ghost"
                  asChild
                  className={cn(
                    "text-xs font-medium",
                    pathname === "/admin"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
                  )}
                >
                  <Link href="/admin" className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                    <span className="hidden lg:inline">Admin</span>
                  </Link>
                </Button>
              )}
            </nav>

            <div className="flex items-center space-x-2">
              {!userId ? (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/auth/login">Sign In</Link>
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all text-xs"
                  >
                    <Link href="/auth/sign-up">Sign Up</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild size="sm" className="text-gray-600 dark:text-gray-400">
                    <Link href="/wallet" className="px-2">
                      <Wallet className="w-4 h-4" />
                    </Link>
                  </Button>
                  <NotificationBell />
                  <Button
                    asChild
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all text-xs"
                  >
                    <Link href="/create-market">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="md:hidden mb-8 flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">WannaBet</h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">Make Markets. Trade Odds. Earn Fees.</p>
        </div>

        <div className="hidden md:block mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Welcome back, {initialProfile?.display_name || initialProfile?.username || "User"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Make Markets. Trade Odds. Earn Fees.</p>
        </div>

        <div className={cn("grid gap-4 mb-8", userId ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2")}>
          {userId && (
            <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Your Balance
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${Number.parseFloat(initialProfile?.balance || "0").toFixed(2)}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="hidden md:block bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Active Markets
              </p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{isLoading ? "..." : activeMarkets}</p>
            </CardContent>
          </Card>

          <Card className="hidden md:block bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
              <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <BarChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Total Volume
              </p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {isLoading ? "..." : `$${(totalVolume || 0).toFixed(2)}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Markets section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
              {mode === "Trader" ? "Active Markets" : "My Markets"}
            </h3>
            {mode === "Trader" && (
              <Button
                variant="outline"
                asChild
                size="sm"
                className="text-xs border-gray-200 dark:border-gray-700 bg-transparent"
              >
                <Link href="/markets">View All</Link>
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse bg-white dark:bg-gray-900">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-4"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {mode === "Trader" && (
                <>
                  {traderMarkets && traderMarkets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {traderMarkets.map((market) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <TrendingUp className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">No Active Markets</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center mb-6 text-xs">
                          Be the first to create a prediction market!
                        </p>
                        <Button asChild size="sm" className="bg-gray-900 hover:bg-gray-800 text-xs">
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
                            className={cn(
                              "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all",
                              isSettled && "opacity-60",
                            )}
                          >
                            <CardContent className="p-4 md:p-5">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {market.title}
                                    </h3>
                                    {isSettled && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                                    {market.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge
                                      variant="secondary"
                                      className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                    >
                                      {market.category}
                                    </Badge>
                                    {!isSettled && (
                                      <Badge
                                        variant={market.status === "active" ? "default" : "secondary"}
                                        className={cn(
                                          "text-[9px]",
                                          market.status === "active" &&
                                            "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                                        )}
                                      >
                                        {market.status === "active" ? "Active" : "Pending"}
                                      </Badge>
                                    )}
                                    {isPendingSettlement && !isSettled && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                                      >
                                        Settlement Pending
                                      </Badge>
                                    )}
                                    {isExpired && !isSettled && (
                                      <Badge variant="destructive" className="text-[9px]">
                                        Expired
                                      </Badge>
                                    )}
                                    {market.is_private && (
                                      <Badge variant="outline" className="text-[9px]">
                                        Private
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm">
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                <div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                                    Total Volume
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    ${Number.parseFloat(market.total_volume.toString()).toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Fees Earned</div>
                                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                    ${Number.parseFloat(market.cumulative_creator_fees?.toString() || "0").toFixed(2)}
                                  </div>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                                    {isSettled ? "Settled On" : "Ends"}
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {isSettled
                                      ? new Date(market.settled_at).toLocaleDateString()
                                      : new Date(market.end_date).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>

                              {canSettle && (
                                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-lg">
                                  {market.settlement_status === "pending_contest" ||
                                  market.settlement_status === "contested" ? (
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4 text-blue-600" />
                                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                        Settlement in Progress
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                                        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                                          Ready for Settlement
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <Button
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700 text-xs h-8 w-full"
                                          onClick={() => handleSettleMarket(market.id, true)}
                                          disabled={isSettling === market.id || isCancelling === market.id}
                                        >
                                          {isSettling === market.id ? "..." : "Settle YES"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="text-xs h-8 w-full"
                                          onClick={() => handleSettleMarket(market.id, false)}
                                          disabled={isSettling === market.id || isCancelling === market.id}
                                        >
                                          {isSettling === market.id ? "..." : "Settle NO"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-8 w-full bg-transparent"
                                          onClick={() => handleCancelMarket(market.id)}
                                          disabled={isSettling === market.id || isCancelling === market.id}
                                        >
                                          {isCancelling === market.id ? "..." : "Cancel"}
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <BarChart className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">No Markets Created</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center mb-6 text-xs">
                          Create your first market to start earning fees!
                        </p>
                        <Button asChild size="sm" className="bg-gray-900 hover:bg-gray-800 text-xs">
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
