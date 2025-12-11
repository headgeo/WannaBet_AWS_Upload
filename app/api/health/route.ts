import { NextResponse } from "next/server"
import { query } from "@/lib/database/adapter"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: {
      status: "up" | "down"
      responseTime: number
      connectionPool?: {
        active: number
        idle: number
        total: number
      }
    }
    auth: {
      status: "up" | "down"
      responseTime: number
    }
    memory: {
      used: number
      total: number
      percentage: number
    }
  }
  metrics?: {
    activeMarkets: number
    totalUsers: number
    pendingSettlements: number
  }
}

const startTime = Date.now()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const detailed = searchParams.get("detailed") === "true"

  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: "down", responseTime: 0 },
      auth: { status: "down", responseTime: 0 },
      memory: { used: 0, total: 0, percentage: 0 },
    },
  }

  // Check database connectivity
  const dbStart = Date.now()
  try {
    const result = await query("SELECT 1 as health_check, NOW() as server_time")
    health.checks.database = {
      status: "up",
      responseTime: Date.now() - dbStart,
    }
  } catch (error) {
    health.checks.database = {
      status: "down",
      responseTime: Date.now() - dbStart,
    }
    health.status = "unhealthy"
  }

  // Check auth service
  const authStart = Date.now()
  try {
    const supabase = await createClient()
    await supabase.auth.getSession()
    health.checks.auth = {
      status: "up",
      responseTime: Date.now() - authStart,
    }
  } catch (error) {
    health.checks.auth = {
      status: "down",
      responseTime: Date.now() - authStart,
    }
    health.status = health.status === "healthy" ? "degraded" : health.status
  }

  // Check memory usage
  if (typeof process !== "undefined" && process.memoryUsage) {
    const mem = process.memoryUsage()
    health.checks.memory = {
      used: Math.round(mem.heapUsed / 1024 / 1024),
      total: Math.round(mem.heapTotal / 1024 / 1024),
      percentage: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    }

    if (health.checks.memory.percentage > 95) {
      health.status = health.status === "healthy" ? "degraded" : health.status
    }
  }

  // Fetch additional metrics if detailed mode requested
  if (detailed && health.checks.database.status === "up") {
    try {
      const [marketsResult, usersResult, settlementsResult] = await Promise.all([
        query("SELECT COUNT(*) as count FROM markets WHERE status = 'active'"),
        query("SELECT COUNT(*) as count FROM profiles"),
        query("SELECT COUNT(*) as count FROM settlement_contests WHERE status = 'pending'"),
      ])

      health.metrics = {
        activeMarkets: Number.parseInt(marketsResult.rows[0]?.count || "0"),
        totalUsers: Number.parseInt(usersResult.rows[0]?.count || "0"),
        pendingSettlements: Number.parseInt(settlementsResult.rows[0]?.count || "0"),
      }
    } catch (error) {
      // Metrics are optional, don't fail health check
    }
  }

  // Determine overall status based on response times
  if (health.status === "healthy") {
    if (health.checks.database.responseTime > 1000 || health.checks.auth.responseTime > 1000) {
      health.status = "degraded"
    }
  }

  // Return appropriate HTTP status
  const httpStatus = health.status === "unhealthy" ? 503 : 200

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
