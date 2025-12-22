"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, BarChart, Plus, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"
import { useEffect, useState } from "react"

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
    }
    checkAuth()
  }, [])

  const navItems = [
    { href: "/", icon: Home, label: "Home", public: true },
    { href: "/my-bets", icon: BarChart, label: "My Bets", public: false },
    { href: "/create-market", icon: Plus, label: "Create", isSpecial: true, public: false },
    { href: "/markets", icon: Search, label: "Browse", public: true },
    { href: "/profile", icon: User, label: "Profile", public: false },
  ]

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900">
      <nav className="border-t border-gray-100 dark:border-gray-800 pb-[calc(env(safe-area-inset-bottom,0.5rem)+0.5rem)]">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const isDisabled = !item.public && !isLoggedIn

            if (item.isSpecial) {
              return (
                <Button
                  key={item.href}
                  asChild={!isDisabled}
                  size="sm"
                  disabled={isDisabled}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault()
                      router.push("/auth/login?redirect=" + item.href)
                    }
                  }}
                  className={cn(
                    "h-11 w-11 rounded-full shadow-md",
                    isDisabled
                      ? "bg-gray-300 dark:bg-gray-700 opacity-50 cursor-not-allowed"
                      : "bg-gray-900 hover:bg-gray-800",
                  )}
                >
                  {isDisabled ? (
                    <Icon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <Link href={item.href} prefetch={true}>
                      <Icon className="w-5 h-5 text-white" />
                    </Link>
                  )}
                </Button>
              )
            }

            return (
              <Button
                key={item.href}
                asChild={!isDisabled}
                variant="ghost"
                size="sm"
                disabled={isDisabled}
                onClick={(e) => {
                  if (isDisabled) {
                    e.preventDefault()
                    router.push("/auth/login?redirect=" + item.href)
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 h-14 px-3 rounded-lg",
                  isDisabled
                    ? "text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed"
                    : isActive
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-gray-500",
                )}
              >
                {isDisabled ? (
                  <>
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] font-medium">{item.label}</span>
                  </>
                ) : (
                  <Link href={item.href} prefetch={true}>
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] font-medium">{item.label}</span>
                  </Link>
                )}
              </Button>
            )
          })}
        </div>
      </nav>
      <div className="h-[env(safe-area-inset-bottom,0px)] bg-white dark:bg-gray-900" />
    </div>
  )
}
