import { type NextRequest, NextResponse } from "next/server"
import { checkPendingSettlements } from "@/app/actions/oracle-settlement"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const startTime = new Date().toISOString()
    console.log("[v0] ========================================")
    console.log("[v0] Settlement cron job started at:", startTime)
    console.log("[v0] ========================================")

    const isDevelopment = process.env.NODE_ENV === "development"
    const authHeader = request.headers.get("authorization")

    if (!isDevelopment && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("[v0] Settlement cron: Unauthorized request (production mode)")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isDevelopment) {
      console.log("[v0] Settlement cron: Running in DEVELOPMENT mode (no auth required)")
    } else {
      console.log("[v0] Settlement cron: Authorized (production mode)")
    }

    console.log("[v0] Settlement cron: Checking pending settlements...")

    // Check and process pending settlements
    const result = await checkPendingSettlements()

    if (!result.success) {
      console.error("[v0] Settlement cron error:", result.error)
      console.log("[v0] ========================================")
      console.log("[v0] Settlement cron job FAILED at:", new Date().toISOString())
      console.log("[v0] ========================================")
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    const endTime = new Date().toISOString()
    console.log("[v0] Settlement cron completed successfully:", result.data)
    console.log("[v0] ========================================")
    console.log("[v0] Settlement cron job completed at:", endTime)
    console.log("[v0] ========================================")

    return NextResponse.json({
      success: true,
      processed: result.data,
      startTime,
      endTime,
      mode: isDevelopment ? "development" : "production",
    })
  } catch (error) {
    console.error("[v0] Settlement cron exception:", error)
    console.log("[v0] ========================================")
    console.log("[v0] Settlement cron job CRASHED at:", new Date().toISOString())
    console.log("[v0] ========================================")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
