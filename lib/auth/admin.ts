import { createClient } from "@/lib/supabase/server"
import { select } from "@/lib/database/adapter"

export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("[v0] isAdmin: No user found")
      return false
    }

    console.log("[v0] isAdmin: Checking role for user:", user.id)

    try {
      const profiles = await select<{ role: string }>(
        "profiles",
        ["role"],
        [{ column: "id", operator: "=", value: user.id }],
        undefined,
        1,
      )

      if (!profiles || profiles.length === 0) {
        console.log("[v0] isAdmin: No profile found for user")
        return false
      }

      const isAdminUser = profiles[0]?.role === "admin"
      console.log("[v0] isAdmin: Final result:", isAdminUser, "Role:", profiles[0]?.role)
      return isAdminUser
    } catch (error) {
      console.error("[v0] isAdmin: Error querying RDS:", error)
      return false
    }
  } catch (error) {
    console.error("[v0] isAdmin: Error checking admin status:", error)
    return false
  }
}

export async function requireAdmin() {
  const adminStatus = await isAdmin()
  console.log("[v0] requireAdmin: Admin status:", adminStatus)

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

    console.log("[v0] getCurrentUserRole: Getting role for user:", user.id)

    try {
      const profiles = await select<{ role: string }>(
        "profiles",
        ["role"],
        [{ column: "id", operator: "=", value: user.id }],
        undefined,
        1,
      )

      if (!profiles || profiles.length === 0) {
        console.log("[v0] getCurrentUserRole: No profile found, defaulting to 'user'")
        return "user"
      }

      console.log("[v0] getCurrentUserRole: Role result:", profiles[0]?.role)
      return profiles[0]?.role || "user"
    } catch (error) {
      console.error("[v0] getCurrentUserRole: Error querying RDS:", error)
      return "user"
    }
  } catch (error) {
    console.error("[v0] getCurrentUserRole: Error getting user role:", error)
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
      console.log("[v0] getAdminProfile: No user found")
      return null
    }

    console.log("[v0] getAdminProfile: Getting profile for user:", user.id)

    try {
      const profiles = await select<{ id: string; role: string; username: string; display_name: string }>(
        "profiles",
        "*",
        [{ column: "id", operator: "=", value: user.id }],
        undefined,
        1,
      )

      if (!profiles || profiles.length === 0) {
        console.log("[v0] getAdminProfile: No profile found")
        return null
      }

      const profile = profiles[0]

      if (profile?.role !== "admin") {
        console.log("[v0] getAdminProfile: User is not admin, role:", profile?.role)
        return null
      }

      console.log("[v0] getAdminProfile: Admin profile found")
      return { user, profile }
    } catch (error) {
      console.error("[v0] getAdminProfile: Error querying RDS:", error)
      return null
    }
  } catch (error) {
    console.error("[v0] getAdminProfile: Error getting admin profile:", error)
    return null
  }
}
