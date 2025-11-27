import { type NextRequest, NextResponse } from "next/server"
import { checkPendingSettlements, forceSettlePendingSettlements } from "@/app/actions/oracle-settlement"
import { isAdmin } from "@/lib/auth/admin"

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

    console.log("[v0] Settlement cron: Authorization check starting...")
    console.log("[v0] Settlement cron: isDevelopment:", isDevelopment)
    console.log("[v0] Settlement cron: Has auth header:", !!authHeader)
    console.log("[v0] Settlement cron: Has CRON_SECRET:", !!process.env.CRON_SECRET)

    // Check admin status
    console.log("[v0] Settlement cron: Checking admin status...")
    const isAdminUser = await isAdmin()
    console.log("[v0] Settlement cron: isAdminUser result:", isAdminUser)

    const isAuthorized = isDevelopment || isAdminUser || authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!isAuthorized) {
      console.log("[v0] Settlement cron: UNAUTHORIZED - All checks failed")
      console.log("[v0] Settlement cron: - Development mode:", isDevelopment)
      console.log("[v0] Settlement cron: - Admin user:", isAdminUser)
      console.log("[v0] Settlement cron: - Valid cron secret:", authHeader === `Bearer ${process.env.CRON_SECRET}`)
      return NextResponse.json(
        {
          error: "Unauthorized",
          details: {
            isDevelopment,
            isAdminUser,
            hasCronSecret: !!process.env.CRON_SECRET,
            hasAuthHeader: !!authHeader,
          },
        },
        { status: 401 },
      )
    }

    if (isDevelopment) {
      console.log("[v0] Settlement cron: Running in DEVELOPMENT mode")
    } else if (isAdminUser) {
      console.log("[v0] Settlement cron: Authorized as admin user")
    } else {
      console.log("[v0] Settlement cron: Authorized via CRON_SECRET")
    }

    console.log("[v0] Settlement cron: Checking pending settlements...")
    const checkResult = await checkPendingSettlements()

    if (!checkResult.success) {
      console.error("[v0] Settlement cron check error:", checkResult.error)
      return NextResponse.json({ error: checkResult.error }, { status: 500 })
    }

    console.log("[v0] Settlement cron: Found markets to check:", checkResult.data)

    console.log("[v0] Settlement cron: Calling force_settle_pending_settlements...")
    const settleResult = await forceSettlePendingSettlements()

    if (!settleResult.success) {
      console.error("[v0] Settlement cron settlement error:", settleResult.error)
      console.log("[v0] ========================================")
      console.log("[v0] Settlement cron job FAILED at:", new Date().toISOString())
      console.log("[v0] ========================================")
      return NextResponse.json({ error: settleResult.error }, { status: 500 })
    }

    const endTime = new Date().toISOString()
    console.log("[v0] Settlement cron completed successfully!")
    console.log("[v0] Settlement cron: Markets checked:", checkResult.data)
    console.log("[v0] Settlement cron: Settlement result:", settleResult.data)
    console.log("[v0] ========================================")
    console.log("[v0] Settlement cron job completed at:", endTime)
    console.log("[v0] ========================================")

    return NextResponse.json({
      success: true,
      checked: checkResult.data,
      settled: settleResult.data,
      startTime,
      endTime,
      mode: isDevelopment ? "development" : isAdminUser ? "admin" : "production",
    })
  } catch (error) {
    console.error("[v0] Settlement cron exception:", error)
    console.log("[v0] ========================================")
    console.log("[v0] Settlement cron job CRASHED at:", new Date().toISOString())
    console.log("[v0] ========================================")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
