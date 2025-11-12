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
}: BlockchainStatusProps) {
  // Don't show for private markets
  if (isPrivate) {
    return null
  }

  const getStatusBadge = () => {
    if (!blockchainAddress) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Not Deployed
        </Badge>
      )
    }

    if (blockchainStatus === "deployed" && !umaRequestId) {
      return (
        <Badge
          variant="outline"
          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 flex items-center gap-1"
        >
          <CheckCircle className="w-3 h-3" />
          Deployed
        </Badge>
      )
    }

    if (blockchainStatus === "resolution_requested" || umaRequestId) {
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 flex items-center gap-1"
        >
          <Clock className="w-3 h-3" />
          Settlement Requested
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
        Deploying...
      </Badge>
    )
  }

  const getPolygonScanUrl = () => {
    const network = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "amoy"
    const baseUrl = network === "polygon" ? "https://polygonscan.com" : "https://amoy.polygonscan.com"

    return `${baseUrl}/address/${blockchainAddress}`
  }

  const getProposalUrl = () => {
    const network = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "amoy"

    if (network === "amoy") {
      const oracleAddress = "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB"
      return `https://amoy.polygonscan.com/address/${oracleAddress}#writeContract`
    }

    return `https://oracle.uma.xyz`
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
        {!blockchainAddress ? (
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">This market is not yet deployed to the blockchain.</p>
            <p className="text-xs">
              Public markets are automatically deployed when created. Settlement will use UMA&apos;s decentralized
              oracle.
            </p>
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
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Address:</span>
                <div className="flex items-center gap-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                    {blockchainAddress.slice(0, 6)}...{blockchainAddress.slice(-4)}
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
            </div>

            <div className="space-y-2 pt-2 border-t">
              {blockchainAddress && (
                <Button
                  onClick={() => window.open(getProposalUrl(), "_blank")}
                  variant="default"
                  size="sm"
                  className="w-full text-xs md:text-sm"
                >
                  Propose Resolution
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                {process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK === "amoy"
                  ? "View contract on PolygonScan to interact (testnet)"
                  : "Propose outcome through UMA Oracle. Requires $500 USDC bond."}
              </p>
            </div>

            {umaRequestId && livenessEndsAt && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">UMA Settlement Active</div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  Liveness ends: {format(new Date(livenessEndsAt), "MMM d, h:mm a")}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
