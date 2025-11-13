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

interface ProposeOutcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: boolean) => void
  isLoading: boolean
  marketTitle: string
}

export function ProposeOutcomeDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  marketTitle,
}: ProposeOutcomeDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<boolean | null>(null)

  const handleConfirm = () => {
    if (selectedOutcome !== null) {
      onConfirm(selectedOutcome)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Propose Market Outcome</DialogTitle>
          <DialogDescription>
            Select the outcome you believe is correct for this market. You&apos;ll need to post a $500 USDC bond.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm font-medium text-muted-foreground">Market Question:</div>
          <div className="text-sm font-semibold bg-muted p-3 rounded-lg">{marketTitle}</div>

          <div className="text-sm font-medium text-muted-foreground">Select Outcome:</div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={selectedOutcome === true ? "default" : "outline"}
              onClick={() => setSelectedOutcome(true)}
              className={selectedOutcome === true ? "bg-green-600 hover:bg-green-700" : ""}
              disabled={isLoading}
            >
              YES
            </Button>
            <Button
              variant={selectedOutcome === false ? "default" : "outline"}
              onClick={() => setSelectedOutcome(false)}
              className={selectedOutcome === false ? "bg-red-600 hover:bg-red-700" : ""}
              disabled={isLoading}
            >
              NO
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div>
                  <strong>Platform Reward:</strong> $10 USDC (provided by platform)
                </div>
                <div>
                  <strong>Your Bond:</strong> $500 USDC (required from your wallet)
                </div>
                <div>
                  <strong>Challenge Period:</strong> 2 hours
                </div>
                <div className="pt-1 border-t border-blue-300 dark:border-blue-700">
                  If not disputed within 2 hours, you&apos;ll receive your $500 bond back plus the $10 platform reward.
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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
