"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, TrendingUp, TrendingDown, History, Activity, Users, Building2, AlertTriangle } from "lucide-react"
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

interface Position {
  id: string
  side: boolean
  shares: number
  avg_price: number
  amount_invested: number
  market: {
    id: string
    title: string
    category: string
    status: string
    end_date: string
    outcome: boolean | null
    qy: number
    qn: number
    liquidity_pool: number
    yes_shares: number
    no_shares: number
    total_volume: number
    is_private: boolean
    b?: number
    creator?: {
      username: string
      display_name: string
    }
  }
}

interface PrivateMarket {
  id: string
  title: string
  description: string
  category: string
  status: string
  end_date: string
  outcome: boolean | null
  creator_id: string
  created_at: string
  creator?: {
    username: string
    display_name: string
  }
  participants?: {
    user_id: string
    status: string
    group_id: string
    user: {
      username: string
      display_name: string
    }
  }[]
}

interface CreatedMarket {
  id: string
  title: string
  description: string
  category: string
  status: string
  end_date: string
  outcome: boolean | null
  creator_id: string
  created_at: string
  total_volume: number
  cumulative_creator_fees: number
  is_private: boolean
}

export default function MyBetsPage() {
  const [activePositions, setActivePositions] = useState<Position[]>([])
  const [historicalPositions, setHistoricalPositions] = useState<Position[]>([])
  const [proposedToMe, setProposedToMe] = useState<PrivateMarket[]>([])
  const [privateActivePositions, setPrivateActivePositions] = useState<Position[]>([])
  const [createdMarkets, setCreatedMarkets] = useState<CreatedMarket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSettling, setIsSettling] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadBets()
    loadCreatedMarkets()

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadBets()
        loadCreatedMarkets()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    const handleFocus = () => {
      loadBets()
      loadCreatedMarkets()
    }

    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  const getCurrentSharePrice = (qy: number, qn: number, side: boolean) => {
    const prices = calculateLMSRPrices(qy, qn)
    return side ? prices.yes : prices.no
  }

  const loadBets = async () => {
    try {
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/auth/login")
        return
      }

      console.log("[v0] Loading bets for user:", user.id)

      // Load private markets using group-based access
      const privateMarkets = await loadPrivateMarkets(user, supabase)

      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select(`
          *,
          market:markets(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (positionsError) throw positionsError

      const positionsWithCreators = await addCreatorProfilesToPositions(positions || [], supabase)

      // Separate active and historical positions
      const activePositions =
        positionsWithCreators?.filter(
          (p) => p.shares > 0.01 && p.market.outcome === null && p.market.status !== "cancelled",
        ) || []

      const historicalPositions =
        positionsWithCreators?.filter(
          (p) => p.shares <= 0.01 || p.market.outcome !== null || p.market.status === "cancelled",
        ) || []

      console.log("[v0] Debug - All positions with market outcomes:")
      positionsWithCreators?.forEach((p, index) => {
        console.log(`[v0] Position ${index}:`, {
          marketTitle: p.market.title,
          shares: p.shares,
          marketOutcome: p.market.outcome,
          marketStatus: p.market.status,
          isActive: p.shares > 0.01 && p.market.outcome === null && p.market.status !== "cancelled",
          isHistorical: p.shares <= 0.01 || p.market.outcome !== null || p.market.status === "cancelled",
        })
      })

      console.log("[v0] Active positions:", activePositions.length)
      console.log("[v0] Historical positions:", historicalPositions.length)
      console.log("[v0] Private markets:", privateMarkets.length)

      setActivePositions(activePositions)
      setHistoricalPositions(historicalPositions)
      setProposedToMe(privateMarkets)
    } catch (error: any) {
      console.error("[v0] Error loading bets:", error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPrivateMarkets = async (user: any, supabase: any) => {
    console.log("[v0] Loading private markets using group-based access")

    // Get user's group IDs
    const { data: userGroups, error: groupError } = await supabase
      .from("user_groups")
      .select("group_id")
      .eq("user_id", user.id)

    if (groupError) {
      console.error("[v0] Error fetching user groups:", groupError)
      return []
    }

    const userGroupIds = userGroups?.map((ug) => ug.group_id) || []
    console.log("[v0] User group IDs:", userGroupIds)

    if (userGroupIds.length === 0) {
      console.log("[v0] User is not in any groups, checking only created markets")

      const { data: createdMarkets, error: createdError } = await supabase
        .from("markets")
        .select("*")
        .eq("is_private", true)
        .eq("creator_id", user.id)
        .is("outcome", null) // Added filter to exclude settled markets (outcome is null)
        .neq("status", "cancelled") // Exclude cancelled markets
        .order("created_at", { ascending: false })

      if (createdError) {
        console.error("[v0] Error fetching created private markets:", createdError)
        return []
      }

      console.log("[v0] Created private markets (no groups):", createdMarkets?.length)
      console.log(
        "[v0] Markets with outcomes:",
        createdMarkets?.map((m) => ({ id: m.id, title: m.title, outcome: m.outcome })),
      )

      const marketsWithCreators = await addCreatorProfiles(createdMarkets || [], supabase)
      return marketsWithCreators
    }

    // Query markets where user is creator OR group member
    const { data: createdMarkets, error: createdError } = await supabase
      .from("markets")
      .select("*")
      .eq("is_private", true)
      .eq("creator_id", user.id)
      .is("outcome", null) // Added filter to exclude settled markets
      .neq("status", "cancelled") // Exclude cancelled markets

    const { data: groupMarkets, error: groupError2 } = await supabase
      .from("markets")
      .select("*")
      .eq("is_private", true)
      .in("group_id", userGroupIds)
      .is("outcome", null) // Added filter to exclude settled markets
      .neq("status", "cancelled") // Exclude cancelled markets

    if (createdError || groupError2) {
      console.error("[v0] Error fetching private markets:", createdError || groupError2)
      return []
    }

    console.log("[v0] Created private markets:", createdMarkets?.length)
    console.log("[v0] Group private markets:", groupMarkets?.length)

    // Combine and deduplicate
    const allMarkets = [...(createdMarkets || []), ...(groupMarkets || [])]
    const uniqueMarkets = allMarkets.filter(
      (market, index, self) => index === self.findIndex((m) => m.id === market.id),
    )

    console.log("[v0] Found private markets via group access:", uniqueMarkets.length)
    console.log(
      "[v0] Unique markets outcomes:",
      uniqueMarkets.map((m) => ({ id: m.id, title: m.title, outcome: m.outcome })),
    )

    const marketsWithCreators = await addCreatorProfiles(uniqueMarkets, supabase)
    return marketsWithCreators
  }

  const addCreatorProfiles = async (markets: any[], supabase: any) => {
    if (!markets || markets.length === 0) return []

    const creatorIds = [...new Set(markets.map((m) => m.creator_id))]

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", creatorIds)

    if (error) {
      console.error("[v0] Error fetching creator profiles:", error)
      // Return markets without creator info if profile fetch fails
      return markets.map((market) => ({
        ...market,
        creator: { username: "Unknown", display_name: "Unknown User" },
      }))
    }

    // Map creator profiles to markets
    return markets.map((market) => {
      const creator = profiles?.find((p) => p.id === market.creator_id)
      return {
        ...market,
        creator: creator || { username: "Unknown", display_name: "Unknown User" },
      }
    })
  }

  const loadCreatedMarkets = async () => {
    try {
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) return

      const { data: marketsData, error: marketsError } = await supabase
        .from("markets")
        .select(
          "id, title, description, category, status, end_date, outcome, creator_id, created_at, total_volume, creator_fees_earned, is_private",
        )
        .eq("creator_id", user.id)
        .is("outcome", null) // Only show markets that haven't been settled (outcome is null)
        .neq("status", "cancelled") // Exclude cancelled markets
        .order("created_at", { ascending: false })

      if (marketsError) throw marketsError

      console.log("[v0] Loaded created markets:", marketsData?.length)
      console.log(
        "[v0] Markets data:",
        marketsData?.map((m) => ({
          id: m.id,
          title: m.title,
          outcome: m.outcome,
          status: m.status,
          is_private: m.is_private,
        })),
      )

      const marketsWithFees = (marketsData || []).map((market) => ({
        ...market,
        cumulative_creator_fees: market.creator_fees_earned || 0,
      }))

      setCreatedMarkets(marketsWithFees)
    } catch (error: any) {
      console.error("Error loading created markets:", error)
    }
  }

  const acceptPrivateBet = async (marketId: string) => {
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error: participantError } = await supabase
        .from("market_participants")
        .update({ status: "accepted" })
        .eq("market_id", marketId)
        .eq("user_id", user.id)

      if (participantError) throw participantError

      const { data: participants, error: participantsError } = await supabase
        .from("market_participants")
        .select("status")
        .eq("market_id", marketId)

      if (participantsError) throw participantsError

      const allAccepted = participants?.every((p) => p.status === "accepted")

      if (allAccepted) {
        const { error: marketError } = await supabase.from("markets").update({ status: "active" }).eq("id", marketId)

        if (marketError) throw marketError
      }

      setProposedToMe((prev) => prev.filter((market) => market.id !== marketId))

      router.push(`/market/${marketId}`)
    } catch (error: any) {
      setError(error.message)
      await loadBets()
    }
  }

  const declinePrivateBet = async (marketId: string) => {
    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error: participantError } = await supabase
        .from("market_participants")
        .update({ status: "declined" })
        .eq("market_id", marketId)
        .eq("user_id", user.id)

      if (participantError) throw participantError

      setProposedToMe((prev) => prev.filter((market) => market.id !== marketId))
    } catch (error: any) {
      setError(error.message)
      await loadBets()
    }
  }

  const handleSellShares = async (positionId: string, sharesToSell: number, expectedValue: number) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("User not authenticated")

      const position = [...activePositions, ...historicalPositions].find((p) => p.id === positionId)
      if (!position) throw new Error("Position not found")

      const isSellingAll = Math.abs(sharesToSell - position.shares) < 0.001
      const actualSharesToSell = isSellingAll ? position.shares : sharesToSell

      console.log("[v0] MyBetsPage: Handling sell shares", {
        originalSharesToSell: sharesToSell,
        positionShares: position.shares,
        isSellingAll,
        actualSharesToSell,
      })

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
        positionId,
        actualSharesToSell,
        sellCalculation.grossValue,
        position.market.id,
        user.id,
        newQy,
        newQn,
        position.market.total_volume,
        newYesShares,
        newNoShares,
        newLiquidityPool,
        sellCalculation.feeAmount,
        sellCalculation.netValue,
      )

      if (result.success) {
        await loadBets()
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

      await loadCreatedMarkets()
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

      await loadCreatedMarkets()
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
                ? 0.0 // Cancelled markets have no value
                : getCurrentSharePrice(position.market.qy || 0, position.market.qn || 0, position.side)

          const currentValue = isCancelled ? 0 : position.shares * currentSharePrice
          const pnl = isCancelled ? 0 : currentValue - position.amount_invested
          const pnlPerShare = isCancelled ? 0 : currentSharePrice - position.avg_price

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
                      <span className="font-semibold text-xs md:text-base">{position.side ? "YES" : "NO"}</span>
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">
                      {position.shares.toFixed(2)} shares @ ${position.avg_price.toFixed(3)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 pt-2 md:pt-4 border-t">
                  <div>
                    <div className="text-xs md:text-sm text-muted-foreground">Invested</div>
                    <div className="font-semibold text-xs md:text-base">${position.amount_invested.toFixed(2)}</div>
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

  const renderPrivateBets = (markets: PrivateMarket[], isProposed = false) => {
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
                    <div className="font-semibold text-xs md:text-base">${market.total_volume.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs md:text-sm text-muted-foreground">Fees Earned</div>
                    <div className="font-semibold text-xs md:text-base text-green-600">
                      ${market.cumulative_creator_fees.toFixed(2)}
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

  const addCreatorProfilesToPositions = async (positions: any[], supabase: any) => {
    if (!positions || positions.length === 0) return []

    const creatorIds = [...new Set(positions.map((p) => p.market?.creator_id).filter(Boolean))]

    if (creatorIds.length === 0) return positions

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", creatorIds)

    if (error) {
      console.error("[v0] Error fetching creator profiles for positions:", error)
      return positions.map((position) => ({
        ...position,
        market: {
          ...position.market,
          creator: { username: "Unknown", display_name: "Unknown User" },
        },
      }))
    }

    return positions.map((position) => {
      const creator = profiles?.find((p) => p.id === position.market?.creator_id)
      return {
        ...position,
        market: {
          ...position.market,
          creator: creator || { username: "Unknown", display_name: "Unknown User" },
        },
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading your bets...</p>
        </div>
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
            <TabsTrigger
              value="historical"
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4 border border-border md:border-0 shadow-sm md:shadow-none"
            >
              <History className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Historical</span>
              <span className="sm:hidden">History</span>
              <span className="ml-0.5">({historicalPositions.length})</span>
            </TabsTrigger>
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
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {renderPositions(activePositions, false)}
          </TabsContent>

          <TabsContent value="historical" className="mt-6">
            {renderPositions(historicalPositions, true)}
          </TabsContent>

          <TabsContent value="private-markets" className="mt-6">
            {renderPrivateBets(proposedToMe, false)}
          </TabsContent>

          <TabsContent value="my-markets" className="mt-6">
            {renderCreatedMarkets(createdMarkets)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
