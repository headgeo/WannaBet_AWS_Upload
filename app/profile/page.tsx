"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, DollarSign, TrendingUp, LogOut } from "lucide-react"
import Link from "next/link"
import GroupsSection from "@/components/groups-section"

interface Profile {
  id: string
  username: string
  display_name: string
  bio: string
  balance: number
  created_at: string
}

interface UserStats {
  totalBets: number
  totalVolume: number
  marketsCreated: number
  winRate: number
  totalFeesEarned: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [username, setUsername] = useState("")
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/auth/login")
        return
      }

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)
      setDisplayName(profileData.display_name || "")
      setBio(profileData.bio || "")
      setUsername(profileData.username || "")

      const [positionsResult, marketsResult, transactionsResult, creatorFeesResult] = await Promise.all([
        supabase.from("positions").select("*").eq("user_id", user.id),
        supabase.from("markets").select("*").eq("creator_id", user.id),
        supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "bet"),
        supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "creator_payout"),
      ])

      const totalBets = positionsResult.data?.length || 0
      const marketsCreated = marketsResult.data?.length || 0
      const totalVolume = transactionsResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0
      const totalFeesEarned = creatorFeesResult.data?.reduce((sum, t) => sum + t.amount, 0) || 0

      setStats({
        totalBets,
        totalVolume,
        marketsCreated,
        winRate: 0, // Would need resolved markets to calculate
        totalFeesEarned,
      })
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const checkUsernameUniqueness = async (newUsername: string) => {
    if (!newUsername || newUsername === profile?.username) {
      setUsernameError(null)
      return true
    }

    setIsCheckingUsername(true)
    setUsernameError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("profiles").select("id").eq("username", newUsername).single()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      if (data) {
        setUsernameError("This username is already taken")
        return false
      }

      return true
    } catch (error: any) {
      setUsernameError("Error checking username availability")
      return false
    } finally {
      setIsCheckingUsername(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    if (username !== profile.username) {
      const isUnique = await checkUsernameUniqueness(username)
      if (!isUnique) return
    }

    setIsSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("profiles")
        .update({
          username: username,
          display_name: displayName,
          bio: bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      if (error) throw error

      setProfile({ ...profile, username: username, display_name: displayName, bio: bio })
      setIsEditing(false)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card>
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground mb-4">Unable to load your profile.</p>
            <Button asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
            <Button variant="outline" onClick={handleSignOut} className="flex items-center gap-2 bg-transparent">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Info and Groups */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEditing ? (
                  <>
                    <div>
                      <Label className="text-sm text-muted-foreground">Username</Label>
                      <div className="font-medium">{profile.username}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Display Name</Label>
                      <div className="font-medium">{profile.display_name || "Not set"}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Bio</Label>
                      <div className="font-medium">{profile.bio || "No bio provided"}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Member Since</Label>
                      <div className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</div>
                    </div>
                    <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value)
                          setUsernameError(null)
                        }}
                        onBlur={() => checkUsernameUniqueness(username)}
                        placeholder="Your unique username"
                        disabled={isCheckingUsername}
                      />
                      {isCheckingUsername && <p className="text-xs text-muted-foreground">Checking availability...</p>}
                      {usernameError && <p className="text-xs text-red-500">{usernameError}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={3}
                      />
                    </div>
                    {error && (
                      <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={isSaving || !!usernameError || isCheckingUsername}>
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <GroupsSection userId={profile.id} />
          </div>

          {/* Stats & Balance */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">${profile.balance.toFixed(2)}</div>
                <p className="text-sm text-muted-foreground mt-1">Available for trading</p>
              </CardContent>
            </Card>

            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Trading Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Bets</span>
                    <span className="font-semibold">{stats.totalBets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume Traded</span>
                    <span className="font-semibold">${stats.totalVolume.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Markets Created</span>
                    <span className="font-semibold">{stats.marketsCreated}</span>
                  </div>
                  <div className="flex justify-between border-t pt-4">
                    <span className="text-muted-foreground">Total Fees Earned</span>
                    <span className="font-semibold text-green-600">${stats.totalFeesEarned.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="default" className="mb-2">
                  Active
                </Badge>
                <p className="text-sm text-muted-foreground">Your account is in good standing</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
