import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error("[v0] Middleware error:", error)
    // Return a simple response to prevent crashes
    return new Response(null, { status: 200 })
  }
}

export const config = {
  matcher: [
    /*
     * Updated matcher to be more specific and avoid conflicts
     * Match all request paths except static files and API routes
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
