"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Clock, Users } from 'lucide-react'
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { calculateLMSRProbability, calculateBFromLiquidity, DEFAULT_LIQUIDITY_AMOUNT } from "@/lib/lmsr"
import { getMarketStatusDisplay, canTrade, getDaysUntilExpiration } from "@/lib/market-status"

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

    // Use LMSR probability calculation
    const yesProbability = calculateLMSRProbability(market.qy, market.qn, b)
    yesPercentage = yesProbability * 100
    noPercentage = (1 - yesProbability) * 100
  } else if (market.yes_liquidity && market.no_liquidity) {
    // Fallback to old liquidity-based calculation
    const total = market.yes_liquidity + market.no_liquidity
    yesPercentage = (market.yes_liquidity / total) * 100
    noPercentage = (market.no_liquidity / total) * 100
  } else {
    // Final fallback to share-based calculation
    const totalShares = market.yes_shares + market.no_shares
    yesPercentage = totalShares > 0 ? (market.yes_shares / totalShares) * 100 : 50
    noPercentage = 100 - yesPercentage
  }

  const statusInfo = getMarketStatusDisplay(market)
  const tradingAllowed = canTrade(market)
  const daysLeft = getDaysUntilExpiration(market)
  const router = useRouter()

  const handleCardClick = (e: React.MouseEvent) => {
    // Only navigate on mobile when clicking the card itself (not the button)
    if (window.innerWidth < 768 && !(e.target as HTMLElement).closest("button")) {
      router.push(`/market/${market.id}`)
    }
  }

  return (
    <Card
      className={`h-full flex flex-col hover:shadow-lg transition-shadow duration-200 md:cursor-default cursor-pointer ${!tradingAllowed ? "opacity-75" : ""} ${market.is_private ? "border-2 border-gray-400 dark:border-gray-600" : ""}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-1 md:pb-2 px-3 py-2 md:px-5 md:py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm md:text-base mb-1.5 md:mb-2 line-clamp-2 break-words">{market.title}</CardTitle>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] md:text-xs px-1 py-0">
            {market.category}
          </Badge>
          {market.is_private && (
            <Badge variant="outline" className="text-[10px] md:text-xs px-1 py-0">
              Private
            </Badge>
          )}
          <Badge variant={statusInfo.color} className="text-[10px] md:text-xs flex items-center gap-0.5 px-1 py-0">
            <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
            {statusInfo.status === "active" ? `${daysLeft}d left` : statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-3 pb-2 md:px-5 md:pb-3 flex-1 flex flex-col">
        <div className="space-y-1 md:space-y-2 mb-2 md:mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 md:gap-2">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
              <span className="text-xs md:text-sm font-medium">YES</span>
            </div>
            <span className="text-xs md:text-sm font-bold text-green-600">{yesPercentage.toFixed(1)}%</span>
          </div>

          <Progress value={yesPercentage} className="h-1.5 md:h-2" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 md:gap-2">
              <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-red-600" />
              <span className="text-xs md:text-sm font-medium">NO</span>
            </div>
            <span className="text-xs md:text-sm font-bold text-red-600">{noPercentage.toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3">
          <div className="flex items-center gap-0.5 md:gap-1">
            <Users className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span>Volume: ${Number.parseFloat(market.total_volume.toString()).toFixed(2)}</span>
          </div>
          <span className="truncate ml-2">
            by {market.creator?.display_name || market.creator?.username || "Anonymous"}
          </span>
        </div>

        <Button asChild className="hidden md:flex w-full text-xs h-8 mt-auto" disabled={!tradingAllowed}>
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
