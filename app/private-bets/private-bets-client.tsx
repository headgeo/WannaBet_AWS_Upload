"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Users, Clock } from "lucide-react"
import Link from "next/link"
import type { PrivateMarket } from "./actions"

interface PrivateBetsClientProps {
  myActive: PrivateMarket[]
  initialError: string | null
}

export default function PrivateBetsClient({ myActive: initialMyActive, initialError }: PrivateBetsClientProps) {
  const [myActive] = useState(initialMyActive)
  const [error] = useState<string | null>(initialError)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4 hidden md:flex">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Private Bets</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your private prediction markets</p>
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
              Pending Invitations (0)
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
