"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Users, Clock } from "lucide-react"
import Link from "next/link"

interface PrivateMarket {
  id: string
  title: string
  description: string
  category: string
  status: string
  end_date: string
  outcome: boolean | null
  creator_id: string
  created_at: string
  creator?: {
    username: string
    display_name: string
  }
  participants?: {
    user_id: string
    status: string
    group_id: string
    user: {
      username: string
      display_name: string
    }
  }[]
}

export default function PrivateBetsPage() {
  const [proposedToMe, setProposedToMe] = useState<PrivateMarket[]>([])
  const [myActive, setMyActive] = useState<PrivateMarket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadPrivateBets()

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPrivateBets()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    const handleFocus = () => {
      loadPrivateBets()
    }

    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  const getUserGroupIds = async (userId: string): Promise<string[]> => {
    const supabase = createClient()
    const { data: userGroups, error } = await supabase.from("user_groups").select("group_id").eq("user_id", userId)

    if (!userGroups || userGroups.length === 0) {
      return []
    }

    return userGroups.map((ug: any) => ug.group_id)
  }

  const loadPrivateBets = async () => {
    try {
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push("/auth/login")
        return
      }

      const userGroupIds = await getUserGroupIds(user.id)

      let privateMarkets = []

      if (userGroupIds.length > 0) {
        const { data: createdMarkets, error: createdError } = await supabase
          .from("markets")
          .select("*, creator:profiles!creator_id(username, display_name)")
          .eq("is_private", true)
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false })

        const { data: groupMarkets, error: groupError } = await supabase
          .from("markets")
          .select("*, creator:profiles!creator_id(username, display_name)")
          .eq("is_private", true)
          .in("group_id", userGroupIds)
          .order("created_at", { ascending: false })

        if (createdError) throw createdError
        if (groupError) throw groupError

        const allMarkets = [...(createdMarkets || []), ...(groupMarkets || [])]
        const uniqueMarkets = allMarkets.filter(
          (market, index, self) => index === self.findIndex((m: any) => m.id === market.id),
        )

        privateMarkets = uniqueMarkets
      } else {
        const { data, error } = await supabase
          .from("markets")
          .select("*, creator:profiles!creator_id(username, display_name)")
          .eq("is_private", true)
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        privateMarkets = data || []
      }

      setProposedToMe([])
      setMyActive(privateMarkets || [])
    } catch (error: any) {
      console.error("Error loading private bets:", error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading private bets...</p>
        </div>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Private Bets</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your private prediction markets</p>
        </div>

        {error && (
          <Card className="mb-6">
            <CardContent className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Pending Invitations ({proposedToMe.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              My Private Markets ({myActive.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Invitations</h3>
                <p className="text-muted-foreground">
                  Private markets now use group-based access. If you're a member of a group, you automatically have
                  access to that group's private markets.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            {myActive.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Private Markets</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a private market for your group or join a group to see private markets.
                  </p>
                  <Button asChild>
                    <Link href="/create-market">Create Private Market</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myActive.map((market) => (
                  <Card key={market.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{market.title}</h3>
                          <p className="text-muted-foreground mb-3">{market.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary">{market.category}</Badge>
                            <Badge variant="outline">Private</Badge>
                            <Badge variant={market.status === "active" ? "default" : "secondary"}>
                              {market.status === "active" ? "Active" : "Pending"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              by {market.creator?.display_name || market.creator?.username || "Unknown"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          Ends: {new Date(market.end_date).toLocaleDateString()}
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/market/${market.id}`}>
                            {market.status === "active" ? "Place Bets" : "View Details"}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
