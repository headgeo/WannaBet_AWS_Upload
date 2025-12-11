import { createClient } from "@/lib/supabase/server"
import { select } from "@/lib/database/adapter"

export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return false
    }

    try {
      const profiles = await select<{ role: string }>(
        "profiles",
        ["role"],
        [{ column: "id", operator: "=", value: user.id }],
        undefined,
        1,
      )

      if (!profiles || profiles.length === 0) {
        return false
      }

      return profiles[0]?.role === "admin"
    } catch (error) {
      console.error("[Auth] Admin check failed:", (error as Error).message)
      return false
    }
  } catch (error) {
    console.error("[Auth] Admin check error:", (error as Error).message)
    return false
  }
}

export async function requireAdmin() {
  const adminStatus = await isAdmin()

  if (!adminStatus) {
    throw new Error("Admin access required")
  }
}

export async function getCurrentUserRole(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    try {
      const profiles = await select<{ role: string }>(
        "profiles",
        ["role"],
        [{ column: "id", operator: "=", value: user.id }],
        undefined,
        1,
      )

      if (!profiles || profiles.length === 0) {
        return "user"
      }

      return profiles[0]?.role || "user"
    } catch (error) {
      console.error("[Auth] Get role failed:", (error as Error).message)
      return "user"
    }
  } catch (error) {
    console.error("[Auth] Get role error:", (error as Error).message)
    return "user"
  }
}

export async function getAdminProfile() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    try {
      const profiles = await select<{ id: string; role: string; username: string; display_name: string }>(
        "profiles",
        "*",
        [{ column: "id", operator: "=", value: user.id }],
        undefined,
        1,
      )

      if (!profiles || profiles.length === 0) {
        return null
      }

      const profile = profiles[0]

      if (profile?.role !== "admin") {
        return null
      }

      return { user, profile }
    } catch (error) {
      console.error("[Auth] Get admin profile failed:", (error as Error).message)
      return null
    }
  } catch (error) {
    console.error("[Auth] Get admin profile error:", (error as Error).message)
    return null
  }
}
