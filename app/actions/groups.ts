"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { insert, select, deleteRows } from "@/lib/database/adapter"

export async function createGroup(name: string, description?: string) {
  try {
    console.log("[v0] createGroup called with:", { name, description })
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log("[v0] createGroup: User authentication result:", {
      userId: user?.id,
      error: userError?.message,
    })

    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    console.log("[v0] createGroup: Attempting to insert group into AWS RDS...")
    const { data: groupArray, error: groupError } = await insert("groups", {
      name: name.trim(),
      description: description?.trim() || null,
      creator_id: user.id,
    })

    console.log("[v0] createGroup: Insert result:", {
      group: groupArray,
      error: groupError?.message,
      errorDetails: groupError,
    })

    if (groupError || !groupArray || groupArray.length === 0) {
      if (groupError?.message?.includes("duplicate") || groupError?.message?.includes("unique")) {
        return { success: false, error: "A group with this name already exists" }
      }
      return { success: false, error: groupError?.message || "Failed to create group" }
    }

    const group = groupArray[0]
    console.log("[v0] createGroup: Group created with ID:", group.id)

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
      console.log("[v0] createGroup: Auto-joining creator to group...")
      const { error: joinError } = await insert("user_groups", {
        user_id: user.id,
        group_id: group.id,
      })

      console.log("[v0] createGroup: Auto-join result:", { error: joinError?.message })

      if (joinError) {
        console.error("Failed to auto-join creator to group:", joinError)
      }
    } else {
      console.log("[v0] createGroup: User already in group, skipping auto-join")
    }

    revalidatePath("/profile")
    console.log("[v0] createGroup: Success! Returning group:", group)
    return { success: true, group }
  } catch (error) {
    console.error("[v0] Create group error:", error)
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log("[v0] Join group: No user authenticated")
      return { success: false, error: "Authentication required" }
    }

    console.log("[v0] Join group: User authenticated:", user.id)

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
      console.log("[v0] Join group: User already in group")
      return { success: false, error: "You are already a member of this group" }
    }

    const { data, error } = await insert("user_groups", {
      user_id: user.id,
      group_id: groupId,
    })

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: "Authentication required" }
    }

    const { error } = await deleteRows("user_groups", {
      user_id: user.id,
      group_id: groupId,
    })

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

    console.log("[v0] Get user groups: Fetching from AWS RDS for user:", targetUserId)

    const userGroups = await select<any>(
      "user_groups",
      ["id", "user_id", "group_id", "joined_at"],
      [{ column: "user_id", value: targetUserId }],
      { column: "joined_at", ascending: false },
    )

    if (!userGroups) {
      return { success: false, error: "Failed to fetch user groups" }
    }

    console.log("[v0] Get user groups: Found user_groups:", userGroups.length)

    const groupIds = [...new Set(userGroups.map((ug) => ug.group_id))]
    console.log("[v0] Get user groups: Unique group IDs:", groupIds.length)

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
          console.log("[v0] Get user groups: Group not found for ID:", groupId)
          return null
        }

        const profiles = await select<any>(
          "profiles",
          ["id", "username", "display_name"],
          [{ column: "id", value: group.creator_id }],
          undefined,
          1,
        )

        // Find the most recent user_groups entry for this group
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

    console.log("[v0] Get user groups result:", {
      groupsCount: validGroups.length,
      groups: validGroups.map((g) => ({ id: g.group_id, groupName: g.groups?.name })),
    })

    return { success: true, groups: validGroups }
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

    console.log("[v0] Service query result:", {
      membersCount: enrichedMembers.length,
      members: enrichedMembers.map((m) => ({ user_id: m.user_id, username: m.profiles?.username })),
    })

    return { success: true, members: enrichedMembers }
  } catch (error) {
    console.error("[v0] Get group members error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
