"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { insert } from "@/lib/database/adapter"

export async function createGroup(name: string, description?: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const { data: group, error: groupError } = await insert("groups", {
      name: name.trim(),
      description: description?.trim() || null,
      creator_id: user.id,
    })

    if (groupError) {
      if (groupError.message?.includes("duplicate") || groupError.message?.includes("unique")) {
        return { success: false, error: "A group with this name already exists" }
      }
      return { success: false, error: groupError.message }
    }

    // Automatically join the creator to the group
    const { error: joinError } = await insert("user_groups", {
      user_id: user.id,
      group_id: Array.isArray(group) ? group[0].id : group.id,
    })

    if (joinError) {
      console.error("Failed to auto-join creator to group:", joinError)
      // Don't fail the whole operation if auto-join fails
    }

    revalidatePath("/profile")
    return { success: true, group: Array.isArray(group) ? group[0] : group }
  } catch (error) {
    console.error("Create group error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function joinGroup(groupId: string) {
  try {
    console.log("[v0] Join group action called for group:", groupId)
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log("[v0] Join group: No user authenticated")
      return { success: false, error: "Authentication required" }
    }

    console.log("[v0] Join group: User authenticated:", user.id)

    const { data, error } = await supabase
      .from("user_groups")
      .insert({
        user_id: user.id,
        group_id: groupId,
      })
      .select()

    console.log("[v0] Join group insert result:", { data, error: error?.message })

    if (error) {
      if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
        return { success: false, error: "You are already a member of this group" }
      }
      return { success: false, error: error.message }
    }

    revalidatePath("/profile")
    console.log("[v0] Join group: Success, revalidated path")
    return { success: true }
  } catch (error) {
    console.error("[v0] Join group error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function leaveGroup(groupId: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    // The adapter's deleteRows only supports single column where clause
    const { error } = await supabase.from("user_groups").delete().eq("user_id", user.id).eq("group_id", groupId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (error) {
    console.error("Leave group error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function searchGroups(query: string) {
  try {
    if (!query.trim()) {
      return { success: true, groups: [] }
    }

    // The adapter doesn't support ilike operator yet
    const supabase = await createClient()
    const { data: groups, error } = await supabase
      .from("groups")
      .select(
        `
        id,
        name,
        description,
        creator_id,
        created_at,
        profiles!groups_creator_id_fkey(username, display_name)
      `,
      )
      .ilike("name", `%${query.trim()}%`)
      .order("name")
      .limit(10)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, groups: groups || [] }
  } catch (error) {
    console.error("Search groups error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getUserGroups(userId?: string) {
  try {
    console.log("[v0] Get user groups called for userId:", userId)
    const supabase = await createClient()

    let targetUserId = userId
    if (!targetUserId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        console.log("[v0] Get user groups: No user authenticated")
        return { success: false, error: "Authentication required" }
      }
      targetUserId = user.id
    }

    console.log("[v0] Get user groups: Fetching for user:", targetUserId)

    // The adapter's select doesn't support Supabase-style nested joins
    const { data: userGroups, error } = await supabase
      .from("user_groups")
      .select(
        `
        id,
        joined_at,
        groups!user_groups_group_id_fkey(
          id,
          name,
          description,
          creator_id,
          created_at,
          profiles!groups_creator_id_fkey(username, display_name)
        )
      `,
      )
      .eq("user_id", targetUserId)
      .order("joined_at", { ascending: false })

    console.log("[v0] Get user groups result:", {
      groupsCount: userGroups?.length || 0,
      error: error?.message,
      groups: userGroups?.map((g) => ({ id: g.id, groupName: g.groups?.name })),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, groups: userGroups || [] }
  } catch (error) {
    console.error("[v0] Get user groups error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getGroupMembers(groupId: string) {
  try {
    console.log("[v0] Server action: Getting group members for group:", groupId)

    // Use service client to bypass RLS and get all group members
    const serviceSupabase = createServiceClient()

    const { data: members, error } = await serviceSupabase
      .from("user_groups")
      .select(`
        user_id,
        joined_at,
        profiles!user_groups_user_id_fkey(
          id,
          username,
          display_name
        )
      `)
      .eq("group_id", groupId)
      .order("joined_at", { ascending: false })

    console.log("[v0] Service query result:", {
      membersCount: members?.length || 0,
      error: error?.message,
      members: members?.map((m) => ({ user_id: m.user_id, username: m.profiles?.username })),
    })

    if (error) {
      console.error("[v0] Error getting group members:", error)
      return { success: false, error: error.message }
    }

    return { success: true, members: members || [] }
  } catch (error) {
    console.error("[v0] Get group members error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
