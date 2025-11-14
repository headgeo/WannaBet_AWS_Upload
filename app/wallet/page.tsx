import { WalletClient } from "./wallet-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from 'next/navigation'
import { select } from "@/lib/database/adapter"

export default async function WalletPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const profiles = await select("profiles", "*", [{ column: "id", value: user.id }])
  const profile = profiles && profiles.length > 0 ? profiles[0] : null

  if (!profile) {
    redirect("/profile/setup")
  }

  return <WalletClient initialBalance={Number(profile.balance)} />
}
