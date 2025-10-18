import { createClient } from "@/lib/supabase/server"
import { select } from "@/lib/database/adapter"
import { MarketCard } from "@/components/market-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Plus, Shield, LogOut, User, Wallet, BarChart } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth/admin"
import { NotificationBell } from "@/components/notifications"

export default async function HomePage() {
  const supabase = await createClient()

  console.log("[v0] HomePage: Starting authentication check")

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log("[v0] HomePage: User check result:", user ? `User ID: ${user.id}` : "No user")

  if (!user) {
    console.log("[v0] HomePage: No user found, redirecting to login")
    redirect("/auth/login")
  }

  console.log("[v0] HomePage: Fetching existing profile for user:", user.id)
  let profile = null
  let profileError = null

  try {
    const profileData = await select("profiles", "*", [{ column: "id", value: user.id }])

    profile = profileData?.[0] || null
    console.log("[v0] HomePage: Profile fetch result:", { profile })
  } catch (error) {
    console.log("[v0] HomePage: Profile fetch failed with error:", error)
    profileError = error
  }

  if (
    profileError &&
    ((profileError as any).code === "PGRST116" ||
      ((profileError as any).message && (profileError as any).message.includes("No rows")))
  ) {
    console.log("[v0] HomePage: No profile found for user, redirecting to profile setup")
    redirect("/profile/setup")
  }

  if (profileError && !profile) {
    console.log("[v0] HomePage: Profile fetch failed with error:", profileError)

    // If it's an RLS error, show a proper error message instead of creating fake data
    if ((profileError as any).code === "42P17") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Database Configuration Error</h1>
            <p className="text-gray-600 mb-4">There's an issue with the database policies. Please contact support.</p>
            <p className="text-sm text-gray-500">Error: {(profileError as any).message || "Unknown error"}</p>
          </div>
        </div>
      )
    }

    // For other errors, redirect to profile setup
    redirect("/profile/setup")
  }

  if (!profile) {
    console.log("[v0] HomePage: No profile data available")
    redirect("/profile/setup")
  }

  // Check if user is admin with better error handling
  console.log("[v0] HomePage: Checking admin status")
  let userIsAdmin = false
  try {
    userIsAdmin = await isAdmin()
    console.log("[v0] HomePage: Admin check result:", userIsAdmin)
  } catch (error) {
    console.log("[v0] HomePage: Admin check failed, defaulting to false:", error)
    userIsAdmin = false
  }

  let markets = []
  const marketsError = null
  try {
    const marketsData = await select(
      "markets",
      "*, settled_at, winning_side",
      [
        { column: "is_private", operator: "eq", value: false },
        { column: "status", operator: "not.in", value: "(settled,cancelled,closed)" },
      ],
      { column: "created_at", ascending: false },
      12,
    )

    markets = marketsData || []
  } catch (error) {
    console.log("[v0] HomePage: Markets fetch failed:", error)
    markets = []
  }

  let totalVolume = 0
  try {
    const stats = await select("markets", "total_volume", [
      { column: "status", operator: "not.in", value: "(settled,cancelled)" },
    ])
    totalVolume = stats?.reduce((sum, market) => sum + market.total_volume, 0) || 0
  } catch (error) {
    console.log("[v0] HomePage: Stats fetch failed:", error)
    totalVolume = 0
  }

  const activeMarkets = markets?.length || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
              <h1 className="hidden md:block text-lg md:text-2xl font-bold text-blue-900 dark:text-blue-100">
                WannaBet
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
                Beta
              </Badge>
            </div>

            <nav className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/markets">Browse Markets</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/profile">Profile</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/my-bets">My Bets</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/wallet">Wallet</Link>
              </Button>
              <NotificationBell />
              {userIsAdmin && (
                <Button variant="ghost" asChild className="text-blue-600 hover:text-blue-700">
                  <Link href="/admin" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/create-market">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Market
                </Link>
              </Button>
              <form action="/auth/logout" method="post">
                <Button variant="outline" type="submit" className="flex items-center gap-2 bg-transparent">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </form>
            </nav>

            <nav className="flex md:hidden items-center justify-evenly flex-1 gap-1">
              <Button variant="ghost" asChild size="sm">
                <Link href="/markets" className="px-2">
                  <TrendingUp className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="ghost" asChild size="sm">
                <Link href="/my-bets" className="px-2">
                  <BarChart className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="ghost" asChild size="sm">
                <Link href="/wallet" className="px-2">
                  <Wallet className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="ghost" asChild size="sm">
                <Link href="/profile" className="px-2">
                  <User className="w-4 h-4" />
                </Link>
              </Button>
              <NotificationBell />
              {userIsAdmin && (
                <Button variant="ghost" asChild size="sm">
                  <Link href="/admin" className="px-2">
                    <Shield className="w-4 h-4" />
                  </Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link href="/create-market" className="px-2">
                  <Plus className="w-3 h-3" />
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="md:hidden mb-8 flex flex-col items-center justify-center">
          <h1
            className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-800 via-indigo-800 to-purple-800 bg-clip-text text-transparent opacity-90 animate-in fade-in duration-1000 drop-shadow-2xl"
            style={{
              filter:
                "drop-shadow(0 10px 25px rgba(59, 130, 246, 0.3)) drop-shadow(0 5px 15px rgba(139, 92, 246, 0.2))",
            }}
          >
            WannaBet
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            Make Markets. Trade Odds. Earn Fees.
          </p>
        </div>

        <div className="hidden md:block mb-6 md:mb-8">
          <h2 className="text-sm md:text-3xl font-medium md:font-bold text-gray-400 md:text-gray-900 dark:text-gray-500 dark:md:text-white mb-2">
            Welcome back, {profile?.display_name || profile?.username || "User"}!
          </h2>
          <p className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
            Make Markets. Trade Odds. Earn Fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card className="overflow-hidden">
            <CardContent className="p-0 md:p-2 flex flex-col items-center justify-center space-y-0.5 md:space-y-2">
              <div className="w-6 h-6 md:w-10 md:h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Wallet className="w-3 h-3 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Your Balance</p>
              <p className="text-xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                ${profile?.balance?.toFixed(2) || "0.00"}
              </p>
            </CardContent>
          </Card>

          <Card className="hidden md:block overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Markets</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeMarkets}</p>
            </CardContent>
          </Card>

          <Card className="hidden md:block overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <BarChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Volume</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">${totalVolume.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Featured Markets */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">Active Markets</h3>
            <Button variant="outline" asChild size="sm" className="text-xs md:text-sm bg-transparent">
              <Link href="/markets">View All</Link>
            </Button>
          </div>

          {markets && markets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Markets</h3>
                <p className="text-muted-foreground text-center mb-4">Be the first to create a prediction market!</p>
                <Button asChild>
                  <Link href="/create-market">Create Market</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
