import { getRDSPool } from "@/lib/database/rds"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  checks: {
    database: {
      status: "ok" | "error"
      latency?: number
      error?: string
      poolStats?: {
        total: number
        idle: number
        waiting: number
      }
    }
    memory: {
      status: "ok" | "warning"
      usage: number
      limit: number
      percentage: number
    }
  }
  uptime: number
}

export async function GET() {
  const startTime = Date.now()
  const health: HealthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: "ok" },
      memory: { status: "ok", usage: 0, limit: 0, percentage: 0 },
    },
    uptime: process.uptime(),
  }

  // Check database connection
  try {
    const pool = getRDSPool()
    const dbStart = Date.now()
    await pool.query("SELECT 1")
    const dbLatency = Date.now() - dbStart

    health.checks.database = {
      status: "ok",
      latency: dbLatency,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    }

    // Warn if latency is high
    if (dbLatency > 1000) {
      health.status = "degraded"
      health.checks.database.status = "error"
      health.checks.database.error = `High latency: ${dbLatency}ms`
    }

    // Warn if pool is exhausted
    if (pool.waitingCount > 5) {
      health.status = "degraded"
      health.checks.database.error = `Connection pool under pressure: ${pool.waitingCount} waiting`
    }
  } catch (error) {
    health.status = "unhealthy"
    health.checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Database connection failed",
    }
  }

  // Check memory usage
  const memUsage = process.memoryUsage()
  const memLimit = 512 * 1024 * 1024 // 512MB typical Vercel limit
  const memPercentage = (memUsage.heapUsed / memLimit) * 100

  health.checks.memory = {
    status: memPercentage > 80 ? "warning" : "ok",
    usage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    limit: Math.round(memLimit / 1024 / 1024), // MB
    percentage: Math.round(memPercentage),
  }

  if (memPercentage > 80) {
    health.status = "degraded"
  }

  // Return appropriate status code
  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Response-Time": `${Date.now() - startTime}ms`,
    },
  })
}
