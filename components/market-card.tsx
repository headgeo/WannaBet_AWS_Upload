"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Clock, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { calculateLMSRProbability, calculateBFromLiquidity, DEFAULT_LIQUIDITY_AMOUNT } from "@/lib/lmsr"
import { getMarketStatusDisplay, canTrade, getDaysUntilExpiration } from "@/lib/market-status"
import { cn } from "@/lib/utils"

interface Market {
  id: string
  title: string
  description: string
  category: string
  end_date: string
  total_volume: number
  yes_shares: number
  no_shares: number
  status: string
  settled_at?: string
  winning_side?: boolean
  outcome?: boolean
  qy?: number
  qn?: number
  b?: number
  liquidity_pool?: number
  yes_liquidity?: number
  no_liquidity?: number
  is_private?: boolean
  creator?: {
    username: string
    display_name: string
  }
}

interface MarketCardProps {
  market: Market
}

export function MarketCard({ market }: MarketCardProps) {
  let yesPercentage: number
  let noPercentage: number

  if (market.qy !== undefined && market.qn !== undefined) {
    const liquidityAmount = market.liquidity_pool || DEFAULT_LIQUIDITY_AMOUNT
    const b = market.b || calculateBFromLiquidity(liquidityAmount)
    const yesProbability = calculateLMSRProbability(market.qy, market.qn, b)
    yesPercentage = yesProbability * 100
    noPercentage = (1 - yesProbability) * 100
  } else if (market.yes_liquidity && market.no_liquidity) {
    const total = market.yes_liquidity + market.no_liquidity
    yesPercentage = (market.yes_liquidity / total) * 100
    noPercentage = (market.no_liquidity / total) * 100
  } else {
    const totalShares = market.yes_shares + market.no_shares
    yesPercentage = totalShares > 0 ? (market.yes_shares / totalShares) * 100 : 50
    noPercentage = 100 - yesPercentage
  }

  const statusInfo = getMarketStatusDisplay(market)
  const tradingAllowed = canTrade(market)
  const daysLeft = getDaysUntilExpiration(market)
  const router = useRouter()

  const handleCardClick = (e: React.MouseEvent) => {
    if (window.innerWidth < 768 && !(e.target as HTMLElement).closest("button")) {
      router.push(`/market/${market.id}`)
    }
  }

  return (
    <Card
      className={cn(
        "h-full flex flex-col bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800",
        "shadow-sm hover:shadow-lg transition-all duration-200 md:cursor-default cursor-pointer",
        !tradingAllowed && "opacity-60",
        market.is_private && "ring-1 ring-gray-200 dark:ring-gray-700",
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2 px-4 py-3 md:px-5 md:py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm md:text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 break-words">
              {market.title}
            </CardTitle>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="secondary"
            className="text-[10px] md:text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-normal"
          >
            {market.category}
          </Badge>
          {market.is_private && (
            <Badge variant="outline" className="text-[10px] md:text-[10px] px-1.5 py-0 font-normal">
              Private
            </Badge>
          )}
          <Badge
            variant={statusInfo.color}
            className={cn(
              "text-[10px] md:text-[10px] flex items-center gap-0.5 px-1.5 py-0 font-normal",
              statusInfo.status === "active" && "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
            )}
          >
            <Clock className="w-3 h-3 md:w-3 md:h-3" />
            {statusInfo.status === "active" ? `${daysLeft}d left` : statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-4 pb-3 md:px-5 md:pb-4 flex-1 flex flex-col">
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-xs md:text-xs font-medium text-gray-700 dark:text-gray-300">YES</span>
            </div>
            <span className="text-xs md:text-xs font-bold text-green-600 dark:text-green-400">
              {yesPercentage.toFixed(1)}%
            </span>
          </div>

          <Progress value={yesPercentage} className="h-1.5 md:h-2 bg-gray-100 dark:bg-gray-800" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3 text-red-500" />
              <span className="text-xs md:text-xs font-medium text-gray-700 dark:text-gray-300">NO</span>
            </div>
            <span className="text-xs md:text-xs font-bold text-red-600 dark:text-red-400">
              {noPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] md:text-[10px] text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            <span>${Number.parseFloat(market.total_volume.toString()).toFixed(2)}</span>
          </div>
          <span className="truncate ml-2">
            {market.creator?.display_name || market.creator?.username || "Anonymous"}
          </span>
        </div>

        <Button
          asChild
          className={cn(
            "hidden md:flex w-full text-[10px] h-8 mt-auto font-medium",
            tradingAllowed
              ? "bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500",
          )}
          disabled={!tradingAllowed}
        >
          <Link href={`/market/${market.id}`}>
            {statusInfo.status === "settled"
              ? "View Results"
              : statusInfo.status === "expired"
                ? "View Market"
                : "Trade Now"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
