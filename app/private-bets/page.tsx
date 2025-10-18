import { redirect } from "next/navigation"
import { getPrivateBetsData } from "./actions"
import PrivateBetsClient from "./private-bets-client"

export default async function PrivateBetsPage() {
  const { user, myActive, error } = await getPrivateBetsData()

  if (!user) {
    redirect("/auth/login")
  }

  return <PrivateBetsClient myActive={myActive} initialError={error} />
}
