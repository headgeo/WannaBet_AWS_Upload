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

interface VoteOutcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: OutcomeChoice) => void
  isLoading: boolean
  marketTitle: string
  creatorProposedOutcome: OutcomeChoice
  voteCounts?: {
    yes: number
    no: number
    cancel: number
  }
  voteBondAmount?: number
}

export function VoteOutcomeDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  marketTitle,
  creatorProposedOutcome,
  voteCounts = { yes: 0, no: 0, cancel: 0 },
  voteBondAmount = 25,
}: VoteOutcomeDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeChoice | null>(null)

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

  const totalVotes = voteCounts.yes + voteCounts.no + voteCounts.cancel

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vote on Outcome</DialogTitle>
          <DialogDescription>
            Cast your vote for the correct market outcome. Your vote helps determine the final settlement.
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

          {/* Current vote tally */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="text-sm font-medium mb-2">Current Votes ({totalVotes} total):</div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                <div className="font-bold text-green-600">{voteCounts.yes}</div>
                <div className="text-xs text-muted-foreground">YES</div>
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
                <div className="font-bold text-red-600">{voteCounts.no}</div>
                <div className="text-xs text-muted-foreground">NO</div>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded">
                <div className="font-bold text-orange-600">{voteCounts.cancel}</div>
                <div className="text-xs text-muted-foreground">CANCEL</div>
              </div>
            </div>
          </div>

          <div className="text-sm font-medium text-muted-foreground">Cast your vote:</div>
          <div className="grid grid-cols-3 gap-3">
            {(["yes", "no", "cancel"] as OutcomeChoice[]).map((outcome) => (
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
                  <strong>Vote Bond:</strong> ${voteBondAmount.toFixed(2)} (required from your wallet)
                </div>
                <div className="pt-1 border-t border-blue-300 dark:border-blue-700">
                  If you vote with the winning majority, you'll receive your bond back plus a proportional share of the
                  losing bonds.
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
            {isLoading ? "Voting..." : "Submit Vote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
