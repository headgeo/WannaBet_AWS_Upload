"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, BarChart, Plus, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/my-bets", icon: BarChart, label: "My Bets" },
    { href: "/create-market", icon: Plus, label: "Create", isSpecial: true },
    { href: "/markets", icon: Search, label: "Browse" },
    { href: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-t pb-[env(safe-area-inset-bottom,0.75rem)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          if (item.isSpecial) {
            return (
              <Button
                key={item.href}
                asChild
                size="sm"
                className="h-12 w-12 rounded-lg bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200"
              >
                <Link href={item.href}>
                  <Icon className="w-5 h-5 text-white dark:text-black" />
                </Link>
              </Button>
            )
          }

          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(
                "flex flex-col items-center gap-1 h-14 px-3",
                isActive && "text-blue-600 dark:text-blue-400",
              )}
            >
              <Link href={item.href}>
                <Icon className={cn("w-5 h-5", isActive && "text-blue-600 dark:text-blue-400")} />
                <span className="text-xs">{item.label}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
