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
    return []
  }

  try {
    const result = await select<Notification>(
      "notifications",
      "*",
      [{ column: "user_id", value: user.id }],
      { column: "created_at", ascending: false },
      50,
    )
    return result
  } catch (error) {
    console.error("Error loading notifications:", error)
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
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    throw error
  }
}
