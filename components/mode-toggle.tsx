"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const [mode, setMode] = useState<"Trader" | "Earner">("Trader")

  const toggleMode = () => {
    setMode((prev) => (prev === "Trader" ? "Earner" : "Trader"))
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
