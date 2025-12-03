"use server"

import { createClient } from "@/lib/supabase/server"
import { update } from "@/lib/database/adapter"
import { revalidatePath } from "next/cache"

export async function updateSlippageTolerance(slippageTolerance: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // Validate range
  if (slippageTolerance < 0.5 || slippageTolerance > 30) {
    return { success: false, error: "Slippage tolerance must be between 0.5% and 30%" }
  }

  try {
    await update("profiles", { slippage_tolerance: slippageTolerance }, { column: "id", value: user.id })

    revalidatePath("/profile")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating slippage tolerance:", error)
    return { success: false, error: "Failed to update slippage tolerance" }
  }
}
