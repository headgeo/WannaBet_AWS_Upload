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
import { MobileHeader } from "@/components/mobile-header"

interface Market {
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
  "Private Markets",
  "Other",
]

export function MarketsClient({ initialMarkets, error }: MarketsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [sortBy, setSortBy] = useState("newest")
  const router = useRouter()

  const filteredMarkets = useMemo(() => {
    let filtered = initialMarkets

    if (selectedCategory === "Private Markets") {
      filtered = filtered.filter((market) => market.is_private)
    } else if (selectedCategory !== "All Categories") {
      filtered = filtered.filter((market) => market.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

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
      <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="shadow-sm border-gray-100">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => router.refresh()} className="bg-gray-900 hover:bg-gray-800 text-white">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800 pb-20 md:pb-0">
      <MobileHeader />

      <header className="hidden md:block bg-white dark:bg-gray-900 border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden md:flex text-xs text-gray-600 hover:text-gray-900"
              >
                <Link href="/">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Back
                </Link>
              </Button>
              <h1 className="hidden md:block text-base font-semibold text-gray-900 dark:text-gray-100">
                Browse Markets
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] bg-gray-100 text-gray-600">
                {filteredMarkets.length} markets
              </Badge>
            </div>

            <div className="hidden md:flex items-center space-x-3">
              <Link href="/" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                Home
              </Link>
              <Link href="/markets" className="text-xs text-blue-600 font-medium">
                Browse
              </Link>
              <Link href="/my-bets" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                My Bets
              </Link>
              <NotificationBell />
              <Button asChild size="sm" className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white">
                <Link href="/create-market">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Browse Markets</h1>

        {/* Search and Filter Section */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-3">
            {/* Search Bar - Full Width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 text-sm bg-white border-gray-200"
              />
            </div>

            {/* Category Filter and Sort Options - Side by Side */}
            <div className="flex gap-3">
              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="flex-1 text-xs h-9 bg-white border-gray-200">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category} className="text-xs">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort Options */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 text-xs h-9 bg-white border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest" className="text-xs">
                    Newest
                  </SelectItem>
                  <SelectItem value="oldest" className="text-xs">
                    Oldest
                  </SelectItem>
                  <SelectItem value="volume" className="text-xs">
                    Highest Volume
                  </SelectItem>
                  <SelectItem value="ending_soon" className="text-xs">
                    Ending Soon
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || selectedCategory !== "All Categories") && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 text-[10px] bg-gray-100">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="ml-1 hover:bg-gray-200 rounded-full p-0.5">
                    ×
                  </button>
                </Badge>
              )}
              {selectedCategory !== "All Categories" && (
                <Badge variant="secondary" className="gap-1 text-[10px] bg-gray-100">
                  Category: {selectedCategory}
                  <button
                    onClick={() => setSelectedCategory("All Categories")}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
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
                className="text-[10px] h-6 text-gray-500 hover:text-gray-900"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Markets Grid */}
        {filteredMarkets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <Card className="shadow-sm border-gray-100">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <TrendingUp className="h-10 w-10 text-gray-300 mb-3" />
              <h3 className="text-sm font-semibold mb-1 text-gray-900">
                {searchQuery || selectedCategory !== "All Categories" ? "No markets found" : "No active markets"}
              </h3>
              <p className="text-xs text-gray-500 text-center mb-3">
                {searchQuery || selectedCategory !== "All Categories"
                  ? "Try adjusting your search criteria or browse all categories."
                  : "Be the first to create a prediction market!"}
              </p>
              {searchQuery || selectedCategory !== "All Categories" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 bg-transparent"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory("All Categories")
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button asChild size="sm" className="text-xs h-8 bg-gray-900 hover:bg-gray-800 text-white">
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
