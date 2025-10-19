"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getUserBalance, createMarket } from "@/app/actions/markets"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ArrowLeft, X, AlertTriangle, User, Users, ChevronDown } from "lucide-react"
import Link from "next/link"
import UserGroupAutocomplete from "@/components/user-group-autocomplete"
import { calculateBFromLiquidity } from "@/lib/lmsr"

const categories = ["Politics", "Sports", "Technology", "Economics", "Entertainment", "Science", "Crypto", "Other"]

interface InvitedItem {
  id: string
  name: string
  type: "user" | "group"
  display_name?: string
}

export default function CreateMarketPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [invitedItems, setInvitedItems] = useState<InvitedItem[]>([])
  const [currentInviteInput, setCurrentInviteInput] = useState("")
  const [liquidityAmount, setLiquidityAmount] = useState("100")
  const [userBalance, setUserBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false)
  const router = useRouter()

  const titleCharLimit = 100
  const descriptionCharLimit = 400
  const isTitleOverLimit = title.length > titleCharLimit
  const isDescriptionOverLimit = description.length > descriptionCharLimit

  useEffect(() => {
    loadUserBalance()
  }, [])

  const loadUserBalance = async () => {
    try {
      const result = await getUserBalance()

      if (result.error) {
        if (result.error === "Not authenticated") {
          router.push("/auth/login")
        }
        return
      }

      setUserBalance(result.balance || 0)
    } catch (error) {
      console.error("Error loading user balance:", error)
    }
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split("T")[0]
  }

  const addInvitedItem = (item: any) => {
    const newItem: InvitedItem = {
      id: item.id,
      name: item.type === "user" ? item.username : item.name,
      type: item.type,
      display_name: item.type === "user" ? item.display_name : item.description,
    }

    if (!invitedItems.find((i) => i.id === newItem.id && i.type === newItem.type)) {
      setInvitedItems([...invitedItems, newItem])
      setCurrentInviteInput("")
    }
  }

  const removeInvitedItem = (id: string, type: "user" | "group") => {
    setInvitedItems(invitedItems.filter((i) => !(i.id === id && i.type === type)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!endDate) {
      setError("Please select an end date")
      return
    }

    if (isPrivate && invitedItems.length === 0) {
      setError("Private markets must have at least one invited participant")
      return
    }

    const liquidityAmountNum = Number.parseFloat(liquidityAmount)
    if (liquidityAmountNum < 50 || liquidityAmountNum > 1000) {
      setError("Liquidity amount must be between $50 and $1000")
      return
    }

    if (liquidityAmountNum > userBalance) {
      setError("Insufficient balance to provide the selected liquidity amount")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await createMarket({
        title,
        description,
        category,
        endDate,
        isPrivate,
        invitedItems,
        liquidityAmount: liquidityAmountNum,
      })

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.success && result.marketId) {
        router.push(`/market/${result.marketId}`)
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const liquidityAmountNum = Number.parseFloat(liquidityAmount) || 0
  const calculatedB = liquidityAmountNum > 0 ? calculateBFromLiquidity(liquidityAmountNum) : 0
  const hasInsufficientBalance = liquidityAmountNum > userBalance

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Market</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Create a prediction market for others to trade on</p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Current Balance</span>
              <span className="text-lg font-semibold text-green-600">${userBalance.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Market Question *</Label>
                <Input
                  id="title"
                  placeholder="Will Bitcoin reach $100,000 by end of 2024?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={isTitleOverLimit ? "border-red-500" : ""}
                  required
                />
                <div className="flex items-center justify-between text-xs">
                  <p className="text-muted-foreground">Ask a clear yes/no question that can be objectively resolved</p>
                  <p className={isTitleOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}>
                    {title.length}/{titleCharLimit}
                  </p>
                </div>
                {isTitleOverLimit && <p className="text-xs text-red-500 font-medium">Too many characters</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide additional context, resolution criteria, and any relevant details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={isDescriptionOverLimit ? "border-red-500" : ""}
                />
                <div className="flex items-center justify-end text-xs">
                  <p className={isDescriptionOverLimit ? "text-red-500 font-medium" : "text-muted-foreground"}>
                    {description.length}/{descriptionCharLimit}
                  </p>
                </div>
                {isDescriptionOverLimit && <p className="text-xs text-red-500 font-medium">Too many characters</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat.toLowerCase()}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={getMinDate()}
                  required
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">When should this market close for trading?</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="liquidityAmount">Initial Liquidity Amount *</Label>
                  <Input
                    id="liquidityAmount"
                    type="number"
                    placeholder="100"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    min="50"
                    max="1000"
                    step="10"
                    required
                    className={hasInsufficientBalance ? "border-red-500" : ""}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Minimum: $50 • Maximum: $1000</span>
                    <span>Available: ${userBalance.toFixed(2)}</span>
                  </div>
                </div>

                <Collapsible open={isDisclosureOpen} onOpenChange={setIsDisclosureOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between p-4 h-auto bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div className="text-left">
                          <div className="font-medium text-amber-800 dark:text-amber-200">Important Disclosures</div>
                          <div className="text-sm text-amber-700 dark:text-amber-300">Click to view terms</div>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-amber-600 transition-transform ${isDisclosureOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-4">
                      <div>
                        <div className="font-medium text-amber-800 dark:text-amber-200 mb-2">Liquidity Provision</div>
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          As the market creator, you are providing ${liquidityAmountNum.toFixed(2)} in initial
                          liquidity. This amount will be deducted from your balance and represents the maximum amount
                          you could lose if the market moves against the initial 50/50 odds. This liquidity enables
                          other users to trade and helps determine the market's pricing dynamics.
                        </div>
                      </div>

                      <div>
                        <div className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                          Platform Terms & Market Resolution
                        </div>
                        <div className="text-sm text-amber-700 dark:text-amber-300 space-y-3">
                          <p>
                            WannaBet provides a decentralized platform for user-generated prediction markets. While we
                            strive to ensure fair and transparent market outcomes, WannaBet does not assume personal
                            liability for the resolution of any market where the terms, conditions, or outcome criteria
                            are insufficiently specific, ambiguous, or too vague to determine a clear and verifiable
                            result.
                          </p>

                          <p>
                            In such cases, WannaBet will employ reasonable research efforts and standard investigative
                            practices—including publicly available data sources, reputable news outlets, and relevant
                            third-party information—to assess the outcome. However, if after applying these methods the
                            result remains indeterminable, WannaBet reserves the right to declare the market
                            unresolvable.
                          </p>

                          <div>
                            <p className="font-medium mb-2">When a market is deemed unresolvable:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li>Initial liquidity posted by users will be forfeited.</li>
                              <li>
                                All transaction fees and unit purchases made within the affected market will be fully
                                refunded.
                              </li>
                              <li>The market will be permanently closed and marked as unresolved.</li>
                            </ul>
                          </div>

                          <div>
                            <p className="font-medium mb-2">
                              By participating in WannaBet markets, users acknowledge and accept that:
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li>The clarity and specificity of market conditions are essential for resolution.</li>
                              <li>
                                WannaBet's role is limited to facilitating the platform and applying reasonable research
                                practices—not arbitrating outcomes in cases of ambiguity.
                              </li>
                              <li>
                                The forfeiture of initial liquidity in unresolved markets is a necessary mechanism to
                                maintain platform integrity and discourage vague market creation. Creators of private
                                markets will recover a portion of the liquidity pool that may be greater of less than
                                the original liquidity they allocated when creating the market.
                              </li>
                            </ul>
                          </div>

                          <p className="font-medium">
                            We encourage all users to define market conditions with precision and clarity to ensure fair
                            and conclusive outcomes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {hasInsufficientBalance && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                    Insufficient balance. You need ${liquidityAmountNum.toFixed(2)} but only have $
                    {userBalance.toFixed(2)} available.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="private" checked={isPrivate} onCheckedChange={setIsPrivate} />
                  <Label htmlFor="private">Private Market</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Private markets are only visible to you and your invited participants
                </p>

                {isPrivate && (
                  <div className="space-y-4">
                    {invitedItems.length > 0 && (
                      <div className="space-y-2">
                        <Label>Invited Participants ({invitedItems.length})</Label>
                        <div className="flex flex-wrap gap-2">
                          {invitedItems.map((item) => (
                            <div
                              key={`${item.type}-${item.id}`}
                              className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/20 px-3 py-1 rounded-full text-sm"
                            >
                              {item.type === "user" ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                              <span>{item.display_name || item.name}</span>
                              <span className="text-xs text-blue-600">({item.type})</span>
                              <button
                                type="button"
                                onClick={() => removeInvitedItem(item.id, item.type)}
                                className="text-red-500 hover:text-red-700"
                                aria-label={`Remove ${item.name} from invited participants`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <UserGroupAutocomplete
                        value={currentInviteInput}
                        onChange={setCurrentInviteInput}
                        onSelect={(item) => {
                          addInvitedItem(item)
                        }}
                        placeholder={
                          isPrivate ? "Start typing to search groups..." : "Start typing to search users or groups..."
                        }
                        label="Add Participants"
                        groupsOnly={isPrivate}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isPrivate
                          ? "Search by group name to invite an entire group to your private market. Private markets can only be shared with groups."
                          : "Search by username, display name, or group name to invite people to your private bet. You can add both individual users and entire groups."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={isLoading || hasInsufficientBalance || isTitleOverLimit || isDescriptionOverLimit}
                  className="flex-1"
                >
                  {isLoading
                    ? "Creating Market..."
                    : `Create Market (${liquidityAmountNum > 0 ? `-$${liquidityAmountNum.toFixed(2)}` : "$0.00"})`}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
