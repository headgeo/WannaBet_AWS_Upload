"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { depositFunds, withdrawFunds } from "@/app/actions/wallet"
import { useRouter } from "next/navigation"
import { MobileHeader } from "@/components/mobile-header"

interface WalletClientProps {
  initialBalance: number
  userId?: string
  userIsAdmin?: boolean
}

export function WalletClient({ initialBalance, userId, userIsAdmin }: WalletClientProps) {
  const [balance, setBalance] = useState(initialBalance)
  const [isDepositing, setIsDepositing] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDeposit = async () => {
    setIsDepositing(true)
    setError(null)

    const result = await depositFunds()

    if (result.success && result.newBalance !== undefined) {
      setBalance(result.newBalance)
      router.refresh()
    } else {
      setError(result.error || "Deposit failed")
    }

    setIsDepositing(false)
  }

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    setError(null)

    const result = await withdrawFunds()

    if (result.success && result.newBalance !== undefined) {
      setBalance(result.newBalance)
      router.refresh()
    } else {
      setError(result.error || "Withdrawal failed")
    }

    setIsWithdrawing(false)
  }

  return (
    <>
      <MobileHeader userId={userId} userIsAdmin={userIsAdmin} />
      <div className="container mx-auto px-4 py-8 pt-4 pb-20 md:pb-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Wallet</CardTitle>
                <CardDescription className="mt-2">Manage your account balance</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Balance Display */}
              <div className="text-center py-6 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
                <p className="text-4xl font-bold">${balance.toFixed(2)}</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleDeposit}
                  disabled={isDepositing || isWithdrawing}
                  className="h-24 flex flex-col gap-2"
                  size="lg"
                >
                  <ArrowDownToLine className="w-6 h-6" />
                  <span>{isDepositing ? "Processing..." : "Deposit $50"}</span>
                </Button>

                <Button
                  onClick={handleWithdraw}
                  disabled={isDepositing || isWithdrawing}
                  variant="outline"
                  className="h-24 flex flex-col gap-2 bg-transparent"
                  size="lg"
                >
                  <ArrowUpFromLine className="w-6 h-6" />
                  <span>{isWithdrawing ? "Processing..." : "Withdraw $50"}</span>
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Deposit and withdrawal amounts can be configured by the administrator
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export default WalletClient
