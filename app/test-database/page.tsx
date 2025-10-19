import { createClient } from "@/lib/supabase/server"
import { select, isUsingRDS } from "@/lib/database/adapter"
import { redirect } from "next/navigation"

export default async function TestDatabasePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const usingRDS = isUsingRDS()
  const testResults: any = {}

  try {
    // Test fetching markets
    const markets = await select("markets", "*", undefined, undefined, 5)
    testResults.markets = { count: markets.length, sample: markets[0] }

    // Test fetching notifications
    const notifications = await select("notifications", "*", [{ column: "user_id", value: user.id }], undefined, 5)
    testResults.notifications = { count: notifications.length }

    // Test fetching positions
    const positions = await select("positions", "*", [{ column: "user_id", value: user.id }], undefined, 5)
    testResults.positions = { count: positions.length }
  } catch (error: any) {
    testResults.error = error.message
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>

      <div className="space-y-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Database Backend</h2>
          <p>{usingRDS ? "AWS RDS" : "Supabase"}</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold">Test Results</h2>
          <pre className="mt-2 text-sm overflow-auto">{JSON.stringify(testResults, null, 2)}</pre>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold">Environment Variables</h2>
          <ul className="text-sm space-y-1">
            <li>POSTGRES_URL: {process.env.POSTGRES_URL ? "✓ Set" : "✗ Not set"}</li>
            <li>POSTGRES_PRISMA_URL: {process.env.POSTGRES_PRISMA_URL ? "✓ Set" : "✗ Not set"}</li>
            <li>POSTGRES_URL_NON_POOLING: {process.env.POSTGRES_URL_NON_POOLING ? "✓ Set" : "✗ Not set"}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
