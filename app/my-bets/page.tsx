import { redirect } from "next/navigation"
import { getMyBetsData } from "./actions"
import MyBetsClient from "./my-bets-client"

export default async function MyBetsPage() {
  const { user, positions, createdMarkets, privateMarkets, error } = await getMyBetsData()

  if (!user) {
    redirect("/auth/login")
  }

  // Separate active and historical positions
  const activePositions = positions.filter(
    (p) => p.shares > 0.01 && p.market.outcome === null && p.market.status !== "cancelled",
  )

  const historicalPositions = positions.filter(
    (p) => p.shares <= 0.01 || p.market.outcome !== null || p.market.status === "cancelled",
  )

  return (
    <MyBetsClient
      activePositions={activePositions}
      historicalPositions={historicalPositions}
      proposedToMe={privateMarkets}
      createdMarkets={createdMarkets}
      initialError={error}
    />
  )
}
