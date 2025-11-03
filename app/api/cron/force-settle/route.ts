import { type NextRequest, NextResponse } from "next/server"
import { rpc } from "@/lib/database/adapter"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Manual trigger endpoint for testing settlement logic
 * This endpoint forces settlement of all pending markets regardless of deadlines
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] FORCE SETTLE: Starting manual settlement trigger...")
    console.log("[v0] Current time:", new Date().toISOString())

    // Call the force settle function (ignores deadlines)
    const result = await rpc("force_settle_pending_settlements", {})

    console.log("[v0] FORCE SETTLE: Complete:", result)

    if (result.error) {
      console.error("[v0] FORCE SETTLE: Error:", result.error)
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
      message: "Force settlement complete - all pending markets processed",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] FORCE SETTLE: Exception:", error)
    return NextResponse.json(
      {
        error: "Failed to force settle markets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
