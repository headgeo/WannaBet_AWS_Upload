"use client"

import { Button } from "@/components/ui/button"
import { Wallet, Shield } from "lucide-react"
import Link from "next/link"
import { NotificationBell } from "@/components/notifications"
import { ModeToggle } from "@/components/mode-toggle"
import { useIsAdmin } from "@/lib/auth/admin-client"

interface MobileHeaderProps {
  showModeToggle?: boolean
  onModeChange?: (mode: "Trader" | "Earner") => void
  userId?: string
  userIsAdmin?: boolean
}

export default function MobileHeader({
  showModeToggle = false,
  onModeChange,
  userId,
  userIsAdmin = false,
}: MobileHeaderProps) {
  const { isAdmin } = useIsAdmin()
  const isLoggedIn = !!userId
  const showAdminIcon = isLoggedIn && (userIsAdmin || isAdmin)

  return (
    <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
      <div className="px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-2 flex-shrink-0">
            {showModeToggle && onModeChange && <ModeToggle onModeChange={onModeChange} />}
          </div>

          <nav className="flex items-center gap-1">
            {!isLoggedIn ? (
              <>
                <Button variant="ghost" size="sm" asChild className="text-xs">
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg transition-all text-xs"
                >
                  <Link href="/auth/sign-up">Sign Up</Link>
                </Button>
              </>
            ) : (
              <>
                {showAdminIcon && (
                  <Button variant="ghost" asChild size="sm" className="text-gray-500">
                    <Link href="/admin" className="px-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" asChild size="sm" className="text-gray-500">
                  <Link href="/wallet" className="px-2">
                    <Wallet className="w-4 h-4" />
                  </Link>
                </Button>
                <NotificationBell />
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

export { MobileHeader }
