"use server"

import { query } from "@/lib/database/adapter"

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_TRADES_PER_MINUTE = 10

export async function checkTradeRateLimit(
  userId: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

    // Count trades in the last minute (both buy and sell transactions)
    const result = await query(
      `SELECT COUNT(*) as trade_count
       FROM transactions
       WHERE user_id = $1
         AND created_at > $2
         AND type IN ('buy', 'sell')`,
      [userId, windowStart.toISOString()],
    )

    const tradeCount = Number.parseInt(result.rows[0]?.trade_count || "0")
    const remaining = Math.max(0, MAX_TRADES_PER_MINUTE - tradeCount)
    const allowed = tradeCount < MAX_TRADES_PER_MINUTE
    const resetAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS)

    console.log("[v0] Rate limit check:", {
      userId,
      tradeCount,
      remaining,
      allowed,
      resetAt: resetAt.toISOString(),
    })

    return { allowed, remaining, resetAt }
  } catch (error) {
    console.error("[v0] Rate limit check failed:", error)
    // On error, allow the trade (fail open to prevent blocking legitimate users)
    return { allowed: true, remaining: MAX_TRADES_PER_MINUTE, resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW_MS) }
  }
}
