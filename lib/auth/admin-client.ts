"use client"

import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsAdmin(false)
        return
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

      setIsAdmin(profile?.role === "admin")
    } catch (error) {
      console.error("Error checking admin status:", error)
      setIsAdmin(false)
    } finally {
      setIsLoading(false)
    }
  }

  return { isAdmin, isLoading, refetch: checkAdminStatus }
}

export async function isAdminClient(): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    return profile?.role === "admin"
  } catch (error) {
    console.error("Error checking admin status:", error)
    return false
  }
}
