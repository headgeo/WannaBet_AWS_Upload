"use client"

import { useState, useMemo } from "react"
import { MarketCard } from "@/components/market-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, TrendingUp, Plus, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { NotificationBell } from "@/components/notifications"

export interface Market {
  id: string
  title: string
  description: string
  category: string
  status: string
  is_private: boolean
  yes_shares: number
  no_shares: number
  total_volume: number
  yes_liquidity: number
  no_liquidity: number
  end_date: string
  created_at: string
}

interface MarketsClientProps {
  initialMarkets: Market[]
  error: string | null
}

const CATEGORIES = [
  "All Categories",
  "Sports",
  "Politics",
  "Technology",
  "Entertainment",
  "Business",
  "Science",
  "Crypto",
  "Weather",
  "Other",
]

export function MarketsClient({ initialMarkets, error }: MarketsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [sortBy, setSortBy] = useState("newest")
  const router = useRouter()

  const filteredMarkets = useMemo(() => {
    let filtered = initialMarkets

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (market) =>
          market.title.toLowerCase().includes(query) ||
          market.description?.toLowerCase().includes(query) ||
          market.category?.toLowerCase().includes(query),
      )
    }

    // Filter by category
    if (selectedCategory !== "All Categories") {
      filtered = filtered.filter((market) => market.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

    // Sort markets
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case "oldest":
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case "volume":
        filtered.sort((a, b) => b.total_volume - a.total_volume)
        break
      case "ending_soon":
        filtered.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
        break
    }

    return filtered
  }, [initialMarkets, searchQuery, selectedCategory, sortBy])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => router.refresh()}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="hidden md:block text-2xl font-bold text-blue-900 dark:text-blue-100">Browse Markets</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {filteredMarkets.length} markets
              </Badge>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild className="hidden md:inline-flex">
                <Link href="/">Home</Link>
              </Button>
              <NotificationBell />
              <Button asChild className="hidden md:inline-flex">
                <Link href="/create-market">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Market
                </Link>
              </Button>
              <Button asChild size="sm" className="md:hidden">
                <Link href="/create-market" className="px-2">
                  <Plus className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100 mb-6">Browse Markets</h1>

        {/* Search and Filter Section */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4">
            {/* Search Bar - Full Width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter and Sort Options - Side by Side */}
            <div className="flex gap-4">
              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="flex-1 text-xs md:text-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category} className="text-xs md:text-sm">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort Options */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 text-xs md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest" className="text-xs md:text-sm">
                    Newest
                  </SelectItem>
                  <SelectItem value="oldest" className="text-xs md:text-sm">
                    Oldest
                  </SelectItem>
                  <SelectItem value="volume" className="text-xs md:text-sm">
                    Highest Volume
                  </SelectItem>
                  <SelectItem value="ending_soon" className="text-xs md:text-sm">
                    Ending Soon
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || selectedCategory !== "All Categories") && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery("")}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {selectedCategory !== "All Categories" && (
                <Badge variant="secondary" className="gap-1">
                  Category: {selectedCategory}
                  <button
                    onClick={() => setSelectedCategory("All Categories")}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("All Categories")
                }}
                className="text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Markets Grid */}
        {filteredMarkets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || selectedCategory !== "All Categories" ? "No markets found" : "No active markets"}
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || selectedCategory !== "All Categories"
                  ? "Try adjusting your search criteria or browse all categories."
                  : "Be the first to create a prediction market!"}
              </p>
              {searchQuery || selectedCategory !== "All Categories" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory("All Categories")
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/create-market">Create Market</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
