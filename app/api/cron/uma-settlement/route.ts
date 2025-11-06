/**
 * UMA Settlement Cron Job
 * Automatically checks for markets with expired liveness periods and settles them
 * Run every 5 minutes via Vercel Cron
 */

import { type NextRequest, NextResponse } from "next/server"
import { select } from "@/lib/database/adapter"
import { finalizeUMASettlement } from "@/app/actions/uma-settlement"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // 60 seconds timeout

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[UMA Cron] Starting settlement check...")

    // Find markets with resolution requested and liveness period expired
    const now = new Date().toISOString()
    const markets = await select("markets", "*", [
      { column: "blockchain_status", operator: "eq", value: "resolution_requested" },
      { column: "uma_liveness_ends_at", operator: "lte", value: now },
      { column: "status", operator: "neq", value: "settled" },
    ])

    if (!markets || markets.length === 0) {
      console.log("[UMA Cron] No markets ready to settle")
      return NextResponse.json({
        success: true,
        message: "No markets ready to settle",
        settled: 0,
      })
    }

    console.log(`[UMA Cron] Found ${markets.length} markets ready to settle`)

    const results = []

    // Attempt to settle each market
    for (const market of markets) {
      console.log(`[UMA Cron] Attempting to settle market: ${market.id} - ${market.title}`)

      try {
        const result = await finalizeUMASettlement(market.id)

        if (result.success) {
          console.log(`[UMA Cron] Successfully settled market: ${market.id}`)
          results.push({
            marketId: market.id,
            title: market.title,
            success: true,
            outcome: result.data?.outcome,
          })
        } else {
          console.error(`[UMA Cron] Failed to settle market ${market.id}:`, result.error)
          results.push({
            marketId: market.id,
            title: market.title,
            success: false,
            error: result.error,
          })
        }
      } catch (error: any) {
        console.error(`[UMA Cron] Error settling market ${market.id}:`, error)
        results.push({
          marketId: market.id,
          title: market.title,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    console.log(`[UMA Cron] Settlement complete: ${successCount} succeeded, ${failureCount} failed`)

    return NextResponse.json({
      success: true,
      message: `Processed ${markets.length} markets`,
      settled: successCount,
      failed: failureCount,
      results,
    })
  } catch (error: any) {
    console.error("[UMA Cron] Fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
