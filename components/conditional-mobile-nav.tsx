"use client"

import { usePathname } from "next/navigation"
import { MobileBottomNav } from "./mobile-bottom-nav"

export function ConditionalMobileNav() {
  const pathname = usePathname()

  // Hide nav on auth pages
  const isAuthPage = pathname?.startsWith("/auth/")

  if (isAuthPage) {
    return null
  }

  return <MobileBottomNav />
}
