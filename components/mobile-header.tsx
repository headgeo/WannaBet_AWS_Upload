"use client"

import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"
import Link from "next/link"
import { NotificationBell } from "@/components/notifications"
import { ModeToggle } from "@/components/mode-toggle"

interface MobileHeaderProps {
  showModeToggle?: boolean
  onModeChange?: (mode: "Trader" | "Earner") => void
}

export function MobileHeader({ showModeToggle = false, onModeChange }: MobileHeaderProps) {
  return (
    <header className="md:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-2 flex-shrink-0">
            {showModeToggle && onModeChange && <ModeToggle onModeChange={onModeChange} />}
          </div>

          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild size="sm">
              <Link href="/wallet" className="px-2">
                <Wallet className="w-4 h-4" />
              </Link>
            </Button>
            <NotificationBell />
          </nav>
        </div>
      </div>
    </header>
  )
}
