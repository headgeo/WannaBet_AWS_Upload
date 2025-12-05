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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom,0.5rem)]">
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
                className="h-11 w-11 rounded-full bg-gray-900 hover:bg-gray-800 shadow-md"
              >
                <Link href={item.href} prefetch={true}>
                  <Icon className="w-5 h-5 text-white" />
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
                "flex flex-col items-center gap-0.5 h-14 px-3 rounded-lg",
                isActive ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500",
              )}
            >
              <Link href={item.href} prefetch={true}>
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
