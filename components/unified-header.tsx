"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@supabase/ssr"
import { Wallet, Home, Search, Briefcase, User, ShieldCheck, Plus, LogOut } from "lucide-react"
import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notifications"

interface UnifiedHeaderProps {
  userId?: string
  userIsAdmin?: boolean
  onModeChange?: (mode: "Trader" | "Earner") => void
}

export default function UnifiedHeader({ userId, userIsAdmin = false, onModeChange }: UnifiedHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isLoggedIn = !!userId
  const isHomePage = pathname === "/"

  const navItems = [
    { href: "/", label: "Home", icon: Home, public: true },
    { href: "/markets", label: "Browse Markets", icon: Search, public: true },
    { href: "/my-bets", label: "My Bets", icon: Briefcase, public: false },
    { href: "/profile", label: "Profile", icon: User, public: false },
  ]

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Sign out error:", error)
        alert("Failed to sign out. Please try again.")
        return
      }

      window.location.href = "/auth/login"
    } catch (error) {
      console.error("Sign out error:", error)
      alert("Failed to sign out. Please try again.")
    }
  }

  return (
    <header className="hidden md:block bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6 flex-shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">WannaBet</h1>
              <Badge
                variant="secondary"
                className="text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-0"
              >
                Beta
              </Badge>
            </Link>
            {isHomePage && isLoggedIn && (
              <div className="md:block">
                <ModeToggle onModeChange={onModeChange} />
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isDisabled = !item.public && !isLoggedIn

              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  asChild={!isDisabled}
                  disabled={isDisabled}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault()
                      router.push("/auth/login?redirect=" + item.href)
                    }
                  }}
                  className={cn(
                    "text-xs font-medium transition-colors",
                    isDisabled
                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50"
                      : pathname === item.href
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
                  )}
                >
                  {isDisabled ? (
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-4 h-4 lg:hidden" />
                      <span className="hidden lg:inline">{item.label}</span>
                    </span>
                  ) : (
                    <Link href={item.href} className="flex items-center gap-1.5">
                      <Icon className="w-4 h-4 lg:hidden" />
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                  )}
                </Button>
              )
            })}
            {isLoggedIn && userIsAdmin && (
              <Button
                variant="ghost"
                asChild
                className={cn(
                  "text-xs font-medium",
                  pathname === "/admin"
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
                )}
              >
                <Link href="/admin" className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                  <span className="hidden lg:inline">Admin</span>
                </Link>
              </Button>
            )}
          </nav>

          <div className="flex items-center space-x-2">
            {!isLoggedIn ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all text-xs"
                >
                  <Link href="/auth/sign-up">Sign Up</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild size="sm" className="text-gray-600 dark:text-gray-400">
                  <Link href="/wallet" className="px-2">
                    <Wallet className="w-4 h-4" />
                  </Link>
                </Button>
                <NotificationBell />
                {isHomePage && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all text-xs"
                  >
                    <Link href="/create-market">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create
                    </Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
