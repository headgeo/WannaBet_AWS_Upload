"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface BlockchainStatusProps {
  marketId: string
  blockchainAddress?: string | null
  blockchainStatus?: string | null
  umaRequestId?: string | null
  livenessEndsAt?: string | null
  isPrivate: boolean
  onRequestSettlement?: () => void
  onProposeOutcome?: () => void
  isRequestingSettlement?: boolean
}

export function BlockchainStatus({
  marketId,
  blockchainAddress,
  blockchainStatus,
  umaRequestId,
  livenessEndsAt,
  isPrivate,
  onRequestSettlement,
  onProposeOutcome,
  isRequestingSettlement,
}: BlockchainStatusProps) {
  // Don't show for private markets
  if (isPrivate) {
    return null
  }

  const getStatusBadge = () => {
    if (!umaRequestId && blockchainStatus === "not_deployed") {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Not Deployed
        </Badge>
      )
    }

    if (umaRequestId && blockchainStatus === "proposal_pending") {
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 flex items-center gap-1"
        >
          <Clock className="w-3 h-3" />
          Proposal Pending
        </Badge>
      )
    }

    if (blockchainStatus === "settled") {
      return (
        <Badge
          variant="outline"
          className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 flex items-center gap-1"
        >
          <CheckCircle className="w-3 h-3" />
          Settled
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Processing...
      </Badge>
    )
  }

  const getPolygonScanUrl = () => {
    const network = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "amoy"
    const baseUrl = network === "polygon" ? "https://polygonscan.com" : "https://amoy.polygonscan.com"

    if (umaRequestId) {
      return `${baseUrl}/tx/${umaRequestId}`
    }

    const oracleAddress = "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB"
    return `${baseUrl}/address/${oracleAddress}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <span className="text-sm md:text-base">Blockchain Settlement</span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {blockchainStatus === "not_deployed" && !umaRequestId ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <p>This market uses UMA&apos;s Optimistic Oracle for decentralized settlement.</p>
            </div>

            <Button
              onClick={onProposeOutcome}
              disabled={isRequestingSettlement}
              variant="default"
              size="sm"
              className="w-full"
            >
              {isRequestingSettlement ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Proposing Outcome...
                </>
              ) : (
                <>Propose Outcome</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span className="font-medium">
                  {process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK === "polygon" ? "Polygon" : "Amoy Testnet"}
                </span>
              </div>
              {umaRequestId && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Assertion ID:</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {umaRequestId.slice(0, 8)}...{umaRequestId.slice(-6)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => window.open(getPolygonScanUrl(), "_blank")}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {umaRequestId && livenessEndsAt && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Challenge Period Active</div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  Ends: {format(new Date(livenessEndsAt), "MMM d, h:mm a")}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  After this time, the outcome can be finalized on-chain.
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <Button
                onClick={() => window.open(getPolygonScanUrl(), "_blank")}
                variant="outline"
                size="sm"
                className="w-full text-xs md:text-sm"
              >
                View on PolygonScan
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
