"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { User, DollarSign, TrendingUp, LogOut, ArrowLeft, Settings, Lock, Unlock } from "lucide-react"
import GroupsSection from "@/components/groups-section"
import Link from "next/link"
import { MobileHeader } from "@/components/mobile-header"
import type { Profile, UserStats } from "./actions"
import { Slider } from "@/components/ui/slider"
import { updateSlippageTolerance } from "@/app/actions/profile"

interface ProfileClientProps {
  profile: Profile
  stats: UserStats | null
  initialError: string | null
}

export default function ProfileClient({ profile: initialProfile, stats, initialError }: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(initialProfile.display_name || "")
  const [bio, setBio] = useState(initialProfile.bio || "")
  const [username, setUsername] = useState(initialProfile.username || "")
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const router = useRouter()

  const [slippageTolerance, setSlippageTolerance] = useState<number>(() => {
    const val = (initialProfile as any).slippage_tolerance
    const parsed = Number(val)
    return isNaN(parsed) ? 5 : parsed
  })
  const [isSlippageLocked, setIsSlippageLocked] = useState(true)
  const [isSavingSlippage, setIsSavingSlippage] = useState(false)

  const checkUsernameUniqueness = async (newUsername: string) => {
    if (!newUsername || newUsername === profile.username) {
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
      router.refresh()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("[v0] Signout error:", error)
        setError("Failed to sign out. Please try again.")
        return
      }

      // Force a hard navigation to clear all state
      window.location.href = "/auth/login"
    } catch (err) {
      console.error("[v0] Signout exception:", err)
      setError("Failed to sign out. Please try again.")
    }
  }

  const handleSaveSlippage = async () => {
    setIsSavingSlippage(true)
    setError(null)
    try {
      const result = await updateSlippageTolerance(slippageTolerance)

      if (!result.success) {
        throw new Error(result.error || "Failed to save slippage tolerance")
      }

      setIsSlippageLocked(true)
      router.refresh()
    } catch (error: any) {
      console.error("[v0] Error saving slippage:", error)
      setError(error.message)
    } finally {
      setIsSavingSlippage(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800 pb-20 md:pb-0">
      <MobileHeader />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-3 hidden md:block">
          <Button variant="ghost" asChild className="w-fit text-xs">
            <Link href="/">
              <ArrowLeft className="w-3 h-3 mr-1" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="flex items-center gap-1 bg-transparent text-xs h-8"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isEditing ? (
                  <>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</Label>
                      <div className="text-sm font-medium">{profile.username}</div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Display Name</Label>
                      <div className="text-sm font-medium">{profile.display_name || "Not set"}</div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Bio</Label>
                      <div className="text-sm font-medium">{profile.bio || "No bio provided"}</div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Member Since</Label>
                      <div className="text-sm font-medium">
                        {new Date(profile.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-gray-900 hover:bg-gray-800 text-white text-xs h-8"
                    >
                      Edit Profile
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="username" className="text-xs">
                        Username
                      </Label>
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
                        className="text-sm h-9"
                      />
                      {isCheckingUsername && (
                        <p className="text-[10px] text-muted-foreground">Checking availability...</p>
                      )}
                      {usernameError && <p className="text-[10px] text-red-500">{usernameError}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="displayName" className="text-xs">
                        Display Name
                      </Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                        className="text-sm h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bio" className="text-xs">
                        Bio
                      </Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    {error && (
                      <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        disabled={isSaving || !!usernameError || isCheckingUsername}
                        className="bg-gray-900 hover:bg-gray-800 text-white text-xs h-8"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)} className="text-xs h-8">
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <GroupsSection userId={profile.id} />

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="w-4 h-4" />
                  Trading Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="slippage" className="text-xs">
                      Slippage Tolerance
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!isSlippageLocked) {
                          handleSaveSlippage()
                        } else {
                          setIsSlippageLocked(false)
                        }
                      }}
                      disabled={isSavingSlippage}
                      className="text-xs h-7"
                    >
                      {isSlippageLocked ? (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          Unlock to Edit
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3 mr-1" />
                          {isSavingSlippage ? "Saving..." : "Save & Lock"}
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Maximum price change allowed between quote and execution.
                  </p>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="slippage"
                      min={0.5}
                      max={30}
                      step={0.5}
                      value={[slippageTolerance]}
                      onValueChange={(value) => setSlippageTolerance(value[0])}
                      disabled={isSlippageLocked}
                      className="flex-1"
                    />
                    <div className="w-14 text-right text-sm font-semibold">{slippageTolerance.toFixed(1)}%</div>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.5% (Strict)</span>
                    <span>30% (Lenient)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="w-4 h-4" />
                  Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${Number.parseFloat(profile.balance.toString()).toFixed(2)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Available for trading</p>
              </CardContent>
            </Card>

            {stats && (
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-4 h-4" />
                    Trading Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Bets</span>
                    <span className="font-semibold">{stats.totalBets}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Markets Created</span>
                    <span className="font-semibold">{stats.marketsCreated}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-xs">
                    <span className="text-muted-foreground">Total Fees Earned</span>
                    <span className="font-semibold text-green-600">
                      ${Number.parseFloat(stats.totalFeesEarned.toString()).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Account Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="default" className="mb-2 text-[10px]">
                  Active
                </Badge>
                <p className="text-[10px] text-muted-foreground">Your account is in good standing</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
