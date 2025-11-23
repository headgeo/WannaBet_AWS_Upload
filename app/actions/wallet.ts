"use server"

import { createClient } from "@/lib/supabase/server"
import { select, update, insert } from "@/lib/database/adapter"
import { revalidatePath } from "next/cache"

const DEPOSIT_AMOUNT = 50
const WITHDRAW_AMOUNT = 50

export async function depositFunds() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    // Get current profile
    const profiles = await select("profiles", "*", [{ column: "id", value: user.id }])
    if (!profiles || profiles.length === 0) {
      return { success: false, error: "Profile not found" }
    }

    const profile = profiles[0]
    const balanceBefore = Number(profile.balance)
    const balanceAfter = balanceBefore + DEPOSIT_AMOUNT

    console.log("[v0] Deposit starting:", { userId: user.id, balanceBefore, balanceAfter })

    // Update balance
    await update("profiles", { balance: balanceAfter }, { column: "id", value: user.id })
    console.log("[v0] Profile balance updated")

    // Record in deposit_withdraw table
    try {
      await insert("deposit_withdraw", {
        user_id: user.id,
        type: "deposit",
        amount: DEPOSIT_AMOUNT,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        metadata: JSON.stringify({ method: "manual_deposit" }),
      })
      console.log("[v0] Deposit record created in deposit_withdraw table")
    } catch (error) {
      console.error("[v0] Error inserting into deposit_withdraw:", error)
      // Continue execution - ledger entry will still be created by trigger if table exists
    }

    // Create notification
    await insert("notifications", {
      user_id: user.id,
      type: "deposit",
      title: "Deposit Successful",
      message: `$${DEPOSIT_AMOUNT.toFixed(2)} has been deposited to your account`,
      is_read: false,
    })

    revalidatePath("/wallet")
    console.log("[v0] Deposit completed successfully")
    return { success: true, newBalance: balanceAfter }
  } catch (error) {
    console.error("[v0] Deposit error:", error)
    return { success: false, error: "Failed to process deposit" }
  }
}

export async function withdrawFunds() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    // Get current profile
    const profiles = await select("profiles", "*", [{ column: "id", value: user.id }])
    if (!profiles || profiles.length === 0) {
      return { success: false, error: "Profile not found" }
    }

    const profile = profiles[0]
    const balanceBefore = Number(profile.balance)

    if (balanceBefore < WITHDRAW_AMOUNT) {
      return { success: false, error: `Insufficient balance. You need at least $${WITHDRAW_AMOUNT.toFixed(2)}` }
    }

    const balanceAfter = balanceBefore - WITHDRAW_AMOUNT

    console.log("[v0] Withdrawal starting:", { userId: user.id, balanceBefore, balanceAfter })

    // Update balance
    await update("profiles", { balance: balanceAfter }, { column: "id", value: user.id })
    console.log("[v0] Profile balance updated")

    // Record in deposit_withdraw table
    try {
      await insert("deposit_withdraw", {
        user_id: user.id,
        type: "withdraw",
        amount: WITHDRAW_AMOUNT,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        metadata: JSON.stringify({ method: "manual_withdraw" }),
      })
      console.log("[v0] Withdrawal record created in deposit_withdraw table")
    } catch (error) {
      console.error("[v0] Error inserting into deposit_withdraw:", error)
      // Continue execution
    }

    // Create notification
    await insert("notifications", {
      user_id: user.id,
      type: "withdraw",
      title: "Withdrawal Successful",
      message: `$${WITHDRAW_AMOUNT.toFixed(2)} has been withdrawn from your account`,
      is_read: false,
    })

    revalidatePath("/wallet")
    console.log("[v0] Withdrawal completed successfully")
    return { success: true, newBalance: balanceAfter }
  } catch (error) {
    console.error("[v0] Withdrawal error:", error)
    return { success: false, error: "Failed to process withdrawal" }
  }
}

export async function getDepositWithdrawHistory() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  try {
    const history = await select(
      "deposit_withdraw",
      "*",
      [{ column: "user_id", value: user.id }],
      "created_at DESC"
    )
    return history || []
  } catch (error) {
    console.error("Error fetching history:", error)
    return []
  }
}
