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
import type { OutcomeChoice } from "./propose-outcome-dialog"

interface ContestOutcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: OutcomeChoice) => void
  isLoading: boolean
  marketTitle: string
  creatorProposedOutcome: OutcomeChoice // The outcome the creator proposed
  contestBondAmount?: number
}

export function ContestOutcomeDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  marketTitle,
  creatorProposedOutcome,
  contestBondAmount = 50,
}: ContestOutcomeDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeChoice | null>(null)

  // Get available contest options (exclude creator's proposed outcome)
  const getAvailableOutcomes = (): OutcomeChoice[] => {
    const allOutcomes: OutcomeChoice[] = ["yes", "no", "cancel"]
    return allOutcomes.filter((o) => o !== creatorProposedOutcome)
  }

  const availableOutcomes = getAvailableOutcomes()

  const handleConfirm = () => {
    if (selectedOutcome !== null) {
      onConfirm(selectedOutcome)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedOutcome(null)
    }
    onOpenChange(open)
  }

  const getOutcomeLabel = (outcome: OutcomeChoice): string => {
    switch (outcome) {
      case "yes":
        return "YES"
      case "no":
        return "NO"
      case "cancel":
        return "CANCEL"
    }
  }

  const getOutcomeColor = (outcome: OutcomeChoice, isSelected: boolean): string => {
    if (!isSelected) return ""
    switch (outcome) {
      case "yes":
        return "bg-green-600 hover:bg-green-700"
      case "no":
        return "bg-red-600 hover:bg-red-700"
      case "cancel":
        return "bg-orange-600 hover:bg-orange-700"
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contest Settlement</DialogTitle>
          <DialogDescription>
            The creator proposed <strong>{getOutcomeLabel(creatorProposedOutcome)}</strong>. Select the outcome you
            believe is correct to contest their proposal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm font-medium text-muted-foreground">Market Question:</div>
          <div className="text-sm font-semibold bg-muted p-3 rounded-lg">{marketTitle}</div>

          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Creator's Proposal:</strong> {getOutcomeLabel(creatorProposedOutcome)}
            </div>
          </div>

          <div className="text-sm font-medium text-muted-foreground">Contest with:</div>
          <div className={`grid grid-cols-${availableOutcomes.length} gap-3`}>
            {availableOutcomes.map((outcome) => (
              <Button
                key={outcome}
                variant={selectedOutcome === outcome ? "default" : "outline"}
                onClick={() => setSelectedOutcome(outcome)}
                className={getOutcomeColor(outcome, selectedOutcome === outcome)}
                disabled={isLoading}
              >
                {getOutcomeLabel(outcome)}
              </Button>
            ))}
          </div>

          {selectedOutcome === "cancel" && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <strong>Cancel Market:</strong> All positions will be refunded at their original cost basis.
              </p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div>
                  <strong>Contest Bond:</strong> ${contestBondAmount.toFixed(2)} (required from your wallet)
                </div>
                <div>
                  <strong>Voting Period:</strong> 1 hour after contest
                </div>
                <div className="pt-1 border-t border-blue-300 dark:border-blue-700">
                  Participants will vote on the outcome. If your contested outcome wins, you'll receive your bond back
                  plus a share of the losing bonds.
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
            {isLoading ? "Contesting..." : "Submit Contest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
