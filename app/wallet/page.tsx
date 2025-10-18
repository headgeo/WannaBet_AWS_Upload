import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, ArrowLeft } from "lucide-react"

export default function WalletPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 md:w-16 md:h-16 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl md:text-2xl">Wallet Features Not Active</CardTitle>
              <CardDescription className="mt-2 text-sm md:text-base">
                Contact the administrator for wallet information
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Link href="/">
              <Button variant="default" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
