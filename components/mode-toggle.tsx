"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface ModeToggleProps {
  onModeChange?: (mode: "Trader" | "Earner") => void
}

export function ModeToggle({ onModeChange }: ModeToggleProps) {
  const [mode, setMode] = useState<"Trader" | "Earner">("Trader")

  const toggleMode = () => {
    const newMode = mode === "Trader" ? "Earner" : "Trader"
    setMode(newMode)
    onModeChange?.(newMode)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleMode}
      className="gap-2 bg-background border-input hover:bg-accent transition-all"
    >
      {mode}
    </Button>
  )
}
