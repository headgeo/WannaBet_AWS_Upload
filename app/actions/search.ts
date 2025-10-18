"use server"

import { createServerClient } from "@/lib/supabase/server"
import { getDb } from "@/lib/database/adapter"

interface UserProfile {
  id: string
  username: string
  display_name: string
}

interface Group {
  id: string
  name: string
  description: string | null
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  if (!query || query.length < 2) {
    return []
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  try {
    const db = getDb()
    const searchPattern = `%${query}%`
    const result = await db.query<UserProfile>(
      `SELECT id, username, display_name 
       FROM profiles 
       WHERE (username ILIKE $1 OR display_name ILIKE $1) 
       AND id != $2 
       LIMIT 5`,
      [searchPattern, user.id],
    )
    return result.rows
  } catch (error) {
    console.error("Error searching users:", error)
    return []
  }
}

export async function searchGroups(query: string): Promise<Group[]> {
  if (!query || query.length < 2) {
    return []
  }

  try {
    const db = getDb()
    const searchPattern = `%${query}%`
    const result = await db.query<Group>(
      `SELECT id, name, description 
       FROM groups 
       WHERE name ILIKE $1 OR description ILIKE $1 
       LIMIT 3`,
      [searchPattern],
    )
    return result.rows
  } catch (error) {
    console.error("Error searching groups:", error)
    return []
  }
}

export async function searchUsersAndGroups(
  query: string,
  groupsOnly = false,
): Promise<Array<(UserProfile & { type: "user" }) | (Group & { type: "group" })>> {
  if (!query || query.length < 2) {
    return []
  }

  try {
    const results: Array<(UserProfile & { type: "user" }) | (Group & { type: "group" })> = []

    // Search users if not groups-only
    if (!groupsOnly) {
      const users = await searchUsers(query)
      results.push(...users.map((user) => ({ ...user, type: "user" as const })))
    }

    // Search groups
    const groups = await searchGroups(query)
    results.push(...groups.map((group) => ({ ...group, type: "group" as const })))

    return results
  } catch (error) {
    console.error("Error searching users and groups:", error)
    return []
  }
}
