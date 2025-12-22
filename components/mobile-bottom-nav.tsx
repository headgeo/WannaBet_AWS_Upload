"use client"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, BarChart, Plus, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/my-bets", icon: BarChart, label: "My Bets" },
    { href: "/create-market", icon: Plus, label: "Create", isSpecial: true },
    { href: "/markets", icon: Search, label: "Browse" },
    { href: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-6 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          if (item.isSpecial) {
            return (
              <Button
                key={item.href}
                size="sm"
                onClick={() => router.push(item.href)}
                className="h-11 w-11 rounded-full shadow-md bg-gray-900 hover:bg-gray-800"
              >
                <Icon className="w-5 h-5 text-white" />
              </Button>
            )
          }

          return (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              onClick={() => router.push(item.href)}
              className={cn(
                "flex flex-col items-center gap-0.5 h-14 px-3 rounded-lg",
                isActive ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500",
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
