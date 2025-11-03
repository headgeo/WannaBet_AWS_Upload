import { NextResponse } from "next/server"
import { select } from "@/lib/database/adapter"

export async function GET() {
  try {
    console.log("[v0] Settlement Diagnostics: Starting comprehensive check...")

    // 1. Check all markets with settlement_status
    const allMarkets = await select<any>(
      "markets",
      [
        "id",
        "title",
        "status",
        "settlement_status",
        "settlement_initiated_at",
        "contest_deadline",
        "creator_settlement_outcome",
      ],
      undefined,
      { column: "created_at", ascending: false },
    )

    console.log("[v0] Total markets in database:", allMarkets?.length || 0)

    // 2. Filter markets that should be settled
    const pendingContestMarkets = allMarkets?.filter((m: any) => m.settlement_status === "pending_contest") || []

    const contestedMarkets = allMarkets?.filter((m: any) => m.settlement_status === "contested") || []

    console.log("[v0] Markets with pending_contest:", pendingContestMarkets.length)
    console.log("[v0] Markets with contested:", contestedMarkets.length)

    // 3. Check for contests
    const allContests = await select<any>(
      "settlement_contests",
      ["id", "market_id", "status", "vote_deadline", "contestant_id"],
      undefined,
    )

    console.log("[v0] Total contests in database:", allContests?.length || 0)

    // 4. Check for settlement bonds
    const allBonds = await select<any>(
      "settlement_bonds",
      ["id", "market_id", "creator_id", "bond_amount", "status"],
      undefined,
    )

    console.log("[v0] Total settlement bonds:", allBonds?.length || 0)

    // 5. Build detailed report
    const now = new Date()
    const detailedReport = {
      timestamp: now.toISOString(),
      summary: {
        total_markets: allMarkets?.length || 0,
        pending_contest_markets: pendingContestMarkets.length,
        contested_markets: contestedMarkets.length,
        total_contests: allContests?.length || 0,
        total_bonds: allBonds?.length || 0,
      },
      pending_contest_markets: pendingContestMarkets.map((m: any) => {
        const hasContest = allContests?.some((c: any) => c.market_id === m.id)
        const hasBond = allBonds?.some((b: any) => b.market_id === m.id)
        const contestDeadline = m.contest_deadline ? new Date(m.contest_deadline) : null
        const isExpired = contestDeadline ? now > contestDeadline : false
        const minutesSinceDeadline = contestDeadline
          ? Math.floor((now.getTime() - contestDeadline.getTime()) / 60000)
          : null

        return {
          id: m.id,
          title: m.title,
          status: m.status,
          settlement_status: m.settlement_status,
          contest_deadline: m.contest_deadline,
          is_expired: isExpired,
          minutes_since_deadline: minutesSinceDeadline,
          has_contest: hasContest,
          has_bond: hasBond,
          should_auto_settle: !hasContest && isExpired,
        }
      }),
      contested_markets: contestedMarkets.map((m: any) => {
        const contest = allContests?.find((c: any) => c.market_id === m.id)
        const voteDeadline = contest?.vote_deadline ? new Date(contest.vote_deadline) : null
        const isExpired = voteDeadline ? now > voteDeadline : false
        const minutesSinceDeadline = voteDeadline ? Math.floor((now.getTime() - voteDeadline.getTime()) / 60000) : null

        return {
          id: m.id,
          title: m.title,
          status: m.status,
          settlement_status: m.settlement_status,
          contest_id: contest?.id,
          contest_status: contest?.status,
          vote_deadline: contest?.vote_deadline,
          is_expired: isExpired,
          minutes_since_deadline: minutesSinceDeadline,
          should_resolve: isExpired,
        }
      }),
    }

    console.log("[v0] Detailed report generated:", JSON.stringify(detailedReport, null, 2))

    return NextResponse.json(detailedReport)
  } catch (error: any) {
    console.error("[v0] Settlement diagnostics error:", error)
    return NextResponse.json({ error: error.message || "Failed to run diagnostics" }, { status: 500 })
  }
}
