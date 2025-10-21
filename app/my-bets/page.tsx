import { redirect } from "next/navigation"
import { getMyBetsData } from "./actions"
import MyBetsClient from "./my-bets-client"

export default async function MyBetsPage() {
  const { user, positions, createdMarkets, privateMarkets, pnlHistory, error } = await getMyBetsData()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <MyBetsClient
      userId={user.id}
      activePositions={positions}
      proposedToMe={privateMarkets}
      createdMarkets={createdMarkets}
      pnlHistory={pnlHistory}
      initialError={error}
    />
  )
}
