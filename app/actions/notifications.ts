"use server"

import { createServerClient } from "@/lib/supabase/server"
import { select, update } from "@/lib/database/adapter"

interface Notification {
  id: string
  market_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  user_id: string
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log("[v0] No user found for notifications")
    return []
  }

  try {
    console.log("[v0] Fetching notifications for user:", user.id)
    const result = await select<Notification>(
      "notifications",
      "*",
      [{ column: "user_id", value: user.id }],
      { column: "created_at", ascending: false },
      30, // Increased limit from 20 to 50 to fetch more recent notifications
    )
    console.log("[v0] Notifications fetched:", result.length)
    if (result.length > 0) {
      console.log("[v0] Most recent notification:", result[0].created_at)
      console.log("[v0] Oldest notification:", result[result.length - 1].created_at)
    }
    return result
  } catch (error) {
    console.error("[v0] Error loading notifications:", error)
    return []
  }
}

export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || notificationIds.length === 0) {
    return
  }

  try {
    for (const id of notificationIds) {
      await update("notifications", { is_read: true }, { column: "id", value: id })
    }

    console.log("[v0] Marked notifications as read:", notificationIds.length)
  } catch (error) {
    console.error("[v0] Error marking notifications as read:", error)
    throw error
  }
}
