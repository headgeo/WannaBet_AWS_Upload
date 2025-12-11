"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { insert, select, deleteRows } from "@/lib/database/adapter"

export async function createGroup(name: string, description?: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const { data: groupArray, error: groupError } = await insert("groups", {
      name: name.trim(),
      description: description?.trim() || null,
      creator_id: user.id,
    })

    if (groupError || !groupArray || groupArray.length === 0) {
      if (groupError?.message?.includes("duplicate") || groupError?.message?.includes("unique")) {
        return { success: false, error: "A group with this name already exists" }
      }
      return { success: false, error: groupError?.message || "Failed to create group" }
    }

    const group = groupArray[0]

    const existingMembership = await select<any>(
      "user_groups",
      ["id"],
      [
        { column: "user_id", value: user.id },
        { column: "group_id", value: group.id },
      ],
      undefined,
      1,
    )

    if (!existingMembership || existingMembership.length === 0) {
      const { error: joinError } = await insert("user_groups", {
        user_id: user.id,
        group_id: group.id,
      })

      if (joinError) {
        console.error("Failed to auto-join creator to group:", joinError)
      }
    }

    revalidatePath("/profile")
    return { success: true, group }
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
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const existingMembership = await select<any>(
      "user_groups",
      ["id"],
      [
        { column: "user_id", value: user.id },
        { column: "group_id", value: groupId },
      ],
      undefined,
      1,
    )

    if (existingMembership && existingMembership.length > 0) {
      return { success: false, error: "You are already a member of this group" }
    }

    const { data, error } = await insert("user_groups", {
      user_id: user.id,
      group_id: groupId,
    })

    if (error) {
      if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
        return { success: false, error: "You are already a member of this group" }
      }
      return { success: false, error: error.message }
    }

    revalidatePath("/profile")
    return { success: true }
  } catch (error) {
    console.error("Join group error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function leaveGroup(groupId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const result = await deleteRows("user_groups", {
      user_id: user.id,
      group_id: groupId,
    })

    if (result.rowCount === 0) {
      return { success: false, error: "You are not a member of this group" }
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

    const groups = await select<any>(
      "groups",
      ["id", "name", "description", "creator_id", "created_at"],
      [{ column: "name", operator: "ILIKE", value: `%${query.trim()}%` }],
      { column: "name", ascending: true },
      10,
    )

    if (!groups) {
      return { success: false, error: "Failed to search groups" }
    }

    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const profiles = await select<any>(
          "profiles",
          ["username", "display_name"],
          [{ column: "id", value: group.creator_id }],
          undefined,
          1,
        )
        return {
          ...group,
          profiles: profiles?.[0] || null,
        }
      }),
    )

    return { success: true, groups: enrichedGroups }
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
    const supabase = await createClient()

    let targetUserId = userId
    if (!targetUserId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        return { success: false, error: "Authentication required" }
      }
      targetUserId = user.id
    }

    const userGroups = await select<any>(
      "user_groups",
      ["id", "user_id", "group_id", "joined_at"],
      [{ column: "user_id", value: targetUserId }],
      { column: "joined_at", ascending: false },
    )

    if (!userGroups) {
      return { success: false, error: "Failed to fetch user groups" }
    }

    const groupIds = [...new Set(userGroups.map((ug) => ug.group_id))]

    const enrichedGroups = await Promise.all(
      groupIds.map(async (groupId) => {
        const groups = await select<any>(
          "groups",
          ["id", "name", "description", "creator_id", "created_at"],
          [{ column: "id", value: groupId }],
          undefined,
          1,
        )
        const group = groups?.[0]

        if (!group) {
          return null
        }

        const profiles = await select<any>(
          "profiles",
          ["id", "username", "display_name"],
          [{ column: "id", value: group.creator_id }],
          undefined,
          1,
        )

        const userGroupEntry = userGroups.find((ug) => ug.group_id === groupId)

        return {
          id: userGroupEntry?.id || groupId,
          user_id: targetUserId,
          group_id: groupId,
          joined_at: userGroupEntry?.joined_at,
          groups: {
            ...group,
            profiles: profiles?.[0] || null,
          },
        }
      }),
    )

    const validGroups = enrichedGroups.filter((g) => g !== null)

    return { success: true, groups: validGroups }
  } catch (error) {
    console.error("Get user groups error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getGroupMembers(groupId: string) {
  try {
    const members = await select<any>(
      "user_groups",
      ["user_id", "joined_at"],
      [{ column: "group_id", value: groupId }],
      { column: "joined_at", ascending: false },
    )

    if (!members) {
      return { success: false, error: "Failed to fetch group members" }
    }

    const enrichedMembers = await Promise.all(
      members.map(async (member) => {
        const profiles = await select<any>(
          "profiles",
          ["id", "username", "display_name"],
          [{ column: "id", value: member.user_id }],
          undefined,
          1,
        )
        return {
          ...member,
          profiles: profiles?.[0] || null,
        }
      }),
    )

    return { success: true, members: enrichedMembers }
  } catch (error) {
    console.error("Get group members error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
