"use server"

import { insert, update, select } from "@/lib/database/adapter"
import { createClient } from "@/lib/supabase/server"
import { calculateBFromLiquidity } from "@/lib/lmsr"
import { revalidatePath } from "next/cache"
import { recordMarketCreationReward } from "@/lib/platform-ledger"

export async function getUserBalance() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { error: "Not authenticated" }
    }

    const profileData = await select("profiles", "balance", [{ column: "id", operator: "eq", value: user.id }])

    return { balance: Number.parseFloat(profileData?.[0]?.balance || "0") }
  } catch (error: any) {
    console.error("[v0] Error loading user balance:", error)
    return { error: error.message }
  }
}

interface CreateMarketData {
  title: string
  description: string
  category: string
  endDate: string
  isPrivate: boolean
  invitedItems: Array<{ id: string; name: string; type: "user" | "group"; display_name?: string }>
  liquidityAmount: number
}

export async function createMarket(data: CreateMarketData) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { error: "You must be logged in to create a market" }
    }

    // Get user balance
    const profileData = await select("profiles", "balance", [{ column: "id", operator: "eq", value: user.id }])
    const userBalance = Number.parseFloat(profileData?.[0]?.balance || "0")

    // Validate balance
    if (data.liquidityAmount > userBalance) {
      return { error: "Insufficient balance" }
    }

    const endDateTime = new Date(data.endDate)

    const UMA_COLLATERAL = 10 // $10 reserved for UMA proposal reward
    const isPublicMarket = !data.isPrivate

    let liquidityForPool = data.liquidityAmount // Amount that goes into liquidity_pool
    let liquidityForReward = 0 // Amount set aside for UMA reward

    if (isPublicMarket) {
      // For public markets, deduct $10 for UMA reward
      liquidityForReward = UMA_COLLATERAL
      liquidityForPool = data.liquidityAmount - UMA_COLLATERAL

      if (liquidityForPool < 10) {
        return { error: "Public markets require at least $20 in liquidity ($10 for UMA, $10+ for trading)" }
      }
    }

    // Calculate b-value using ONLY the pool liquidity (which is already reduced by $10)
    const calculatedB = calculateBFromLiquidity(liquidityForPool)

    console.log("[v0] Market liquidity split:", {
      isPublic: isPublicMarket,
      totalPosted: data.liquidityAmount,
      liquidityForPool,
      liquidityForReward,
      calculatedB,
    })

    const invitedGroups = data.invitedItems.filter((item) => item.type === "group")
    const groupId = data.isPrivate && invitedGroups.length > 0 ? invitedGroups[0].id : null

    console.log("[v0] Creating market with group_id:", groupId)

    // Create market
    const market = await insert("markets", {
      title: data.title,
      description: data.description,
      category: data.category,
      end_date: endDateTime.toISOString(),
      creator_id: user.id,
      is_private: data.isPrivate,
      invited_user_id: null,
      status: "active",
      total_volume: 0,
      yes_shares: 0,
      no_shares: 0,
      qy: 0,
      qn: 0,
      liquidity_pool: liquidityForPool,
      liquidity_posted_for_reward: liquidityForReward,
      b: calculatedB,
      group_id: groupId,
      blockchain_status: isPublicMarket ? "not_deployed" : null, // Public markets show as not_deployed
    })

    if (market.error || !market.data || market.data.length === 0) {
      return { error: market.error?.message || "Failed to create market" }
    }

    const createdMarket = market.data[0]

    await insert("market_price_history", {
      market_id: createdMarket.id,
      yes_probability: 0.5,
      no_probability: 0.5,
      qy: 0,
      qn: 0,
      total_volume: 0,
    })

    // Record transaction
    const transactionResult = await insert("transactions", {
      user_id: user.id,
      market_id: createdMarket.id,
      type: "market_creation",
      amount: -data.liquidityAmount, // Full amount deducted from balance
      description: `Created market: ${data.title} (Liquidity: $${liquidityForPool}${isPublicMarket ? `, $${liquidityForReward} for UMA reward` : ""})`,
    })

    console.log("[v0] Transaction result:", transactionResult)

    // Update user balance
    const updateResult = await update(
      "profiles",
      { balance: userBalance - data.liquidityAmount },
      { column: "id", operator: "eq", value: user.id },
    )

    if (updateResult.error) {
      return { error: `Failed to update balance: ${updateResult.error.message}` }
    }

    // Add participants for private markets
    if (data.isPrivate) {
      const allParticipants = []

      // Add creator
      allParticipants.push({
        market_id: createdMarket.id,
        user_id: user.id,
        role: "creator",
        status: "accepted",
        group_id: null,
      })

      // Add invited users
      for (const item of data.invitedItems) {
        if (item.type === "user") {
          const existingUser = allParticipants.find((p) => p.user_id === item.id)
          if (!existingUser) {
            allParticipants.push({
              market_id: createdMarket.id,
              user_id: item.id,
              role: "participant",
              status: "accepted",
              group_id: null,
            })
          }
        }
      }

      if (allParticipants.length > 0) {
        const participantsResult = await insert("market_participants", allParticipants)
        if (participantsResult.error) {
          return { error: `Failed to add participants: ${participantsResult.error.message}` }
        }
      }

      // Send notifications to group members
      if (groupId) {
        const groupMembers = await select("user_groups", "user_id", [
          { column: "group_id", operator: "eq", value: groupId },
        ])

        if (groupMembers) {
          const notifications = groupMembers
            .filter((member) => member.user_id !== user.id)
            .map((member) => ({
              user_id: member.user_id,
              market_id: createdMarket.id,
              type: "new_market",
              title: "New Private Market Created",
              message: `A new private market "${data.title}" has been created in your group. Start trading now!`,
            }))

          if (notifications.length > 0) {
            await insert("notifications", notifications)
          }
        }
      }
    }

    revalidatePath("/")
    revalidatePath("/markets")

    // Record platform ledger entry for market creation reward (not deployed yet)
    if (isPublicMarket && liquidityForReward > 0) {
      console.log("[v0] Recording platform ledger entry for market creation reward (not deployed yet)")
      await recordMarketCreationReward(createdMarket.id, user.id, liquidityForReward)
    }

    return { success: true, marketId: createdMarket.id }
  } catch (error: any) {
    console.error("[v0] Error creating market:", error)
    return { error: error.message }
  }
}
