/**
 * Get the correct redirect URL for auth flows
 * Uses production URL by default, or window.location.origin in browser
 * This ensures email links always point to production, not localhost
 */
export function getAuthRedirectUrl(path = "/auth/callback"): string {
  const productionUrl = "https://wanna-bet-production-beta.vercel.app"

  if (typeof window !== "undefined") {
    // In browser, use current origin (but only if not localhost for email links)
    return `${window.location.origin}${path}`
  }

  // Server-side or for email links, always use production
  return `${productionUrl}${path}`
}
