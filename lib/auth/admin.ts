import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

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

    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (error) {
      console.log("[v0] isAdmin: Regular client failed, trying service client:", error)

      try {
        const serviceSupabase = createServiceClient()
        const { data: serviceProfile, error: serviceError } = await serviceSupabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (serviceError) {
          console.log("[v0] isAdmin: Service client also failed:", serviceError)
          return false
        }

        return serviceProfile?.role === "admin"
      } catch (serviceError) {
        console.log("[v0] isAdmin: Service client creation failed:", serviceError)
        return false
      }
    }

    const isAdminUser = profile?.role === "admin"
    console.log("[v0] isAdmin: Final result:", isAdminUser)
    return isAdminUser
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

    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (error) {
      console.log("[v0] getCurrentUserRole: Regular client failed, trying service client:", error)

      try {
        const serviceSupabase = createServiceClient()
        const { data: serviceProfile, error: serviceError } = await serviceSupabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (serviceError) {
          console.log("[v0] getCurrentUserRole: Service client also failed:", serviceError)
          return "user"
        }

        return serviceProfile?.role || "user"
      } catch (serviceError) {
        console.log("[v0] getCurrentUserRole: Service client creation failed:", serviceError)
        return "user"
      }
    }

    console.log("[v0] getCurrentUserRole: Role result:", profile?.role)
    return profile?.role || "user"
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

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    if (error) {
      console.log("[v0] getAdminProfile: Regular client failed, trying service client:", error)

      try {
        const serviceSupabase = createServiceClient()
        const { data: serviceProfile, error: serviceError } = await serviceSupabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (serviceError) {
          console.log("[v0] getAdminProfile: Service client also failed:", serviceError)
          return null
        }

        if (serviceProfile?.role !== "admin") {
          console.log("[v0] getAdminProfile: User is not admin, role:", serviceProfile?.role)
          return null
        }

        return { user, profile: serviceProfile }
      } catch (serviceError) {
        console.log("[v0] getAdminProfile: Service client creation failed:", serviceError)
        return null
      }
    }

    if (profile?.role !== "admin") {
      console.log("[v0] getAdminProfile: User is not admin, role:", profile?.role)
      return null
    }

    console.log("[v0] getAdminProfile: Admin profile found")
    return { user, profile }
  } catch (error) {
    console.error("[v0] getAdminProfile: Error getting admin profile:", error)
    return null
  }
}
