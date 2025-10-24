import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth/admin"
import HomePage from "@/components/home-page-client"
import { select } from "@/lib/database/adapter"

export const revalidate = 300 // 5 minutes (increased from 30 seconds)

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const profileData = await select("profiles", "*", [{ column: "id", operator: "eq", value: user.id }])
  const profile = profileData?.[0]

  if (!profile) {
    redirect("/profile/setup")
  }

  // Check admin status
  let userIsAdmin = false
  try {
    userIsAdmin = await isAdmin()
  } catch (error) {
    userIsAdmin = false
  }

  return <HomePage userId={user.id} userIsAdmin={userIsAdmin} initialProfile={profile} />
}
