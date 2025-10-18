export type MarketStatus = "active" | "expired" | "settled" | "cancelled" | "closed"

export interface MarketWithStatus {
  id: string
  title: string
  description: string
  end_date: string
  status: MarketStatus
  settled_at?: string | null
  winning_side?: boolean | null
  outcome?: boolean | null
}

export function getMarketStatus(market: MarketWithStatus): MarketStatus {
  // If market is already settled
  if (market.status === "settled" || market.settled_at) {
    return "settled"
  }

  // Handle cancelled markets
  if (market.outcome === null && (market.status === "cancelled" || market.status === "closed")) {
    return market.status
  }

  // Check if market has expired based on end_date
  const endDate = new Date(market.end_date)
  const now = new Date()

  if (endDate < now) {
    return "expired"
  }

  return "active"
}

export function canTrade(market: MarketWithStatus): boolean {
  const status = getMarketStatus(market)
  return status === "active"
}

export function isExpired(market: MarketWithStatus): boolean {
  const status = getMarketStatus(market)
  return status === "expired"
}

export function isSettled(market: MarketWithStatus): boolean {
  const status = getMarketStatus(market)
  return status === "settled"
}

export function isCancelled(market: MarketWithStatus): boolean {
  const status = getMarketStatus(market)
  return status === "cancelled"
}

export function isClosed(market: MarketWithStatus): boolean {
  const status = getMarketStatus(market)
  return status === "closed"
}

export function getMarketStatusDisplay(market: MarketWithStatus): {
  status: MarketStatus
  label: string
  color: "default" | "secondary" | "destructive" | "outline"
} {
  const status = getMarketStatus(market)

  switch (status) {
    case "active":
      return {
        status: "active",
        label: "Active",
        color: "default",
      }
    case "expired":
      return {
        status: "expired",
        label: "Expired - Awaiting Settlement",
        color: "secondary",
      }
    case "settled":
      const winningSide = market.winning_side !== undefined ? (market.winning_side ? "YES" : "NO") : "Unknown"
      return {
        status: "settled",
        label: `Settled - ${winningSide} Won`,
        color: "outline",
      }
    case "cancelled":
      return {
        status: "cancelled",
        label: "Cancelled",
        color: "outline",
      }
    case "closed":
      return {
        status: "closed",
        label: "Closed",
        color: "outline",
      }
  }
}

export function getDaysUntilExpiration(market: MarketWithStatus): number {
  const endDate = new Date(market.end_date)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}
