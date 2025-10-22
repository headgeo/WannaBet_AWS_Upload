import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getMyBetsData } from "@/app/my-bets/actions"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { positions, createdMarkets, privateMarkets, pnlHistory, error } = await getMyBetsData()

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({
      positions: positions || [],
      createdMarkets: createdMarkets || [],
      privateMarkets: privateMarkets || [],
      pnlHistory: pnlHistory || [],
    })
  } catch (error) {
    console.error("[v0] Error fetching my bets:", error)
    return NextResponse.json({ error: "Failed to fetch bets" }, { status: 500 })
  }
}
