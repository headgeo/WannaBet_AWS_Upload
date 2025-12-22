import { redirect } from "next/navigation"
import { getMyBetsData } from "./actions"
import MyBetsClient from "./my-bets-client"
import UnifiedHeader from "@/components/unified-header"
import { isAdmin } from "@/lib/auth/admin"

export const revalidate = 300 // 5 minutes (increased from 30 seconds)

export default async function MyBetsPage() {
  const { user, positions, createdMarkets, privateMarkets, pnlHistory, bonds, error } = await getMyBetsData()

  if (!user) {
    redirect("/auth/login")
  }

  let userIsAdmin = false
  try {
    userIsAdmin = await isAdmin(user.id)
  } catch {
    userIsAdmin = false
  }

  return (
    <>
      <UnifiedHeader userId={user.id} userIsAdmin={userIsAdmin} />
      <MyBetsClient
        userId={user.id}
        activePositions={positions}
        proposedToMe={privateMarkets}
        createdMarkets={createdMarkets}
        pnlHistory={pnlHistory}
        initialError={error}
        bonds={bonds}
      />
    </>
  )
}
