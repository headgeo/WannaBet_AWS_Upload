"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { calculateSellValueWithFee } from "@/lib/lmsr"
import { FEE_PERCENTAGE } from "@/lib/fees"

interface Position {
  id: string
  side: boolean
  shares: number
  avg_price: string // Updated to be a string
  amount_invested: number
  market: {
    id: string
    title: string
    qy: number // Updated to use LMSR qy instead of yes_liquidity
    qn: number // Updated to use LMSR qn instead of no_liquidity
    b: number // LMSR liquidity parameter
  }
}

interface SellSharesDialogProps {
  position: Position
  onSell: (positionId: string, sharesToSell: number, expectedValue: number) => Promise<void>
}

export function SellSharesDialog({ position, onSell }: SellSharesDialogProps) {
  const [sharesToSell, setSharesToSell] = useState<number>(0)
  const [isSellingAll, setIsSellingAll] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const calculateSellValueLMSR = (sharesToSell: number) => {
    if (sharesToSell <= 0) return { grossValue: 0, feeAmount: 0, netValue: 0 }

    try {
      return calculateSellValueWithFee(
        sharesToSell,
        position.market.qy,
        position.market.qn,
        position.market.b,
        position.side,
      )
    } catch (error) {
      console.error("Error calculating sell value:", error)
      return { grossValue: 0, feeAmount: 0, netValue: 0 }
    }
  }

  const exactShares = position.shares
  const displayShares = Math.floor(position.shares * 100) / 100

  const sellCalculation = calculateSellValueLMSR(isSellingAll ? exactShares : sharesToSell)

  const handleSell = async () => {
    const actualSharesToSell = isSellingAll ? Math.max(0, exactShares - 0.0001) : sharesToSell

    if (actualSharesToSell <= 0 || actualSharesToSell > exactShares) return

    setIsLoading(true)
    try {
      await onSell(position.id, actualSharesToSell, sellCalculation.grossValue)
      setIsOpen(false)
      setSharesToSell(0)
      setIsSellingAll(false)
      router.refresh()
    } catch (error) {
      console.error("Sell failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSellAll = () => {
    setIsSellingAll(true)
    const sharesToSet = Math.max(0, exactShares - 0.0001)
    setSharesToSell(sharesToSet)
  }

  const handleSharesChange = (value: number) => {
    setIsSellingAll(false)
    setSharesToSell(value)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="w-4 h-4 mr-2" />
          Sell Shares
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell Shares</DialogTitle>
          <DialogDescription>
            Sell your {position.side ? "YES" : "NO"} shares back to the market using LMSR pricing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">{position.market.title}</h4>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={position.side ? "default" : "destructive"} className="flex items-center gap-1">
                {position.side ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {position.side ? "YES" : "NO"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              You own {displayShares.toFixed(2)} shares @ ${Number.parseFloat(position.avg_price).toFixed(3)} avg
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shares">Shares to Sell</Label>
            <Input
              id="shares"
              type="number"
              min="0"
              max={displayShares}
              step="0.01"
              value={sharesToSell || ""}
              onChange={(e) => handleSharesChange(Number.parseFloat(e.target.value) || 0)}
              placeholder="Enter number of shares"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Max: {displayShares.toFixed(2)} shares</span>
              <Button variant="ghost" size="sm" onClick={handleSellAll} className="h-auto p-0 text-xs">
                Sell All
              </Button>
            </div>
          </div>

          {sharesToSell > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Shares to sell:</span>
                  <span className="font-medium">
                    {sharesToSell.toFixed(2)}
                    {isSellingAll && " (all)"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground border-b pb-2 mb-2">
                  <div className="flex justify-between">
                    <span>Gross value:</span>
                    <span>${sellCalculation.grossValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee ({(FEE_PERCENTAGE * 100).toFixed(1)}%):</span>
                    <span>-${sellCalculation.feeAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">You'll receive:</span>
                  <span className="font-bold text-green-600">${sellCalculation.netValue.toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Price calculated using LMSR (Logarithmic Market Scoring Rule)
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSell} disabled={sharesToSell <= 0 || sharesToSell > displayShares || isLoading}>
            {isLoading ? "Selling..." : `Sell ${sharesToSell.toFixed(2)} Shares`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
