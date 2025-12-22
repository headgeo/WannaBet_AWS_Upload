import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type")
  const next = requestUrl.searchParams.get("next") ?? "/"

  console.log("[v0] Auth callback received:", { token_hash: !!token_hash, type })

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      console.log("[v0] Auth callback token verified successfully")
      if (type === "recovery" || type === "email_change") {
        return NextResponse.redirect(new URL("/auth/reset-password", request.url))
      }
      // Otherwise redirect to the next URL
      return NextResponse.redirect(new URL(next, request.url))
    } else {
      console.error("[v0] Auth callback verification error:", error)
    }
  }

  // Return the user to an error page with some instructions
  console.log("[v0] Auth callback failed: missing token or type")
  return NextResponse.redirect(new URL("/auth/error?message=Invalid or expired reset link", request.url))
}
