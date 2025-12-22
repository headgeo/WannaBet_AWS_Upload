import { WalletClient } from "./wallet-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { select } from "@/lib/database/adapter"
import UnifiedHeader from "@/components/unified-header"
import { isAdmin } from "@/lib/auth/admin"

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

  const userIsAdmin = await isAdmin()

  return (
    <>
      <UnifiedHeader userId={user.id} userIsAdmin={userIsAdmin} showModeToggle={false} />
      <WalletClient initialBalance={Number(profile.balance)} />
    </>
  )
}
