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
  Play,
  BarChart3,
  Scale,
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
  getPrivateMarketSettlements,
  runLedgerBalanceAudit, // <-- Added import for new ledger audit
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
  outcome_text?: string // Added outcome_text to Market interface
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
  const [ledgerAuditData, setLedgerAuditData] = useState<any>(null) // <-- Added state for ledger balance audit
  const [isRunningLedgerAudit, setIsRunningLedgerAudit] = useState(false) // <-- Added state for ledger balance audit

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

      // API returns { checked, settled } but we also support { processed }
      const settled = result.settled?.force_settle_pending_settlements || result.settled || []
      const settledResults = Array.isArray(settled) ? settled : settled.results || []
      const autoSettled = settledResults.filter((r: any) => r.type === "uncontested" && r.success).length
      const contestsResolved = settledResults.filter((r: any) => r.type === "contested" && r.success).length
      const totalProcessed = settledResults.filter((r: any) => r.success).length

      setSuccessMessage(
        `Settlement complete! Processed ${totalProcessed} market(s): ${autoSettled} auto-settled, ${contestsResolved} contests resolved. ${result.mode === "development" ? "(Local testing mode)" : ""}`,
      )
      await loadData() // Refresh the data
    } catch (error: any) {
      console.error("[v0] Admin: Settlement error:", error)
      setError(`Failed to run settlement: ${error.message}`)
    } finally {
      setIsCheckingSettlements(false)
    }
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

  // <-- Added handler for ledger balance audit
  const handleRunLedgerAudit = async () => {
    setIsRunningLedgerAudit(true)
    setError(null)
    setSuccessMessage(null)
    setLedgerAuditData(null)

    try {
      const result = await runLedgerBalanceAudit()

      if (!result.success) {
        throw new Error(result.error)
      }

      setLedgerAuditData(result.data)

      if (result.data?.is_balanced) {
        setSuccessMessage("Ledger is balanced! Total credits equal total debits.")
      } else {
        setError(`Ledger imbalance detected: $${Math.abs(result.data?.difference || 0).toFixed(2)} discrepancy.`)
      }
    } catch (error: any) {
      setError(`Ledger audit failed: ${error.message}`)
    } finally {
      setIsRunningLedgerAudit(false)
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
      <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <LoadingSpinner message="Loading admin panel..." />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="shadow-md">
          <CardContent className="text-center py-6">
            <Shield className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-xs text-muted-foreground mb-4">You don't have admin privileges to access this page.</p>
            <Button onClick={() => router.push("/")} className="bg-gray-900 hover:bg-gray-800 text-white text-xs h-8">
              Back to Dashboard
            </Button>
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
    <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-900 border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-gray-900" />
              <h1 className="hidden md:block text-lg font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>
              <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-[10px]">
                Administrator
              </Badge>
            </div>

            <div className="flex items-center space-x-3">
              <NotificationBell />
              <Button variant="outline" onClick={() => router.push("/")} className="text-xs h-8">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">Expired</CardTitle>
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold text-amber-600">{expiredMarketsFiltered.length}</div>
              <p className="text-[9px] text-muted-foreground">Awaiting settlement</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</CardTitle>
              <Clock className="h-3 w-3 text-green-500" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold text-green-600">{activeMarkets.length}</div>
              <p className="text-[9px] text-muted-foreground">Currently trading</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">Settled</CardTitle>
              <CheckCircle className="h-3 w-3 text-blue-500" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold text-gray-900">{settledMarkets.length}</div>
              <p className="text-[9px] text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">Volume</CardTitle>
              <DollarSign className="h-3 w-3 text-purple-500" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold text-purple-600">
                ${allMarkets.reduce((sum, m) => sum + Number.parseFloat(m.total_volume.toString()), 0).toFixed(2)}
              </div>
              <p className="text-[9px] text-muted-foreground">All markets</p>
            </CardContent>
          </Card>
        </div>

        {feesSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">Site Fees</CardTitle>
                <DollarSign className="h-3 w-3 text-blue-500" />
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-xl font-bold text-blue-600">${feesSummary.siteFees.toFixed(2)}</div>
                <p className="text-[9px] text-muted-foreground">Collected fees</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Liquidity Sweep
                </CardTitle>
                <TrendingUp className="h-3 w-3 text-green-500" />
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-xl font-bold text-green-600">${feesSummary.settledLiquidity.toFixed(2)}</div>
                <p className="text-[9px] text-muted-foreground">Swept liquidity</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Creator Rewards
                </CardTitle>
                <Users className="h-3 w-3 text-amber-500" />
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-xl font-bold text-amber-600">${feesSummary.creatorRewardBalance.toFixed(2)}</div>
                <p className="text-[9px] text-muted-foreground">Owing for UMA</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total Position
                </CardTitle>
                <TrendingUp className="h-3 w-3 text-purple-500" />
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-xl font-bold text-purple-600">${feesSummary.totalPosition.toFixed(2)}</div>
                <p className="text-[9px] text-muted-foreground">Platform total</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Error</span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Success</span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">{successMessage}</p>
          </div>
        )}

        <Tabs defaultValue="expired" className="space-y-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            <TabsList className="contents">
              <TabsTrigger
                value="expired"
                className="flex items-center justify-center gap-1 text-[10px] py-2 px-3 rounded-md border bg-white shadow-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:border-gray-900"
              >
                <AlertTriangle className="w-3 h-3" />
                Expired ({expiredMarketsFiltered.length})
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="flex items-center justify-center gap-1 text-[10px] py-2 px-3 rounded-md border bg-white shadow-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:border-gray-900"
              >
                <Clock className="w-3 h-3" />
                Active ({activeMarkets.length})
              </TabsTrigger>
              <TabsTrigger
                value="settled"
                className="flex items-center justify-center gap-1 text-[10px] py-2 px-3 rounded-md border bg-white shadow-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:border-gray-900"
              >
                <CheckCircle className="w-3 h-3" />
                Settled ({settledMarkets.length})
              </TabsTrigger>
              <TabsTrigger
                value="summary"
                className="flex items-center justify-center gap-1 text-[10px] py-2 px-3 rounded-md border bg-white shadow-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:border-gray-900"
              >
                <DollarSign className="w-3 h-3" />
                Summary
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="expired" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Markets Awaiting Settlement
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">These markets have expired and need to be settled.</p>
              </CardHeader>
              <CardContent>
                {expiredMarketsFiltered.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold mb-1">All Caught Up!</h3>
                    <p className="text-xs text-muted-foreground">No markets are currently awaiting settlement.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiredMarketsFiltered.map((market) => (
                      <Card key={market.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 shadow-sm">
                        <CardContent className="pt-3 p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-xs mb-1">{market.title}</h3>
                              <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">
                                {market.description}
                              </p>
                              <div className="flex items-center gap-1 mb-2">
                                <Badge variant="secondary" className="text-[9px]">
                                  {market.category}
                                </Badge>
                                <Badge variant="destructive" className="flex items-center gap-1 text-[9px]">
                                  <Clock className="w-2 h-2" />
                                  Expired {format(new Date(market.end_date), "MMM d, yyyy")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-2 h-2" />$
                                  {Number.parseFloat(market.total_volume.toString()).toFixed(2)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-2 h-2" />
                                  {market.creator.display_name || market.creator.username}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                            <span className="text-[10px] font-medium w-full md:w-auto">Select Winner:</span>
                            <Button
                              onClick={() => handleSettlement(market.id, true)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 text-[10px] h-7"
                            >
                              <TrendingUp className="w-3 h-3" />
                              YES
                            </Button>
                            <Button
                              onClick={() => handleSettlement(market.id, false)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-[10px] h-7"
                            >
                              <TrendingDown className="w-3 h-3" />
                              NO
                            </Button>
                            <Button
                              onClick={() => handleCancellation(market.id)}
                              disabled={isSettling === market.id}
                              size="sm"
                              variant="outline"
                              className="border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-[10px] h-7"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Cancel
                            </Button>
                            {isSettling === market.id && (
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
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

          <TabsContent value="active" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-green-500" />
                  Active Markets
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Markets currently open for trading.</p>
              </CardHeader>
              <CardContent>
                {activeMarkets.length === 0 ? (
                  <div className="text-center py-6">
                    <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold mb-1">No Active Markets</h3>
                    <p className="text-xs text-muted-foreground">There are currently no active markets.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeMarkets.map((market) => (
                      <Card key={market.id} className="border-green-200 bg-green-50/50 dark:bg-green-900/10 shadow-sm">
                        <CardContent className="pt-3 p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-xs mb-1">{market.title}</h3>
                              <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">
                                {market.description}
                              </p>
                              <div className="flex items-center gap-1 mb-2">
                                <Badge variant="secondary" className="text-[9px]">
                                  {market.category}
                                </Badge>
                                <Badge variant="default" className="flex items-center gap-1 text-[9px]">
                                  <Clock className="w-2 h-2" />
                                  Ends {format(new Date(market.end_date), "MMM d, yyyy")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-2 h-2" />$
                                  {Number.parseFloat(market.total_volume.toString()).toFixed(2)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-2 h-2" />
                                  {market.creator.display_name || market.creator.username}
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild className="text-[10px] h-7 ml-2 bg-transparent">
                              <a href={`/market/${market.id}`} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                            <span className="text-[10px] font-medium w-full md:w-auto">Early Settlement:</span>
                            <Button
                              onClick={() => handleSettlement(market.id, true)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 text-[10px] h-7"
                            >
                              <TrendingUp className="w-3 h-3" />
                              YES
                            </Button>
                            <Button
                              onClick={() => handleSettlement(market.id, false)}
                              disabled={isSettling === market.id}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-[10px] h-7"
                            >
                              <TrendingDown className="w-3 h-3" />
                              NO
                            </Button>
                            <Button
                              onClick={() => handleCancellation(market.id)}
                              disabled={isSettling === market.id}
                              size="sm"
                              variant="outline"
                              className="border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-[10px] h-7"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Cancel
                            </Button>
                            {isSettling === market.id && (
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
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

          <TabsContent value="settled" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-gray-900" />
                  Settled Markets
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Markets that have been resolved and settled.</p>
              </CardHeader>
              <CardContent>
                {settledMarkets.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold mb-1">No Settled Markets</h3>
                    <p className="text-xs text-muted-foreground">No markets have been settled yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settledMarkets.map((market) => {
                      const statusInfo = getMarketStatusDisplay(market)
                      return (
                        <Card key={market.id} className="border-gray-200 bg-gray-50/50 dark:bg-gray-900/10 shadow-sm">
                          <CardContent className="pt-3 p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-xs mb-1">{market.title}</h3>
                                <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">
                                  {market.description}
                                </p>
                                <div className="flex items-center gap-1 mb-2">
                                  <Badge variant="secondary" className="text-[9px]">
                                    {market.category}
                                  </Badge>
                                  <Badge variant="outline" className="flex items-center gap-1 text-[9px]">
                                    <CheckCircle className="w-2 h-2" />
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="w-2 h-2" />$
                                    {Number.parseFloat(market.total_volume.toString()).toFixed(2)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="w-2 h-2" />
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
                                className="text-[10px] h-7 ml-2 bg-transparent"
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

          <TabsContent value="summary" className="space-y-4">
            {/* Ledger Balance Audit */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Scale className="w-4 h-4 text-purple-600" />
                  Ledger Balance Audit
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Verify total credits equal total debits in ledger_entries.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleRunLedgerAudit}
                  disabled={isRunningLedgerAudit}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
                >
                  {isRunningLedgerAudit ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Running Audit...
                    </>
                  ) : (
                    "Run Ledger Audit"
                  )}
                </Button>

                {ledgerAuditData && (
                  <div className="space-y-3 mt-3">
                    <Card
                      className={
                        ledgerAuditData.status === "PASS"
                          ? "border-green-200 bg-green-50/50 shadow-sm"
                          : "border-red-200 bg-red-50/50 shadow-sm"
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs flex items-center gap-2">
                          {ledgerAuditData.status === "PASS" ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                          )}
                          Ledger Audit Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <div className="text-[10px] text-muted-foreground">Status</div>
                            <Badge
                              variant={ledgerAuditData.status === "PASS" ? "default" : "destructive"}
                              className="mt-1 text-[9px]"
                            >
                              {ledgerAuditData.status}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Total Credits</div>
                            <div className="text-lg font-bold text-green-600">
                              ${Number(ledgerAuditData.total_credits).toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Total Debits</div>
                            <div className="text-lg font-bold text-blue-600">
                              ${Number(ledgerAuditData.total_debits).toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Difference</div>
                            <div
                              className={`text-lg font-bold ${ledgerAuditData.is_balanced ? "text-green-600" : "text-red-600"}`}
                            >
                              ${Math.abs(Number(ledgerAuditData.difference)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[9px] text-muted-foreground">
                            Total Entries: {ledgerAuditData.total_entries?.toLocaleString() || 0}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            Last run:{" "}
                            {ledgerAuditData.timestamp
                              ? format(new Date(ledgerAuditData.timestamp), "MMM d, yyyy 'at' HH:mm:ss")
                              : "Unknown"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {!ledgerAuditData.is_balanced && (
                      <Card className="border-red-200 bg-red-50/30 shadow-sm">
                        <CardContent className="pt-3">
                          <p className="text-xs text-red-700">
                            <strong>Warning:</strong> The ledger is not balanced. Total credits and debits should be
                            equal. A discrepancy of ${Math.abs(Number(ledgerAuditData.difference)).toFixed(2)} was
                            detected.
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {ledgerAuditData.is_balanced && (
                      <Card className="border-green-200 bg-green-50/50 shadow-sm">
                        <CardContent className="pt-3">
                          <p className="text-xs text-green-700">
                            Ledger is balanced! Total credits equal total debits (double-entry accounting verified).
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {!ledgerAuditData && !isRunningLedgerAudit && (
                  <p className="text-[10px] text-muted-foreground">
                    Click the button above to verify ledger balance (credits = debits).
                  </p>
                )}
              </CardContent>
            </Card>

            {/* User Balance Reconciliation */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-blue-600" />
                  User Balance Reconciliation
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Audit user balances against ledger entries.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleRunReconciliation}
                  disabled={isRunningReconciliation}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                >
                  {isRunningReconciliation ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Running Audit...
                    </>
                  ) : (
                    "Run Balance Audit"
                  )}
                </Button>

                {reconciliationData && (
                  <div className="space-y-3 mt-3">
                    <Card
                      className={
                        reconciliationData.summary?.status === "PASS"
                          ? "border-green-200 bg-green-50/50 shadow-sm"
                          : "border-amber-200 bg-amber-50/50 shadow-sm"
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs flex items-center gap-2">
                          {reconciliationData.summary?.status === "PASS" ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          )}
                          Audit Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <div className="text-[10px] text-muted-foreground">Status</div>
                            <Badge
                              variant={reconciliationData.summary?.status === "PASS" ? "default" : "destructive"}
                              className="mt-1 text-[9px]"
                            >
                              {reconciliationData.summary?.status || "UNKNOWN"}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Balance Issues</div>
                            <div className="text-lg font-bold text-amber-600">
                              {reconciliationData.summary?.user_balance_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Total Issues</div>
                            <div className="text-lg font-bold text-red-600">
                              {reconciliationData.summary?.total_issues || 0}
                            </div>
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-2">
                          Last run:{" "}
                          {reconciliationData.summary?.timestamp
                            ? format(new Date(reconciliationData.summary.timestamp), "MMM d, yyyy 'at' HH:mm:ss")
                            : "Unknown"}
                        </p>
                      </CardContent>
                    </Card>

                    {reconciliationData.user_discrepancies && reconciliationData.user_discrepancies.length > 0 && (
                      <Card className="border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                            User Balance Discrepancies ({reconciliationData.user_discrepancies.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {reconciliationData.user_discrepancies.map((issue: any) => (
                              <Card key={issue.user_id} className="border-red-100 bg-red-50/30 shadow-sm">
                                <CardContent className="pt-3 text-[10px]">
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
                                    <div className="text-[9px] text-muted-foreground truncate">{issue.user_id}</div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {reconciliationData && !reconciliationData.user_discrepancies?.length && (
                      <Card className="border-green-200 bg-green-50/50 shadow-sm">
                        <CardContent className="pt-3">
                          <p className="text-xs text-green-700">
                            All user balances reconciled successfully! No discrepancies found.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {!reconciliationData && !isRunningReconciliation && (
                  <p className="text-[10px] text-muted-foreground">
                    Click the button above to audit user balances against the ledger.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Positions Audit - Full positions audit with all discrepancy types */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  Positions & Market State Audit
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Audit user positions and market qy/qn/liquidity against transaction tracking and ledger entries.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleRunPositionsAudit}
                  disabled={isRunningPositionsAudit}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
                >
                  {isRunningPositionsAudit ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Running Positions Audit...
                    </>
                  ) : (
                    "Run Positions Audit"
                  )}
                </Button>

                {positionsAuditData && (
                  <div className="space-y-3 mt-3">
                    {/* Summary Card */}
                    <Card
                      className={
                        positionsAuditData.summary?.status === "PASS"
                          ? "border-green-200 bg-green-50/50 shadow-sm"
                          : "border-amber-200 bg-amber-50/50 shadow-sm"
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs flex items-center gap-2">
                          {positionsAuditData.summary?.status === "PASS" ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          )}
                          Audit Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                          <div>
                            <div className="text-[10px] text-muted-foreground">Status</div>
                            <Badge
                              variant={positionsAuditData.summary?.status === "PASS" ? "default" : "destructive"}
                              className="mt-1 text-[9px]"
                            >
                              {positionsAuditData.summary?.status || "UNKNOWN"}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Position Issues</div>
                            <div className="text-lg font-bold text-amber-600">
                              {positionsAuditData.summary?.position_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Market qy Issues</div>
                            <div className="text-lg font-bold text-amber-600">
                              {positionsAuditData.summary?.market_qy_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Market qn Issues</div>
                            <div className="text-lg font-bold text-amber-600">
                              {positionsAuditData.summary?.market_qn_issues || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Liquidity Issues</div>
                            <div className="text-lg font-bold text-amber-600">
                              {positionsAuditData.summary?.liquidity_issues || 0}
                            </div>
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-2">
                          Last run:{" "}
                          {positionsAuditData.summary?.timestamp
                            ? format(new Date(positionsAuditData.summary.timestamp), "MMM d, yyyy 'at' HH:mm:ss")
                            : "N/A"}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Position Discrepancies */}
                    {positionsAuditData.position_discrepancies &&
                      positionsAuditData.position_discrepancies.length > 0 && (
                        <Card className="border-amber-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-amber-700">
                              Position Discrepancies ({positionsAuditData.position_discrepancies.length})
                            </CardTitle>
                            <p className="text-[9px] text-muted-foreground">
                              Positions table vs Transactions calculated
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {positionsAuditData.position_discrepancies.map((issue: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px]"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="font-medium">User:</span> {issue.user_id?.substring(0, 8)}...
                                      <span className="ml-2 font-medium">Market:</span>{" "}
                                      {issue.market_id?.substring(0, 8)}...
                                      <Badge variant="outline" className="ml-2 text-[8px]">
                                        {issue.side}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
                                    <div>
                                      <span className="text-muted-foreground">Positions Table:</span>
                                      <span className="ml-1 font-mono">{issue.positions_shares}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Transactions Calc:</span>
                                      <span className="ml-1 font-mono">{issue.transactions_shares}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Difference:</span>
                                      <span className="ml-1 font-mono text-red-600">{issue.difference}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {/* Market Share Discrepancies */}
                    {positionsAuditData.market_share_discrepancies &&
                      positionsAuditData.market_share_discrepancies.length > 0 && (
                        <Card className="border-amber-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-amber-700">
                              Market Share Discrepancies ({positionsAuditData.market_share_discrepancies.length})
                            </CardTitle>
                            <p className="text-[9px] text-muted-foreground">
                              Markets table vs Transactions vs Shares Ledger
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {positionsAuditData.market_share_discrepancies.map((issue: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px]"
                                >
                                  <div className="font-medium mb-2">
                                    {issue.market_title} ({issue.market_id?.substring(0, 8)}...)
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-[9px]">
                                    <div className={issue.qy?.has_mismatch ? "text-red-600" : ""}>
                                      <div className="font-medium">qy (YES shares)</div>
                                      <div>Markets: {issue.qy?.markets}</div>
                                      <div>Transactions: {issue.qy?.transactions}</div>
                                      <div>Ledger: {issue.qy?.ledger}</div>
                                    </div>
                                    <div className={issue.qn?.has_mismatch ? "text-red-600" : ""}>
                                      <div className="font-medium">qn (NO shares)</div>
                                      <div>Markets: {issue.qn?.markets}</div>
                                      <div>Transactions: {issue.qn?.transactions}</div>
                                      <div>Ledger: {issue.qn?.ledger}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {/* Liquidity Discrepancies */}
                    {positionsAuditData.liquidity_discrepancies &&
                      positionsAuditData.liquidity_discrepancies.length > 0 && (
                        <Card className="border-amber-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-amber-700">
                              Liquidity Discrepancies ({positionsAuditData.liquidity_discrepancies.length})
                            </CardTitle>
                            <p className="text-[9px] text-muted-foreground">
                              Markets table vs Ledger vs Transactions calculated
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {positionsAuditData.liquidity_discrepancies.map((issue: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px]"
                                >
                                  <div className="font-medium mb-2">
                                    {issue.market_title} ({issue.market_id?.substring(0, 8)}...)
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-[9px]">
                                    <div>
                                      <span className="text-muted-foreground">Markets Table:</span>
                                      <span className="ml-1 font-mono">${issue.markets}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Ledger:</span>
                                      <span className="ml-1 font-mono">${issue.ledger}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Transactions Calc:</span>
                                      <span className="ml-1 font-mono">${issue.transactions}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {/* No Issues Found */}
                    {positionsAuditData &&
                      !positionsAuditData.position_discrepancies?.length &&
                      !positionsAuditData.market_share_discrepancies?.length &&
                      !positionsAuditData.liquidity_discrepancies?.length && (
                        <Card className="border-green-200 bg-green-50/50 shadow-sm">
                          <CardContent className="py-4">
                            <div className="flex items-center gap-2 text-green-700 text-xs">
                              <CheckCircle className="w-4 h-4" />
                              <span>All positions, market shares, and liquidity reconciled successfully!</span>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                )}

                {!positionsAuditData && !isRunningPositionsAudit && (
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Click the button above to audit positions, market shares, and liquidity against transaction tracking
                    and ledger entries.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Private Market Settlement Audit
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Check private markets with proposed or contested settlements and their deadlines.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handlePrivateSettlementAudit}
                  disabled={isLoadingPrivateSettlements}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                >
                  {isLoadingPrivateSettlements ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    "Run Settlement Audit"
                  )}
                </Button>

                {privateSettlementData && (
                  <div className="mt-3 space-y-3">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-2 bg-muted rounded-lg text-center">
                        <div className="text-lg font-bold">{privateSettlementData.summary?.total || 0}</div>
                        <div className="text-[9px] text-muted-foreground">Total</div>
                      </div>
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                        <div className="text-lg font-bold text-yellow-600">
                          {privateSettlementData.summary?.proposed || 0}
                        </div>
                        <div className="text-[9px] text-muted-foreground">Proposed</div>
                      </div>
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                        <div className="text-lg font-bold text-orange-600">
                          {privateSettlementData.summary?.contested || 0}
                        </div>
                        <div className="text-[9px] text-muted-foreground">Contested</div>
                      </div>
                      <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                        <div className="text-lg font-bold text-red-600">
                          {privateSettlementData.summary?.past_deadline || 0}
                        </div>
                        <div className="text-[9px] text-muted-foreground">Past Deadline</div>
                      </div>
                    </div>

                    {/* Markets List */}
                    {privateSettlementData.markets && privateSettlementData.markets.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium">Markets with Settlement Status:</h4>
                        {privateSettlementData.markets.map((market: any) => (
                          <div
                            key={market.id}
                            className={`p-3 border rounded-lg ${
                              market.is_past_deadline ? "border-red-300 bg-red-50 dark:bg-red-900/20" : "border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-xs">{market.title}</span>
                                  <Badge
                                    variant={market.settlement_status === "proposed" ? "secondary" : "destructive"}
                                    className="text-[8px]"
                                  >
                                    {market.settlement_status}
                                  </Badge>
                                  {market.is_past_deadline && (
                                    <Badge variant="destructive" className="text-[8px]">
                                      EXPIRED
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Creator: {market.creator?.display_name || market.creator?.username}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
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
                                  className={`text-[10px] font-medium ${
                                    market.is_past_deadline ? "text-red-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {market.time_remaining_formatted}
                                </div>
                                {market.contest_deadline && (
                                  <div className="text-[9px] text-muted-foreground">
                                    Deadline: {format(new Date(market.contest_deadline), "MMM d, yyyy HH:mm")}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-[9px] text-muted-foreground">ID: {market.id}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
                        <p className="text-xs">No private markets with pending settlements</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Settlement - Moved to bottom */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Play className="w-4 h-4 text-green-600" />
                  Local Settlement Testing
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Test the auto-settlement system locally. This works on localhost without needing CRON_SECRET.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-xs mb-1">
                        Local Testing Mode
                      </h4>
                      <p className="text-[10px] text-blue-800 dark:text-blue-200 mb-1">
                        You're running on localhost, so the Vercel cron job won't trigger automatically. Use this button
                        to manually test the settlement process.
                      </p>
                      <p className="text-[9px] text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> When deployed to Vercel, settlements will run automatically every 5
                        minutes via cron job.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-semibold text-xs mb-1">Run Settlement Check</h3>
                    <p className="text-[10px] text-muted-foreground">Check for expired markets and resolve contests.</p>
                  </div>
                  <Button
                    onClick={handleCheckSettlements}
                    disabled={isCheckingSettlements}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 ml-3"
                  >
                    {isCheckingSettlements ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      "Test Settlement Now"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
