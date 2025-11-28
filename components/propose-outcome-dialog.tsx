"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export type OutcomeChoice = "yes" | "no" | "cancel"

interface ProposeOutcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: OutcomeChoice) => void
  isLoading: boolean
  marketTitle: string
  creatorFeesEarned?: number // Optional: show the bond amount
}

export function ProposeOutcomeDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  marketTitle,
  creatorFeesEarned,
}: ProposeOutcomeDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeChoice | null>(null)

  const handleConfirm = () => {
    if (selectedOutcome !== null) {
      onConfirm(selectedOutcome)
    }
  }

  // Reset selection when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedOutcome(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Propose Market Outcome</DialogTitle>
          <DialogDescription>
            Select the outcome you believe is correct for this market. Your creator fees will be posted as a bond.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm font-medium text-muted-foreground">Market Question:</div>
          <div className="text-sm font-semibold bg-muted p-3 rounded-lg">{marketTitle}</div>

          <div className="text-sm font-medium text-muted-foreground">Select Outcome:</div>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={selectedOutcome === "yes" ? "default" : "outline"}
              onClick={() => setSelectedOutcome("yes")}
              className={selectedOutcome === "yes" ? "bg-green-600 hover:bg-green-700" : ""}
              disabled={isLoading}
            >
              YES
            </Button>
            <Button
              variant={selectedOutcome === "no" ? "default" : "outline"}
              onClick={() => setSelectedOutcome("no")}
              className={selectedOutcome === "no" ? "bg-red-600 hover:bg-red-700" : ""}
              disabled={isLoading}
            >
              NO
            </Button>
            <Button
              variant={selectedOutcome === "cancel" ? "default" : "outline"}
              onClick={() => setSelectedOutcome("cancel")}
              className={selectedOutcome === "cancel" ? "bg-orange-600 hover:bg-orange-700" : ""}
              disabled={isLoading}
            >
              CANCEL
            </Button>
          </div>

          {selectedOutcome === "cancel" && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <strong>Cancel Market:</strong> All positions will be refunded at their original cost basis. Use this if
                the market question cannot be resolved or was invalidated.
              </p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                {creatorFeesEarned !== undefined && (
                  <div>
                    <strong>Your Bond:</strong> ${creatorFeesEarned.toFixed(2)} (your accumulated creator fees)
                  </div>
                )}
                <div>
                  <strong>Challenge Period:</strong> 1 hour
                </div>
                <div className="pt-1 border-t border-blue-300 dark:border-blue-700">
                  If not contested within 1 hour, the market will settle as proposed and your bond will be returned. If
                  contested, participants will vote on the outcome.
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedOutcome === null || isLoading}>
            {isLoading ? "Proposing..." : "Confirm Proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
