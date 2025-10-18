import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { select, insert } from "@/lib/database/adapter"

export default async function ProfileSetupPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: existingProfile } = await select({
    table: "profiles",
    where: { id: user.id },
    single: true,
  })

  if (existingProfile) {
    redirect("/")
  }

  async function createProfile(formData: FormData) {
    "use server"

    const supabase = await createClient()
    const username = formData.get("username") as string
    const displayName = formData.get("displayName") as string
    const startingBalance = Number.parseFloat(formData.get("startingBalance") as string) || 1000

    const { error } = await insert({
      table: "profiles",
      data: {
        id: user!.id,
        username: username || user!.email?.split("@")[0] || "user",
        display_name: displayName || user!.email?.split("@")[0] || "User",
        balance: startingBalance,
        role: "user",
      },
    })

    if (error) {
      console.error("Profile creation error:", error)
      // Handle error appropriately
    } else {
      redirect("/")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
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
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                name="displayName"
                placeholder="Your display name"
                defaultValue={user.email?.split("@")[0] || ""}
              />
            </div>
            <div>
              <Label htmlFor="startingBalance">Starting Balance ($)</Label>
              <Input
                id="startingBalance"
                name="startingBalance"
                type="number"
                step="0.01"
                min="0"
                defaultValue="1000"
                placeholder="1000.00"
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
