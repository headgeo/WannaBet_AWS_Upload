import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { ConditionalMobileNav } from "@/components/conditional-mobile-nav"
import { LoadingSpinner } from "@/components/loading-spinner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "WannaBet - Prediction Markets",
  description: "Make Markets. Trade Odds. Earn Fees.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Suspense fallback={<LoadingSpinner message="Loading..." />}>
          {children}
          <Analytics />
          <ConditionalMobileNav />
        </Suspense>
      </body>
    </html>
  )
}
