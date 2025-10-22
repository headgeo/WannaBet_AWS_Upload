import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth/admin"
import HomePage from "@/components/home-page-client"

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user has profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

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
