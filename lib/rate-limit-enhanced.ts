"use server"

import { query } from "@/lib/database/adapter"

const RATE_LIMITS = {
  trade: { window: 60 * 1000, max: 10 }, // 10 trades per minute
  settlement: { window: 60 * 1000, max: 5 }, // 5 settlements per minute
  contest: { window: 60 * 1000, max: 3 }, // 3 contests per minute
  vote: { window: 60 * 1000, max: 10 }, // 10 votes per minute
  market_creation: { window: 60 * 1000, max: 5 }, // 5 markets per minute
} as const

type RateLimitType = keyof typeof RATE_LIMITS

export async function checkRateLimit(
  userId: string,
  type: RateLimitType,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    const config = RATE_LIMITS[type]
    const windowStart = new Date(Date.now() - config.window)

    // Map rate limit type to transaction/action types
    const typeMapping: Record<RateLimitType, string[]> = {
      trade: ["buy", "sell"],
      settlement: ["settlement_initiated"],
      contest: ["contest_created"],
      vote: ["vote_submitted"],
      market_creation: ["market_created"],
    }

    const transactionTypes = typeMapping[type]

    // Count actions in the last window
    const result = await query(
      `SELECT COUNT(*) as action_count
       FROM transactions
       WHERE user_id = $1
         AND created_at > $2
         AND type = ANY($3)`,
      [userId, windowStart.toISOString(), transactionTypes],
    )

    const actionCount = Number.parseInt(result.rows[0]?.action_count || "0")
    const remaining = Math.max(0, config.max - actionCount)
    const allowed = actionCount < config.max
    const resetAt = new Date(Date.now() + config.window)

    console.log(`[v0] Rate limit check (${type}):`, {
      userId,
      actionCount,
      remaining,
      allowed,
      resetAt: resetAt.toISOString(),
    })

    return { allowed, remaining, resetAt }
  } catch (error) {
    console.error(`[v0] Rate limit check failed (${type}):`, error)
    // On error, allow the action (fail open to prevent blocking legitimate users)
    return { allowed: true, remaining: RATE_LIMITS[type].max, resetAt: new Date(Date.now() + RATE_LIMITS[type].window) }
  }
}

// Backward compatibility
export async function checkTradeRateLimit(userId: string) {
  return checkRateLimit(userId, "trade")
}
