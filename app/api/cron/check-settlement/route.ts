import { type NextRequest, NextResponse } from "next/server"
import { rpc } from "@/lib/database/adapter"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const isDevelopment = process.env.NODE_ENV === "development"

    if (!isDevelopment && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("[v0] Unauthorized cron request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.CRON_SECRET) {
      console.warn("[v0] WARNING: CRON_SECRET not set! Add it to your environment variables.")
    }

    console.log("[v0] Running settlement check cron job...")
    console.log("[v0] Current time:", new Date().toISOString())

    // Call the database function to check and process pending settlements
    const result = await rpc("check_pending_settlements", {})

    console.log("[v0] Settlement check complete:", result)

    if (result.error) {
      console.error("[v0] Settlement check error:", result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      result: result.data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error in settlement check cron:", error)
    return NextResponse.json(
      {
        error: "Failed to check settlements",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
