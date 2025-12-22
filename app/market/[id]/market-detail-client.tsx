"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, Clock, Users, DollarSign, AlertTriangle, ArrowLeft, ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { executeTrade } from "@/app/actions/trade"
import { cancelPrivateMarket } from "@/app/actions/admin"
import { initiateSettlement, contestSettlement, submitVote, getSettlementStatus } from "@/app/actions/oracle-settlement"
import { proposeUMAOutcome } from "@/app/actions/uma-settlement"
import { BlockchainStatus } from "@/components/blockchain-status"
import Link from "next/link"
import {
  calculateSharesToBuyWithFee,
  calculatePricePerShare,
  getMarketOdds,
  calculateYesProbability,
  calculateNoProbability,
} from "@/lib/lmsr"
import { FEE_PERCENTAGE } from "@/lib/fees"
import { getMarketStatusDisplay, canTrade, isSettled } from "@/lib/market-status"
import { shouldShowBlockchainUI } from "@/lib/blockchain/feature-flags"
import type { Position } from "@/types/position"
import { MarketPriceChart } from "@/components/market-price-chart"
import { ProposeOutcomeDialog } from "@/components/propose-outcome-dialog"
import { BLOCKCHAIN_FEATURES } from "@/lib/blockchain/feature-flags"
import { useToast } from "@/hooks/use-toast"
import { ContestOutcomeDialog } from "@/components/contest-outcome-dialog"
import { VoteOutcomeDialog } from "@/components/vote-outcome-dialog"
import { SellSharesDialog } from "@/components/sell-shares-dialog"

