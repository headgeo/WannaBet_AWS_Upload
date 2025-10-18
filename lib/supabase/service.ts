import { createClient } from "@supabase/supabase-js"

/**
 * Service role client for admin operations
 * This bypasses RLS and should only be used for admin functions
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log("[v0] Service client env check:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!serviceRoleKey,
    urlValue: supabaseUrl ? "present" : "missing",
    keyValue: serviceRoleKey ? "present" : "missing",
  })

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for service client")
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service client")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
