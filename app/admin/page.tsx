"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle, Clock, Users, DollarSign, TrendingUp, TrendingDown, Shield } from "lucide-react"
import { format } from "date-fns"
import { useIsAdmin } from "@/lib/auth/admin-client"
import { settleMarket, cancelMarket, getAllMarkets, getFeesAndLiquiditySummary } from "@/app/actions/admin"
import { createGroupsTables } from "@/app/actions/database"
import { getMarketStatusDisplay } from "@/lib/market-status"
import { NotificationBell } from "@/components/notifications"

interface Market {
  id: string
  title: string
  description: string
  category: string
  end_date: string
  total_volume: number
  status: string
  settled_at?: string
  winning_side?: boolean
  creator: {
    username: string
    display_name: string
  }
}

export default function AdminPage() {
  const [allMarkets, setAllMarkets] = useState<Market[]>([])
  const [feesSummary, setFeesSummary] = useState<{
    totalSitFees: number
    totalSettledLiquidity: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSettling, setIsSettling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isCreatingTables, setIsCreatingTables] = useState(false)

  const { isAdmin, isLoading: adminLoading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push("/")
      return
    }

    if (isAdmin) {
      loadData()
    }
  }, [isAdmin, adminLoading, router])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [allResult, feesResult] = await Promise.all([getAllMarkets(), getFeesAndLiquiditySummary()])

      if (!allResult.success) {
        throw new Error(allResult.error)
      }

      if (!feesResult.success) {
        console.error("Failed to load fees summary:", feesResult.error)
      } else {
        setFeesSummary(feesResult.data || null)
      }

      setAllMarkets(allResult.data || [])
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSettlement = async (marketId: string, winningSide: boolean) => {
    setIsSettling(marketId)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await settleMarket(marketId, winningSide)

      if (!result.success) {
        throw new Error(result.error)
      }

      setSuccessMessage(`Market settled successfully! ${winningSide ? "YES" : "NO"} was declared the winner.`)
      await loadData() // Refresh the data
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSettling(null)
    }
  }

  const handleCancellation = async (marketId: string) => {
    setIsSettling(marketId)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await cancelMarket(marketId)

      if (!result.success) {
        throw new Error(result.error)
      }

      setSuccessMessage(`Market cancelled successfully! All users have been refunded their original investment.`)
      await loadData() // Refresh the data
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSettling(null)
    }
  }

  const handleCreateGroupsTables = async () => {
    setIsCreatingTables(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await createGroupsTables()

      if (!result.success) {
        throw new Error(result.error)
      }

      setSuccessMessage("Groups tables created successfully! Users can now create and join groups.")
    } catch (error: any) {
      setError(`Failed to create groups tables: ${error.message}`)
    } finally {
      setIsCreatingTables(false)
    }
  }

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card>
          <CardContent className="text-center py-8">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You don't have admin privileges to access this page.</p>
            <Button onClick={() => router.push("/")}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const now = new Date()
  const expiredMarketsFiltered = allMarkets.filter((m) => {
    const hasExpired = new Date(m.end_date) <= now
    const notSettled = m.status !== "settled"
    return hasExpired && notSettled
  })

  const activeMarkets = allMarkets.filter((m) => {
    const isActive = m.status === "active"
    const notExpired = new Date(m.end_date) > now
    return isActive && notExpired
  })
  const settledMarkets = allMarkets.filter((m) => m.status === "settled")

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Shield className="w-8 h-8 text-blue-600" />
              <h1 className="hidden md:block text-2xl font-bold text-blue-900 dark:text-blue-100">Admin Panel</h1>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Administrator
              </Badge>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Button variant="outline" onClick={() => router.push("/")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Expired Markets</CardTitle>
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="pb-2 md:pb-6">
              <div className="text-xl md:text-2xl font-bold text-amber-600">{expiredMarketsFiltered.length}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Awaiting settlement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Active Markets</CardTitle>
              <Clock className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
            </CardHeader>
            <CardContent className="pb-2 md:pb-6">
              <div className="text-xl md:text-2xl font-bold text-green-600">{activeMarkets.length}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Currently trading</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Settled Markets</CardTitle>
              <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="pb-2 md:pb-6">
              <div className="text-xl md:text-2xl font-bold text-blue-600">{settledMarkets.length}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-purple-500" />
            </CardHeader>
            <CardContent className="pb-2 md:pb-6">
              <div className="text-xl md:text-2xl font-bold text-purple-600">
                ${allMarkets.reduce((sum, m) => sum + m.total_volume, 0).toFixed(2)}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground">All markets</p>
            </CardContent>
          </Card>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Success</span>
            </div>
            <p className="text-green-700 dark:text-green-300 mt-1">{successMessage}</p>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="expired" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 md:gap-0 bg-transparent md:bg-muted p-0 md:p-1">
            <TabsTrigger
              value="expired"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Expired</span>
              <span className="sm:hidden">Exp</span> ({expiredMarketsFiltered.length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              Active ({activeMarkets.length})
            </TabsTrigger>
            <TabsTrigger
              value="settled"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Settled</span>
              <span className="sm:hidden">Done</span> ({settledMarkets.length})
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expired" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Markets Awaiting Settlement
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These markets have expired and need to be settled. Select the winning outcome for each market.
                </p>
              </CardHeader>
              <CardContent>
                {expiredMarketsFiltered.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                    <p className="text-muted-foreground">No markets are currently awaiting settlement.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expiredMarketsFiltered.map((market) => (
                      <Card key={market.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                        <CardContent className="pt-3 md:pt-6 p-3 md:p-6">
                          <div className="flex items-start justify-between mb-2 md:mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm md:text-lg mb-1 md:mb-2">{market.title}</h3>
                              <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3 line-clamp-2">
                                {market.description}
                              </p>
                              <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3">
                                <Badge variant="secondary" className="text-[10px] md:text-xs">
                                  {market.category}
                                </Badge>
                                <Badge variant="destructive" className="flex items-center gap-1 text-[10px] md:text-xs">
                                  <Clock className="w-2 h-2 md:w-3 md:h-3" />
                                  Expired {format(new Date(market.end_date), "MMM d, yyyy")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-2 h-2 md:w-3 md:h-3" />${market.total_volume.toFixed(2)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-2 h-2 md:w-3 md:h-3" />
                                  {market.creator.display_name || market.creator.username}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 md:gap-3 pt-2 md:pt-4 border-t">
                            <span className="text-xs md:text-sm font-medium w-full md:w-auto">Select Winner:</span>
                            <Button
                              onClick={() => handleSettlement(market.id, true)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 text-xs md:text-sm h-8 md:h-9"
                            >
                              <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                              YES
                            </Button>
                            <Button
                              onClick={() => handleSettlement(market.id, false)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-xs md:text-sm h-8 md:h-9"
                            >
                              <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
                              NO
                            </Button>
                            <Button
                              onClick={() => handleCancellation(market.id)}
                              disabled={isSettling === market.id}
                              size="sm"
                              variant="outline"
                              className="border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-xs md:text-sm h-8 md:h-9"
                            >
                              <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                              Cancel
                            </Button>
                            {isSettling === market.id && (
                              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                                <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-blue-600"></div>
                                Settling...
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-500" />
                  Active Markets
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Markets currently open for trading. You can settle these early if needed.
                </p>
              </CardHeader>
              <CardContent>
                {activeMarkets.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Markets</h3>
                    <p className="text-muted-foreground">There are currently no active markets.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeMarkets.map((market) => (
                      <Card key={market.id} className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
                        <CardContent className="pt-3 md:pt-6 p-3 md:p-6">
                          <div className="flex items-start justify-between mb-2 md:mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm md:text-lg mb-1 md:mb-2">{market.title}</h3>
                              <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3 line-clamp-2">
                                {market.description}
                              </p>
                              <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3">
                                <Badge variant="secondary" className="text-[10px] md:text-xs">
                                  {market.category}
                                </Badge>
                                <Badge variant="default" className="flex items-center gap-1 text-[10px] md:text-xs">
                                  <Clock className="w-2 h-2 md:w-3 md:h-3" />
                                  Ends {format(new Date(market.end_date), "MMM d, yyyy")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-2 h-2 md:w-3 md:h-3" />${market.total_volume.toFixed(2)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-2 h-2 md:w-3 md:h-3" />
                                  {market.creator.display_name || market.creator.username}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="text-xs md:text-sm h-8 md:h-9 ml-2 bg-transparent"
                            >
                              <a href={`/market/${market.id}`} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 md:gap-3 pt-2 md:pt-4 border-t">
                            <span className="text-xs md:text-sm font-medium w-full md:w-auto">Early Settlement:</span>
                            <Button
                              onClick={() => handleSettlement(market.id, true)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 text-xs md:text-sm h-8 md:h-9"
                            >
                              <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                              YES
                            </Button>
                            <Button
                              onClick={() => handleSettlement(market.id, false)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-xs md:text-sm h-8 md:h-9"
                            >
                              <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
                              NO
                            </Button>
                            <Button
                              onClick={() => handleCancellation(market.id)}
                              disabled={isSettling === market.id}
                              size="sm"
                              variant="outline"
                              className="border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-xs md:text-sm h-8 md:h-9"
                            >
                              <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                              Cancel
                            </Button>
                            {isSettling === market.id && (
                              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                                <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-blue-600"></div>
                                Settling...
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settled" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  Settled Markets
                </CardTitle>
                <p className="text-sm text-muted-foreground">Markets that have been resolved and settled.</p>
              </CardHeader>
              <CardContent>
                {settledMarkets.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Settled Markets</h3>
                    <p className="text-muted-foreground">No markets have been settled yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settledMarkets.map((market) => {
                      const statusInfo = getMarketStatusDisplay(market)
                      return (
                        <Card key={market.id} className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
                          <CardContent className="pt-3 md:pt-6 p-3 md:p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm md:text-lg mb-1 md:mb-2">{market.title}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3 line-clamp-2">
                                  {market.description}
                                </p>
                                <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3">
                                  <Badge variant="secondary" className="text-[10px] md:text-xs">
                                    {market.category}
                                  </Badge>
                                  <Badge variant="outline" className="flex items-center gap-1 text-[10px] md:text-xs">
                                    <CheckCircle className="w-2 h-2 md:w-3 md:h-3" />
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="w-2 h-2 md:w-3 md:h-3" />${market.total_volume.toFixed(2)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="w-2 h-2 md:w-3 md:h-3" />
                                    {market.creator.display_name || market.creator.username}
                                  </div>
                                  {market.settled_at && (
                                    <div>Settled {format(new Date(market.settled_at), "MMM d, yyyy")}</div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="text-xs md:text-sm h-8 md:h-9 ml-2 bg-transparent"
                              >
                                <a href={`/market/${market.id}`} target="_blank" rel="noopener noreferrer">
                                  View
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-500" />
                  Platform Summary
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overview of platform fees earned and liquidity in settled markets.
                </p>
              </CardHeader>
              <CardContent>
                {feesSummary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          Total Platform Fees
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-green-600 mb-2">
                          ${feesSummary.totalSitFees.toFixed(2)}
                        </div>
                        <p className="text-sm text-muted-foreground">Total site fees collected from all transactions</p>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-blue-600" />
                          Settled Market Liquidity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          ${feesSummary.totalSettledLiquidity.toFixed(2)}
                        </div>
                        <p className="text-sm text-muted-foreground">Total liquidity remaining in settled markets</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading summary data...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