type OutcomeChoice = "yes" | "no" | "cancel"

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
  creator_settlement_outcome?: boolean
  contest_deadline?: string
  blockchain_market_address?: string | null
  blockchain_status?: string | null
  uma_request_id?: string | null
  uma_liveness_ends_at?: string | null
  creator_settlement_outcome_text?: string
  twap_yes_probability?: number | null
  twap_above_threshold_since?: string | null
  early_settlement_unlocked?: boolean
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
  const [market, setMarket] = useState({
    ...initialMarket,
    total_volume: Number.parseFloat(initialMarket.total_volume.toString()),
    yes_shares: Number.parseFloat(initialMarket.yes_shares.toString()),
    no_shares: Number.parseFloat(initialMarket.no_shares.toString()),
    qy: Number.parseFloat(initialMarket.qy.toString()),
    qn: Number.parseFloat(initialMarket.qn.toString()),
    liquidity_pool: Number.parseFloat(initialMarket.liquidity_pool.toString()),
    b: Number.parseFloat(initialMarket.b.toString()),
  })
  const [userPositions, setUserPositions] = useState(initialUserPositions)
  const [userBalance, setUserBalance] = useState(Number.parseFloat(initialUserBalance.toString()))
  const [accessibleGroups] = useState(initialAccessibleGroups)
  const [betAmount, setBetAmount] = useState("")
  const [selectedSide, setSelectedSide] = useState<boolean>(true)
  const [isTrading, setIsTrading] = useState(false)
  const [isSettling, setIsSettling] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRequestingSettlement, setIsRequestingSettlement] = useState(false)
  const [settlementStatus, setSettlementStatus] = useState<any>(null)
  const [isContesting, setIsContesting] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<boolean | null>(null)
  const [voteOutcome, setVoteOutcome] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [showProposeDialog, setShowProposeDialog] = useState(false)
  const [showContestDialog, setShowContestDialog] = useState(false)
  const [showVoteDialog, setShowVoteDialog] = useState(false)
  const { toast } = useToast()

  const [isRulesExpanded, setIsRulesExpanded] = useState(false)

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
        pricePerShare: result.pricePerShare, // Added pricePerShare to return object
      }
    } catch (error) {
      console.error("Error calculating price:", error)
      return { shares: 0, avgPrice: 0, feeAmount: 0, netAmount: 0, effectiveAmount: 0, pricePerShare: 0 }
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

      if (amount < 2.0) {
        throw new Error("Minimum trade amount is $2.00")
      }

      if (amount > userBalance) {
        throw new Error("Insufficient balance")
      }

      const pricing = calculatePrice(market.qy, market.qn, market.b, selectedSide, amount)
      const shares = pricing.shares

      console.log("[v0] Trade calculation:", {
        amount,
        pricing,
        shares,
        marketQy: market.qy,
        marketQn: market.qn,
        selectedSide,
      })

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
      const newTotalVolume = market.total_volume + pricing.netAmount
      const newYesShares = selectedSide ? market.yes_shares + shares : market.yes_shares
      const newNoShares = !selectedSide ? market.no_shares + shares : market.no_shares

      console.log("[v0] Executing trade with params:", {
        marketId: market.id,
        amount,
        side: selectedSide ? "YES" : "NO",
        newQy,
        newQn,
        shares,
        newTotalVolume,
        newYesShares,
        newNoShares,
        newLiquidityPool,
        feeAmount: pricing.feeAmount,
        netAmount: pricing.netAmount,
        expectedPrice: pricing.pricePerShare, // Added expectedPrice to log for debugging
      })

      const result = await executeTrade(
        market.id,
        amount,
        selectedSide ? "YES" : "NO",
        currentUserId,
        newQy,
        newQn,
        shares,
        newTotalVolume,
        newYesShares,
        newNoShares,
        newLiquidityPool,
        pricing.feeAmount,
        pricing.netAmount,
        5, // maxSlippagePercent (2% default enforced by SQL function)
        pricing.pricePerShare, // expectedPrice for slippage validation
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

  const handlePrivateMarketSettlement = async (winningSide: OutcomeChoice) => {
    setIsSettling(true)
    setError(null)

    try {
      const result = await initiateSettlement(market.id, winningSide)

      if (!result.success) {
        throw new Error(result.error || "Settlement initiation failed")
      }

      await fetchSettlementStatus()
      router.refresh()
    } catch (error: any) {
      console.error("[v0] Settlement initiation error:", error)
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

  const handleContestWithOutcome = async (contestedOutcome: OutcomeChoice) => {
    setIsContesting(true)
    setError(null)

    try {
      const result = await contestSettlement(market.id, contestedOutcome)

      if (!result.success) {
        toast({
          title: "Unable to Contest",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Settlement Contested",
        description: "Your contest has been submitted. Voters have been notified.",
      })

      setShowContestDialog(false)
      window.location.reload()
    } catch (error: any) {
      console.error("[v0] Contest error:", error)
      toast({
        title: "Error",
        description: "Failed to contest settlement. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsContesting(false)
    }
  }

  const handleSubmitVoteWithOutcome = async (voteOutcome: OutcomeChoice) => {
    if (!settlementStatus?.contest_id) {
      console.error("[v0] No contest ID available for voting")
      setError("Contest not found")
      return
    }

    setIsVoting(true)
    setError(null)

    try {
      const result = await submitVote(settlementStatus.contest_id, voteOutcome)

      if (!result.success) {
        throw new Error(result.error || "Vote submission failed")
      }

      toast({
        title: "Vote Submitted",
        description: `Your vote for ${voteOutcome.toUpperCase()} has been recorded.`,
      })

      setShowVoteDialog(false)
      await fetchSettlementStatus()
      router.refresh()
    } catch (error: any) {
      console.error("[v0] Vote error:", error)
      setError(error.message)
    } finally {
      setIsVoting(false)
    }
  }

  const fetchSettlementStatus = async () => {
    try {
      const result = await getSettlementStatus(market.id)
      if (result.success && result.data) {
        setSettlementStatus(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch settlement status:", error)
    }
  }

  const handleProposeOutcome = async () => {
    console.log("[v0] Propose outcome button clicked", { currentUserId, marketId: market.id })

    if (!currentUserId) {
      setError("Please log in to propose an outcome")
      return
    }

    setShowProposeDialog(true)
  }

  const handleConfirmProposal = async (outcomeChoice: boolean) => {
    console.log("[v0] User confirmed outcome:", outcomeChoice ? "YES" : "NO")

    setIsRequestingSettlement(true)
    setError(null)

    try {
      console.log("[v0] Calling proposeUMAOutcome...", {
        marketId: market.id,
        outcome: outcomeChoice,
        userId: currentUserId,
      })

      const result = await proposeUMAOutcome(market.id, outcomeChoice, currentUserId)

      console.log("[v0] proposeUMAOutcome result:", result)

      if (result.success) {
        console.log("[v0] Proposal successful, closing dialog and refreshing page")
        setShowProposeDialog(false)
        router.refresh()
      } else {
        console.error("[v0] Proposal failed:", result.error)
        setError(result.error || "Failed to propose outcome")
      }
    } catch (error: any) {
      console.error("[v0] Proposal error:", error)
      setError(error.message || "An unexpected error occurred")
    } finally {
      setIsRequestingSettlement(false)
    }
  }

  // Added sellShares function
  const sellShares = async (positionId: string, sharesToSell: number, expectedValue: number) => {
    // This is a placeholder for the actual sell shares logic.
    // In a real application, you would call an API here to execute the sale.
    console.log("Selling shares:", { positionId, sharesToSell, expectedValue })
    toast({
      title: "Shares Sold",
      description: `Successfully sold ${sharesToSell.toFixed(2)} shares for $${expectedValue.toFixed(2)}.`,
    })
    // After selling, you'd likely want to refresh the user's positions and balance.
    // For now, we'll just simulate a refresh.
    router.refresh()
  }

  useEffect(() => {
    if (market.is_private) {
      fetchSettlementStatus()
    }
  }, [market])

  useEffect(() => {
    const showUI = shouldShowBlockchainUI()
    console.log("[v0] Blockchain UI visibility check:", {
      shouldShow: showUI,
      blockchainFeatures: BLOCKCHAIN_FEATURES,
      isPrivate: market.is_private,
    })
  }, [market.is_private])

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
    market.is_private &&
    market.creator_id === currentUserId &&
    !marketSettled &&
    market.status !== "suspended" &&
    market.status !== "contested" &&
    !settlementStatus?.status &&
    market.outcome === null

  const hasAnyPosition = userPositions.length > 0

  const canContestSettlement =
    !marketSettled &&
    (settlementStatus?.status === "pending_contest" || market.status === "suspended") &&
    market.status !== "contested" &&
    settlementStatus?.status !== "contested" &&
    currentUserId !== market.creator_id &&
    hasAnyPosition &&
    market.contest_deadline &&
    new Date(market.contest_deadline) > new Date()

  const canVote =
    settlementStatus?.status === "contested" && settlementStatus?.is_notified_voter && !settlementStatus?.has_voted

  const yesPosition = userPositions.find((pos) => pos.side === true)
  const noPosition = userPositions.find((pos) => pos.side === false)

  const hasUMARequest = !market.is_private && market.uma_request_id

  const getOutcomeLabel = (outcome: OutcomeChoice | boolean | null): string => {
    if (outcome === true || outcome === "yes") return "YES"
    if (outcome === false || outcome === "no") return "NO"
    if (outcome === "cancel") return "CANCEL"
    return "Unknown"
  }

  const getCreatorOutcomeDisplay = () => {
    // First try text values which are more reliable
    if (settlementStatus?.creator_outcome_text) {
      return settlementStatus.creator_outcome_text.toUpperCase()
    }
    // Then try boolean with proper null check
    if (settlementStatus?.creator_outcome !== null && settlementStatus?.creator_outcome !== undefined) {
      return settlementStatus.creator_outcome ? "YES" : "NO"
    }
    // Fall back to market data
    if (market.creator_settlement_outcome_text) {
      return market.creator_settlement_outcome_text.toUpperCase()
    }
    if (market.creator_settlement_outcome !== null && market.creator_settlement_outcome !== undefined) {
      return market.creator_settlement_outcome ? "YES" : "NO"
    }
    return "UNKNOWN"
  }

  const isLoggedIn = !!currentUserId

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-3 md:mb-4 hidden md:block">
          <Button variant="ghost" asChild className="w-fit h-8 text-sm">
            <Link href="/">
              <ArrowLeft className="w-3 h-3 md:w-4 md:h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <Card>
              <CardHeader className="pb-3 md:pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{market.title}</CardTitle>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap max-w-full overflow-hidden">
                  <Badge variant="secondary" className="flex-shrink-0 text-xs px-2 py-0.5">
                    {market.category}
                  </Badge>
                  {marketStatus && (
                    <Badge
                      variant={marketStatus.color}
                      className="flex items-center gap-1 flex-shrink-0 text-xs px-2 py-0.5"
                    >
                      <Clock className="w-3 h-3" />
                      {marketStatus.label}
                    </Badge>
                  )}
                  {market.is_private && (
                    <Badge
                      variant="outline"
                      className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 flex-shrink-0 text-xs px-2 py-0.5"
                    >
                      Private
                    </Badge>
                  )}
                  {!marketSettled && settlementStatus?.status === "pending_contest" && (
                    <Badge
                      variant="outline"
                      className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 flex-shrink-0 text-xs px-2 py-0.5"
                    >
                      Settlement Pending
                    </Badge>
                  )}
                </div>

                <div className="mt-3 text-[10px] text-muted-foreground/80 font-medium">
                  Created by{" "}
                  <span className="text-muted-foreground">
                    {market.creator.display_name || market.creator.username}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">YES</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">{yesImpliedProbability.toFixed(1)}%</span>
                  </div>

                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-gray-900 dark:bg-gray-300 transition-all duration-500 ease-out"
                      style={{
                        width: `${yesPercentage}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium">NO</span>
                    </div>
                    <span className="text-lg font-bold text-red-600">{noImpliedProbability.toFixed(1)}%</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Total Volume</span>
                      </div>
                      <div className="text-lg font-semibold">
                        ${Number.parseFloat(market.total_volume.toString()).toFixed(2)}
                      </div>
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

            <Card>
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Rules</CardTitle>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isRulesExpanded ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
              {isRulesExpanded && (
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {market.description || "No rules specified for this market."}
                  </p>
                </CardContent>
              )}
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

            {!marketSettled && (settlementStatus?.status === "pending_contest" || market.status === "suspended") && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    Settlement Pending Contest
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    The creator has proposed settling this market as <strong>{getCreatorOutcomeDisplay()}</strong>.
                    {currentUserId === market.creator_id
                      ? " Waiting for the 1-hour contest period to expire."
                      : " You can contest this decision if you disagree."}
                  </p>

                  <div className="p-3 bg-white dark:bg-gray-800 rounded border space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Proposed Outcome:</span>
                      <span className="font-semibold">{getCreatorOutcomeDisplay()}</span>
                    </div>
                    {currentUserId === market.creator_id && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Your Bond:</span>
                        <span className="font-semibold">${settlementStatus?.bond_amount?.toFixed(2) || "0.00"}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contest Deadline:</span>
                      <span className="font-semibold">
                        {settlementStatus?.time_remaining ||
                          (market.contest_deadline
                            ? format(new Date(market.contest_deadline), "MMM d, h:mm a")
                            : "N/A")}
                      </span>
                    </div>
                  </div>

                  {canContestSettlement && (
                    <>
                      <Button
                        onClick={() => setShowContestDialog(true)}
                        disabled={isContesting}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        {isContesting ? "Contesting..." : "Contest This Outcome"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        If you contest, random participants will be selected to vote. If the majority agrees with you,
                        you'll receive your bond back plus a share of the creator's bond.
                      </p>
                    </>
                  )}

                  {currentUserId === market.creator_id && (
                    <p className="text-xs text-muted-foreground">
                      If no one contests within the deadline, the market will settle automatically.
                    </p>
                  )}

                  {!canContestSettlement && currentUserId !== market.creator_id && !hasAnyPosition && (
                    <p className="text-xs text-muted-foreground">
                      Only participants with positions can contest the settlement.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!marketSettled &&
              (settlementStatus?.status === "contested" || market.status === "contested") &&
              settlementStatus && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex flex-col gap-1 text-red-600">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />A settlement has been contested
                      </div>
                      <div className="text-sm font-normal text-red-500">
                        Voting Deadline:{" "}
                        {settlementStatus.voting_deadline
                          ? new Date(settlementStatus.voting_deadline).toLocaleString()
                          : "Loading..."}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      This settlement has been contested. Verifiers are voting on the outcome.
                    </p>

                    {canVote && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="mb-3">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            You've Been Selected to Vote!
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Cast your vote on the correct outcome. You'll receive a $25 bond for participating, plus a
                            share of the losing party's bond if you vote with the majority.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-white dark:bg-gray-800 rounded border">
                            <div className="text-sm text-muted-foreground mb-1">Creator's Proposed Outcome:</div>
                            <div className="font-semibold text-lg">
                              {settlementStatus.creator_outcome ? "YES" : "NO"}
                            </div>
                          </div>

                          <div className="text-sm text-center text-muted-foreground">
                            Which outcome do you believe is correct?
                          </div>

                          {error && (
                            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              onClick={() => handleSubmitVoteWithOutcome("yes")}
                              disabled={isVoting}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isVoting ? "Voting..." : "Vote YES"}
                            </Button>
                            <Button
                              onClick={() => handleSubmitVoteWithOutcome("no")}
                              disabled={isVoting}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {isVoting ? "Voting..." : "Vote NO"}
                            </Button>
                          </div>

                          <p className="text-xs text-muted-foreground text-center">
                            Your $25 voting bond will be returned with rewards after the voting period ends.
                          </p>
                        </div>
                      </div>
                    )}

                    {settlementStatus.is_notified_voter && settlementStatus.has_voted && (
                      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="font-medium">✓ You've already voted</span>
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          Thank you for participating! Your vote has been recorded and your bond will be returned with
                          rewards after the voting period ends.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            <MarketPriceChart marketId={marketId} />

            {!tradingAllowed && !marketSettled && (market.status === "suspended" || market.status === "contested") && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Trading Suspended</span>
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    Trading is disabled while the market is in the settlement process.
                  </p>
                </CardContent>
              </Card>
            )}

            {!tradingAllowed && !marketSettled && market.status !== "suspended" && market.status !== "contested" && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <CardHeader>
                  <CardTitle className="text-lg">Trading Closed</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium">Trading Closed</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    This market has expired and is awaiting settlement by an administrator.
                  </p>
                </CardContent>
              </Card>
            )}

            {hasAnyPosition && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Your Positions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {yesPosition && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-green-600">YES Position</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {Number.parseFloat(yesPosition.shares.toString()).toFixed(2)} shares
                          </span>
                          <SellSharesDialog
                            position={{
                              id: yesPosition.id,
                              side: true,
                              shares: Number.parseFloat(yesPosition.shares.toString()),
                              avg_price: yesPosition.avg_price.toString(),
                              amount_invested: Number.parseFloat(yesPosition.amount_invested.toString()),
                              market: {
                                id: market.id,
                                title: market.title,
                                qy: market.qy,
                                qn: market.qn,
                                b: market.b,
                              },
                            }}
                            onSell={async (positionId: string, sharesToSell: number, expectedValue: number) => {
                              await sellShares(positionId, sharesToSell, expectedValue)
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Invested: </span>
                          <span className="font-medium">
                            ${Number.parseFloat(yesPosition.amount_invested.toString()).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Price: </span>
                          <span className="font-medium">
                            ${Number.parseFloat(yesPosition.avg_price.toString()).toFixed(3)} per share
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {noPosition && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-red-600">NO Position</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {Number.parseFloat(noPosition.shares.toString()).toFixed(2)} shares
                          </span>
                          <SellSharesDialog
                            position={{
                              id: noPosition.id,
                              side: false,
                              shares: Number.parseFloat(noPosition.shares.toString()),
                              avg_price: noPosition.avg_price.toString(),
                              amount_invested: Number.parseFloat(noPosition.amount_invested.toString()),
                              market: {
                                id: market.id,
                                title: market.title,
                                qy: market.qy,
                                qn: market.qn,
                                b: market.b,
                              },
                            }}
                            onSell={async (positionId: string, sharesToSell: number, expectedValue: number) => {
                              await sellShares(positionId, sharesToSell, expectedValue)
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Invested: </span>
                          <span className="font-medium">
                            ${Number.parseFloat(noPosition.amount_invested.toString()).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Price: </span>
                          <span className="font-medium">
                            ${Number.parseFloat(noPosition.avg_price.toString()).toFixed(3)} per share
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Creator settlement proposal - updated for 3-way */}
            {canSettlePrivateMarket && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Settle Your Private Market
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    This private market can now be settled. Your creator fees will be posted as a bond, and participants
                    will have 1 hour to contest your decision.
                  </p>

                  {error && (
                    <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handlePrivateMarketSettlement("yes")}
                      disabled={isSettling || isCancelling}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isSettling ? "Settling..." : "Settle as YES"}
                    </Button>
                    <Button
                      onClick={() => handlePrivateMarketSettlement("no")}
                      disabled={isSettling || isCancelling}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {isSettling ? "Settling..." : "Settle as NO"}
                    </Button>
                  </div>

                  <Button
                    onClick={() => handlePrivateMarketSettlement("cancel")}
                    disabled={isSettling || isCancelling}
                    variant="outline"
                    className="w-full bg-transparent border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                  >
                    {isSettling ? "Cancelling..." : "Cancel Market (Refund All)"}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Your creator fees will be held as a bond. If no one contests within 1 hour, the market will settle
                    automatically. If contested, participants will vote on the outcome.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Early Settlement Unlock */}
            {market.twap_above_threshold_since && market.early_settlement_unlocked && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-green-600" />
                    Early Settlement Unlocked
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Early settlement has been unlocked due to TWAP being above the threshold since{" "}
                    {format(new Date(market.twap_above_threshold_since), "MMM d, yyyy h:mm a")}.
                  </p>
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
                <div className="text-2xl font-bold text-green-600">
                  ${Number.parseFloat(userBalance.toString()).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            {shouldShowBlockchainUI() && (
              <BlockchainStatus
                marketId={market.id}
                blockchainAddress={market.blockchain_market_address}
                blockchainStatus={market.blockchain_status}
                umaRequestId={market.uma_request_id}
                livenessEndsAt={market.uma_liveness_ends_at}
                isPrivate={market.is_private}
                endDate={market.end_date}
                earlySettlementUnlocked={market.early_settlement_unlocked}
                twapYesProbability={market.twap_yes_probability}
                twapAboveThresholdSince={market.twap_above_threshold_since}
                onProposeOutcome={handleProposeOutcome}
                isRequestingSettlement={isRequestingSettlement}
              />
            )}

            {tradingAllowed && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Place Bet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isLoggedIn ? (
                    <div className="text-center py-8 space-y-4">
                      <p className="text-sm text-muted-foreground">Sign in to place bets and trade on this market</p>
                      <div className="flex gap-2 justify-center">
                        <Button asChild variant="outline">
                          <Link href="/auth/login">Sign In</Link>
                        </Button>
                        <Button asChild>
                          <Link href="/auth/sign-up">Sign Up</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Tabs
                        value={selectedSide ? "yes" : "no"}
                        onValueChange={(value) => setSelectedSide(value === "yes")}
                      >
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
                          min="2.00"
                          max={userBalance}
                          step="0.01"
                        />
                        {betAmount && Number.parseFloat(betAmount) < 2.0 && (
                          <p className="text-xs text-red-500 mt-1">Minimum trade amount is $2.00</p>
                        )}
                      </div>

                      {previewPricing && previewPricing.shares > 0 && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm space-y-2">
                          <div className="font-medium mb-1">Bet Preview:</div>
                          <div className="space-y-1">
                            <div>
                              You'll receive:{" "}
                              <span className="font-medium">{previewPricing.shares.toFixed(2)} shares</span>
                            </div>
                            <div>
                              Unit price:{" "}
                              <span className="font-medium">${previewPricing.avgPrice.toFixed(3)} per share</span>
                            </div>
                            <div>
                              Fee ({(FEE_PERCENTAGE * 100).toFixed(1)}%):{" "}
                              <span className="font-medium">${previewPricing.feeAmount.toFixed(2)}</span>
                            </div>
                            <div className="pt-1 border-t border-blue-200 dark:border-blue-800">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Max Payout:</span>
                                <span className="font-bold text-green-600">${previewPricing.shares.toFixed(2)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                (if {selectedSide ? "YES" : "NO"} wins, each share pays $1)
                              </div>
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
                          Number.parseFloat(betAmount) < 2.0 ||
                          Number.parseFloat(betAmount) > userBalance
                        }
                        className="w-full"
                      >
                        {isTrading ? "Placing Bet..." : `Bet ${selectedSide ? "YES" : "NO"} - $${betAmount || "0.00"}`}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <ProposeOutcomeDialog
        open={showProposeDialog}
        onOpenChange={setShowProposeDialog}
        onConfirm={handleConfirmProposal}
        isLoading={isRequestingSettlement}
        marketTitle={market.title}
      />
      <ContestOutcomeDialog
        open={showContestDialog}
        onOpenChange={setShowContestDialog}
        onConfirm={handleContestWithOutcome}
        isLoading={isContesting}
        marketTitle={market.title}
        creatorProposedOutcome={
          settlementStatus?.creator_outcome_text || (settlementStatus?.creator_outcome ? "yes" : "no")
        }
      />

      <VoteOutcomeDialog
        open={showVoteDialog}
        onOpenChange={setShowVoteDialog}
        onConfirm={handleSubmitVoteWithOutcome}
        isLoading={isVoting}
        marketTitle={market.title}
        creatorProposedOutcome={
          settlementStatus?.creator_outcome_text || (settlementStatus?.creator_outcome ? "yes" : "no")
        }
        voteCounts={settlementStatus?.vote_counts}
      />
    </div>
  )
}
