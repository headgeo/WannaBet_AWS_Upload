import { redirect } from "next/navigation"
import { getProfileData } from "./actions"
import ProfileClient from "./profile-client"
import UnifiedHeader from "@/components/unified-header"
import { isAdmin } from "@/lib/auth/admin"

export default async function ProfilePage() {
  const { user, profile, stats, error } = await getProfileData()

  if (!user) {
    redirect("/auth/login")
  }

  let userIsAdmin = false
  try {
    userIsAdmin = await isAdmin(user.id)
  } catch {
    userIsAdmin = false
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground">{error || "Unable to load your profile."}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <UnifiedHeader userId={user.id} userIsAdmin={userIsAdmin} />
      <ProfileClient profile={profile} stats={stats} initialError={error} />
    </>
  )
}
