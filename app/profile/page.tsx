import { redirect } from "next/navigation"
import { getProfileData } from "./actions"
import ProfileClient from "./profile-client"

export default async function ProfilePage() {
  const { user, profile, stats, error } = await getProfileData()

  if (!user) {
    redirect("/auth/login")
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground">{error || "Unable to load your profile."}</p>
        </div>
      </div>
    )
  }

  return <ProfileClient profile={profile} stats={stats} initialError={error} />
}
