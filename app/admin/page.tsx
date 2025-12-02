"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  Database,
  Play,
} from "lucide-react"
import { format } from "date-fns"
import { useIsAdmin } from "@/lib/auth/admin-client"
import {
  settleMarket,
  cancelMarket,
  getAllMarkets,
  getFeesAndLiquiditySummary,
  runBalanceReconciliation,
  runPositionsAudit,
  getPrivateMarketSettlements, // Add new import
} from "@/app/actions/admin"
import { createGroupsTables } from "@/app/actions/database"
import { getMarketStatusDisplay } from "@/lib/market-status"
import { NotificationBell } from "@/components/notifications"
import { LoadingSpinner } from "@/components/loading-spinner"

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
  settlement_status?: string // Add settlement_status for private markets
}

interface FeesSummary {
  siteFees: number
  settledLiquidity: number
  creatorRewardBalance: number
  totalPosition: number
}

export default function AdminPage() {
  const [allMarkets, setAllMarkets] = useState<Market[]>([])
  const [feesSummary, setFeesSummary] = useState<FeesSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSettling, setIsSettling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isCreatingTables, setIsCreatingTables] = useState(false)
  const [isCheckingSettlements, setIsCheckingSettlements] = useState(false)
  const [columnVerification, setColumnVerification] = useState<any>(null)
  const [diagnosticData, setDiagnosticData] = useState<any>(null)
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false)
  const [reconciliationData, setReconciliationData] = useState<any>(null)
  const [isRunningReconciliation, setIsRunningReconciliation] = useState(false)
  const [positionsAuditData, setPositionsAuditData] = useState<any>(null)
  const [isRunningPositionsAudit, setIsRunningPositionsAudit] = useState(false)
  const [privateSettlementData, setPrivateSettlementData] = useState<any>(null)
  const [isLoadingPrivateSettlements, setIsLoadingPrivateSettlements] = useState(false)

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

  const handleCheckSettlements = async () => {
    setIsCheckingSettlements(true)
    setError(null)
    setSuccessMessage(null)

    try {
      console.log("[v0] Admin: Triggering local settlement test via /api/cron/settlement...")
      const response = await fetch("/api/cron/settlement")
      const result = await response.json()

      console.log("[v0] Admin: Settlement result:", result)

      if (!result.success) {
        throw new Error(result.error || "Failed to run settlement")
      }

      const processed = result.processed?.check_pending_settlements || result.processed || {}
      const autoSettled = processed.auto_settled || 0
      const contestsResolved = processed.contests_resolved || 0
      const totalProcessed = processed.total_processed || autoSettled + contestsResolved

      setSuccessMessage(
        `✅ Settlement complete! Processed ${totalProcessed} market(s): ${autoSettled} auto-settled, ${contestsResolved} contests resolved. ${result.mode === "development" ? "(Local testing mode)" : ""}`,
      )
      await loadData() // Refresh the data
    } catch (error: any) {
      console.error("[v0] Admin: Settlement error:", error)
      setError(`Failed to run settlement: ${error.message}`)
    } finally {
      setIsCheckingSettlements(false)
    }
  }

  const loadAllBondsDebug = async () => {
    // This function is no longer directly used but kept for reference if needed in future updates
    // setIsLoadingBonds(true)
    // try {
    //   console.log("[v0] Admin: Loading all bonds from database...")
    //   const result = await getAllBondsDebug()
    //   if (result.success) {
    //     setAllBonds(result.data)
    //     console.log("[v0] Admin: Loaded bonds:", result.data)
    //   } else {
    //     console.error("[v0] Admin: Failed to load bonds:", result.error)
    //   }
    // } catch (error: any) {
    //   console.error("[v0] Admin: Error loading bonds:", error)
    // } finally {
    //   setIsLoadingBonds(false)
    // }
  }

  const loadComprehensiveDiagnostics = async () => {
    setIsLoadingDiagnostics(true)
    setError(null)

    try {
      console.log("[v0] Admin: Loading comprehensive settlement diagnostics...")
      const response = await fetch("/api/debug/settlement-status")
      const data = await response.json()

      console.log("[v0] Admin: Diagnostic data received:", data)
      setDiagnosticData(data)

      if (data.error) {
        setError(`Diagnostic error: ${data.error}`)
      }
    } catch (error: any) {
      console.error("[v0] Admin: Error loading diagnostics:", error)
      setError(`Failed to load diagnostics: ${error.message}`)
    } finally {
      setIsLoadingDiagnostics(false)
    }
  }

  const handleRunReconciliation = async () => {
    setIsRunningReconciliation(true)
    setError(null)
    setSuccessMessage(null)
    setReconciliationData(null)

    try {
      const result = await runBalanceReconciliation()

      if (!result.success) {
        throw new Error(result.error)
      }

      setReconciliationData(result.data)

      const totalIssues = result.data?.summary?.total_issues || 0
      if (totalIssues === 0) {
        setSuccessMessage("All balances reconciled successfully! No discrepancies found.")
      } else {
        setError(`Found ${totalIssues} discrepancy(ies). Review details below.`)
      }
    } catch (error: any) {
      setError(`Reconciliation failed: ${error.message}`)
    } finally {
      setIsRunningReconciliation(false)
    }
  }

  const handleRunPositionsAudit = async () => {
    setIsRunningPositionsAudit(true)
    setError(null)
    setSuccessMessage(null)
    setPositionsAuditData(null)

    try {
      const result = await runPositionsAudit()

      if (!result.success) {
        throw new Error(result.error)
      }

      setPositionsAuditData(result.data)

      const totalIssues = result.data?.summary?.total_issues || 0
      if (totalIssues === 0) {
        setSuccessMessage("All positions reconciled successfully! No discrepancies found.")
      } else {
        setError(`Found ${totalIssues} position discrepancy(ies). Review details below.`)
      }
    } catch (error: any) {
      setError(`Positions audit failed: ${error.message}`)
    } finally {
      setIsRunningPositionsAudit(false)
    }
  }

  const handlePrivateSettlementAudit = async () => {
    setIsLoadingPrivateSettlements(true)
    setError(null)

    try {
      console.log("[v0] Admin: Running private market settlement audit...")
      const result = await getPrivateMarketSettlements()

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch private market settlements")
      }

      setPrivateSettlementData(result.data)
      console.log("[v0] Admin: Private settlement audit complete:", result.data)
    } catch (error: any) {
      console.error("[v0] Admin: Private settlement audit error:", error)
      setError(`Failed to run private settlement audit: ${error.message}`)
    } finally {
      setIsLoadingPrivateSettlements(false)
    }
  }

  if (adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <LoadingSpinner message="Loading admin panel..." />
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
    const notSettledOrCancelled = m.status !== "settled" && m.status !== "cancelled"
    return hasExpired && notSettledOrCancelled
  })

  const activeMarkets = allMarkets.filter((m) => {
    const isActive = m.status === "active"
    const notExpired = new Date(m.end_date) > now
    // Also include suspended markets that are in settlement process
    const isSuspendedWithSettlement =
      m.status === "suspended" &&
      ["pending_contest", "ending_contest", "contested", "proposed"].includes(m.settlement_status)
    return (isActive && notExpired) || isSuspendedWithSettlement
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
                ${allMarkets.reduce((sum, m) => sum + Number.parseFloat(m.total_volume.toString()), 0).toFixed(2)}
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
                                  <DollarSign className="w-2 h-2 md:w-3 md:h-3" />$
                                  {Number.parseFloat(market.total_volume.toString()).toFixed(2)}
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
                                  <DollarSign className="w-2 h-2 md:w-3 md:h-3" />$
                                  {Number.parseFloat(market.total_volume.toString()).toFixed(2)}
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
                                    <DollarSign className="w-2 h-2 md:w-3 md:h-3" />$
                                    {Number.parseFloat(market.total_volume.toString()).toFixed(2)}
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
            <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  User Balance Reconciliation
                </CardTitle>
                <p className="text-sm text-muted-foreground">Audit user balances against ledger entries.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleRunReconciliation}
                  disabled={isRunningReconciliation}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isRunningReconciliation ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Running Audit...
                    </>
                  ) : (
                    "Run Balance Audit"
                  )}
                </Button>

                {reconciliationData && (
                  <div className="space-y-4 mt-4">
                    {/* Summary Card */}
                    <Card
                      className={
                        reconciliationData.summary?.status === "PASS"
                          ? "border-green-200 bg-green-50/50"
                          : "border-amber-200 bg-amber-50/50"
                      }
                    >
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          {reconciliationData.summary?.status === "PASS" ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                          Audit Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-muted-foreground">Status</div>
                            <Badge
                              variant={reconciliationData.summary?.status === "PASS" ? "default" : "destructive"}
                              className="mt-1"
                            >
                              {reconciliationData.summary?.status || "UNKNOWN"}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">User Balance Issues</div>
                            <div className="text-2xl font-bold text-amber-600">
                              {reconciliationData.summary?.user_balance_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">Total Issues</div>
                            <div className="text-2xl font-bold text-red-600">
                              {reconciliationData.summary?.total_issues || 0}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Last run:{" "}
                          {reconciliationData.summary?.timestamp
                            ? format(new Date(reconciliationData.summary.timestamp), "MMM d, yyyy 'at' HH:mm:ss")
                            : "Unknown"}
                        </p>
                      </CardContent>
                    </Card>

                    {/* User Balance Discrepancies */}
                    {reconciliationData.user_discrepancies && reconciliationData.user_discrepancies.length > 0 && (
                      <Card className="border-red-200">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            User Balance Discrepancies ({reconciliationData.user_discrepancies.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {reconciliationData.user_discrepancies.map((issue: any) => (
                              <Card key={issue.user_id} className="border-red-100 bg-red-50/30">
                                <CardContent className="pt-4 text-xs">
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div>
                                      <span className="font-medium">Username:</span> {issue.username}
                                    </div>
                                    <div>
                                      <span className="font-medium">Stored Balance:</span> $
                                      {Number(issue.stored_balance).toFixed(2)}
                                    </div>
                                    <div>
                                      <span className="font-medium">Ledger Balance:</span> $
                                      {Number(issue.ledger_balance).toFixed(2)}
                                    </div>
                                    <div>
                                      <span className="font-medium">Discrepancy:</span>{" "}
                                      <span className="text-red-600 font-semibold">
                                        ${Number(issue.discrepancy).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">{issue.user_id}</div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {reconciliationData && !reconciliationData.user_discrepancies?.length && (
                  <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="pt-4">
                      <p className="text-sm text-green-700">
                        All user balances reconciled successfully! No discrepancies found.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {!reconciliationData && !isRunningReconciliation && (
                  <p className="text-sm text-muted-foreground">
                    Click the button above to audit user balances against the ledger.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Positions & Market State Audit
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Audit user positions and market qy/qn/liquidity against transaction tracking and ledger entries.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleRunPositionsAudit}
                  disabled={isRunningPositionsAudit}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isRunningPositionsAudit ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Running Positions Audit...
                    </>
                  ) : (
                    "Run Positions Audit"
                  )}
                </Button>

                {positionsAuditData && (
                  <div className="space-y-4 mt-4">
                    {/* Summary Card */}
                    <Card
                      className={
                        positionsAuditData.summary?.status === "PASS"
                          ? "border-green-200 bg-green-50/50"
                          : "border-amber-200 bg-amber-50/50"
                      }
                    >
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          {positionsAuditData.summary?.status === "PASS" ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                          Positions Audit Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-muted-foreground">Status</div>
                            <Badge
                              variant={positionsAuditData.summary?.status === "PASS" ? "default" : "destructive"}
                              className="mt-1"
                            >
                              {positionsAuditData.summary?.status || "UNKNOWN"}
                            </Badge>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">User Position Issues</div>
                            <div className="text-2xl font-bold text-amber-600">
                              {positionsAuditData.summary?.position_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">Market State Issues</div>
                            <div className="text-2xl font-bold text-amber-600">
                              {positionsAuditData.summary?.market_share_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">Total Issues</div>
                            <div className="text-2xl font-bold text-red-600">
                              {positionsAuditData.summary?.total_issues || 0}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Last run:{" "}
                          {positionsAuditData.summary?.timestamp
                            ? format(new Date(positionsAuditData.summary.timestamp), "MMM d, yyyy 'at' HH:mm:ss")
                            : "Unknown"}
                        </p>
                      </CardContent>
                    </Card>

                    {/* User Position Discrepancies */}
                    {positionsAuditData.position_discrepancies &&
                      positionsAuditData.position_discrepancies.length > 0 && (
                        <Card className="border-red-200">
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              User Position Discrepancies ({positionsAuditData.position_discrepancies.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {positionsAuditData.position_discrepancies.map((issue: any, idx: number) => (
                                <Card key={idx} className="border-red-100 bg-red-50/30">
                                  <CardContent className="pt-4 text-xs">
                                    <h4 className="font-semibold text-sm mb-2">
                                      {issue.username} - {issue.market_title}
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                      <div>
                                        <span className="font-medium">Side:</span> {issue.side}
                                      </div>
                                      <div>
                                        <span className="font-medium">Positions Table:</span>{" "}
                                        {Number(issue.position_table_shares).toFixed(4)}
                                      </div>
                                      <div>
                                        <span className="font-medium">Transaction Snapshot:</span>{" "}
                                        {Number(issue.transaction_snapshot_shares).toFixed(4)}
                                      </div>
                                      <div>
                                        <span className="font-medium">Calculated:</span>{" "}
                                        {Number(issue.calculated_shares).toFixed(4)}
                                      </div>
                                      <div>
                                        <span className="font-medium">Discrepancy:</span>{" "}
                                        <span className="text-red-600 font-semibold">
                                          {Number(issue.discrepancy_vs_snapshot).toFixed(4)}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {/* Market Share Discrepancies */}
                    {positionsAuditData.market_share_discrepancies &&
                      positionsAuditData.market_share_discrepancies.length > 0 && (
                        <Card className="border-red-200">
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              Market State Discrepancies ({positionsAuditData.market_share_discrepancies.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {positionsAuditData.market_share_discrepancies.map((issue: any, idx: number) => (
                                <Card key={idx} className="border-red-100 bg-red-50/30">
                                  <CardContent className="pt-4 text-xs">
                                    <h4 className="font-semibold text-sm mb-2">{issue.market_title}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <div>
                                        <div className="font-medium mb-1">YES Shares (qy):</div>
                                        <div className="pl-2 space-y-1">
                                          <div>Markets Table: {Number(issue.qy?.stored || 0).toFixed(4)}</div>
                                          <div>
                                            Transaction Snapshot:{" "}
                                            {Number(issue.qy?.transaction_snapshot || 0).toFixed(4)}
                                          </div>
                                          <div>Calculated: {Number(issue.qy?.calculated || 0).toFixed(4)}</div>
                                          <div className="text-red-600 font-semibold">
                                            Diff: {Number(issue.qy?.discrepancy || 0).toFixed(4)}
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <div className="font-medium mb-1">NO Shares (qn):</div>
                                        <div className="pl-2 space-y-1">
                                          <div>Markets Table: {Number(issue.qn?.stored || 0).toFixed(4)}</div>
                                          <div>
                                            Transaction Snapshot:{" "}
                                            {Number(issue.qn?.transaction_snapshot || 0).toFixed(4)}
                                          </div>
                                          <div>Calculated: {Number(issue.qn?.calculated || 0).toFixed(4)}</div>
                                          <div className="text-red-600 font-semibold">
                                            Diff: {Number(issue.qn?.discrepancy || 0).toFixed(4)}
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <div className="font-medium mb-1">Liquidity Pool:</div>
                                        <div className="pl-2 space-y-1">
                                          <div>
                                            Markets Table: ${Number(issue.liquidity_pool?.stored || 0).toFixed(4)}
                                          </div>
                                          <div>
                                            Transaction Snapshot: $
                                            {Number(issue.liquidity_pool?.transaction_snapshot || 0).toFixed(4)}
                                          </div>
                                          <div>
                                            Ledger Snapshot: $
                                            {Number(issue.liquidity_pool?.ledger_snapshot || 0).toFixed(4)}
                                          </div>
                                          <div>
                                            Calculated: ${Number(issue.liquidity_pool?.calculated || 0).toFixed(4)}
                                          </div>
                                          <div className="text-red-600 font-semibold">
                                            Diff vs Txn: $
                                            {Number(issue.liquidity_pool?.discrepancy_vs_txn || 0).toFixed(4)}
                                          </div>
                                          <div className="text-red-600 font-semibold">
                                            Diff vs Ledger: $
                                            {Number(issue.liquidity_pool?.discrepancy_vs_ledger || 0).toFixed(4)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {positionsAuditData &&
                      !positionsAuditData.position_discrepancies?.length &&
                      !positionsAuditData.market_share_discrepancies?.length && (
                        <Card className="border-green-200 bg-green-50/50">
                          <CardContent className="pt-4">
                            <p className="text-sm text-green-700">
                              All positions and market states reconciled successfully! No discrepancies found.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                )}

                {!positionsAuditData && !isRunningPositionsAudit && (
                  <p className="text-sm text-muted-foreground">
                    Click the button above to audit user positions and market state against transaction tracking and
                    ledger entries.
                  </p>
                )}
              </CardContent>
            </Card>
            {/* End of Positions Audit Card */}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Private Market Settlement Audit
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Check private markets with proposed or contested settlements and their deadlines.
                </p>
              </CardHeader>
              <CardContent>
                <Button onClick={handlePrivateSettlementAudit} disabled={isLoadingPrivateSettlements} variant="outline">
                  {isLoadingPrivateSettlements ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    "Run Settlement Audit"
                  )}
                </Button>

                {privateSettlementData && (
                  <div className="mt-4 space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <div className="text-2xl font-bold">{privateSettlementData.summary.total}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {privateSettlementData.summary.proposed}
                        </div>
                        <div className="text-xs text-muted-foreground">Proposed</div>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {privateSettlementData.summary.contested}
                        </div>
                        <div className="text-xs text-muted-foreground">Contested</div>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {privateSettlementData.summary.past_deadline}
                        </div>
                        <div className="text-xs text-muted-foreground">Past Deadline</div>
                      </div>
                    </div>

                    {/* Markets List */}
                    {privateSettlementData.markets.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Markets with Settlement Status:</h4>
                        {privateSettlementData.markets.map((market: any) => (
                          <div
                            key={market.id}
                            className={`p-4 border rounded-lg ${
                              market.is_past_deadline ? "border-red-300 bg-red-50 dark:bg-red-900/20" : "border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{market.title}</span>
                                  <Badge
                                    variant={market.settlement_status === "proposed" ? "secondary" : "destructive"}
                                  >
                                    {market.settlement_status}
                                  </Badge>
                                  {market.is_past_deadline && <Badge variant="destructive">EXPIRED</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  Creator: {market.creator.display_name || market.creator.username}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Proposed outcome:{" "}
                                  {market.creator_settlement_outcome === true
                                    ? "YES"
                                    : market.creator_settlement_outcome === false
                                      ? "NO"
                                      : "Not set"}
                                  {market.creator_settlement_outcome_text &&
                                    ` (${market.creator_settlement_outcome_text})`}
                                </div>
                              </div>
                              <div className="text-right">
                                <div
                                  className={`text-sm font-medium ${
                                    market.is_past_deadline ? "text-red-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {market.time_remaining_formatted}
                                </div>
                                {market.contest_deadline && (
                                  <div className="text-xs text-muted-foreground">
                                    Deadline: {format(new Date(market.contest_deadline), "MMM d, yyyy HH:mm")}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">ID: {market.id}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p>No private markets with pending settlements</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-500" />
                  Local Settlement Testing
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Test the auto-settlement system locally. This works on localhost without needing CRON_SECRET.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Local Testing Mode</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        You're running on localhost, so the Vercel cron job won't trigger automatically. Use this button
                        to manually test the settlement process.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> When deployed to Vercel, settlements will run automatically every 5
                        minutes via cron job. You'll need to add CRON_SECRET to your Vercel environment variables.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold mb-1">Run Settlement Check</h3>
                    <p className="text-sm text-muted-foreground">
                      Check for expired markets and resolve contests. This simulates what the cron job does in
                      production.
                    </p>
                  </div>
                  <Button onClick={handleCheckSettlements} disabled={isCheckingSettlements} className="ml-4">
                    {isCheckingSettlements ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      "Test Settlement Now"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-500" />
                  Platform Summary
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overview of platform fees, settled liquidity, and creator rewards.
                </p>
              </CardHeader>
              <CardContent>
                {feesSummary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          Site Fees
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600 mb-1">${feesSummary.siteFees.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">From platform_ledger</p>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                          Settled Liquidity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          ${feesSummary.settledLiquidity.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">Leftover from settlements</p>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="w-4 h-4 text-amber-600" />
                          Creator Rewards Owing
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div
                          className={`text-2xl font-bold mb-1 ${feesSummary.creatorRewardBalance >= 0 ? "text-amber-600" : "text-red-600"}`}
                        >
                          ${feesSummary.creatorRewardBalance.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">$10 per market created</p>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-600" />
                          Total Position
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div
                          className={`text-2xl font-bold mb-1 ${feesSummary.totalPosition >= 0 ? "text-purple-600" : "text-red-600"}`}
                        >
                          ${feesSummary.totalPosition.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">Platform ledger balance</p>
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
