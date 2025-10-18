"use server"

import { createServerClient } from "@/lib/supabase/server"
import { getDb } from "@/lib/database/adapter"

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
    const db = getDb()
    const result = await db.select<Notification>("notifications", "*", "user_id = $1", [user.id], "created_at DESC", 20)
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
    const db = getDb()
    const placeholders = notificationIds.map((_, i) => `$${i + 1}`).join(", ")
    await db.query(`UPDATE notifications SET is_read = true WHERE id IN (${placeholders})`, notificationIds)
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    throw error
  }
}
