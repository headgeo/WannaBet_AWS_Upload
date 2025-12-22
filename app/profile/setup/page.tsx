import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { select, insert } from "@/lib/database/adapter"

async function createProfile(formData: FormData) {
  "use server"

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const username = formData.get("username") as string
  const displayName = formData.get("displayName") as string

  const { error } = await insert("profiles", {
    id: user.id,
    username: username || user.email?.split("@")[0] || "user",
    display_name: displayName || user.email?.split("@")[0] || "User",
    balance: 0, // All users start with $0 balance
    role: "user",
  })

  if (error) {
    console.error("Profile creation error:", error)
    throw error
  }

  redirect("/")
}

export default async function ProfileSetupPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const existingProfile = await select("profiles", "*", [{ column: "id", value: user.id }])

  if (existingProfile && existingProfile.length > 0) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Complete Your Profile</CardTitle>
          <p className="text-center text-muted-foreground">Set up your profile to start using PredictMarket</p>
        </CardHeader>
        <CardContent>
          <form action={createProfile} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder={user.email?.split("@")[0] || "username"}
                defaultValue={user.email?.split("@")[0] || ""}
                required
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                name="displayName"
                placeholder="Your display name"
                defaultValue={user.email?.split("@")[0] || ""}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Create Profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
