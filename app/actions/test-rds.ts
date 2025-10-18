"use server"

import { query } from "@/lib/database/rds"

export async function testRDSConnection() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment_variables: {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    },
    tests: [] as any[],
  }

  try {
    // Test 1: Connection
    const timeResult = await query("SELECT NOW() as current_time")
    diagnostics.tests.push({
      name: "Connection Test",
      status: "passed",
      result: `Connected at ${timeResult.rows[0].current_time}`,
    })

    // Test 2: Tables
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    diagnostics.tests.push({
      name: "Tables Check",
      status: "passed",
      result: `Found ${tablesResult.rows.length} tables`,
      tables: tablesResult.rows.map((r) => r.table_name),
    })

    // Test 3: Data counts
    const profilesCount = await query("SELECT COUNT(*) FROM profiles")
    const marketsCount = await query("SELECT COUNT(*) FROM markets")
    diagnostics.tests.push({
      name: "Data Check",
      status: "passed",
      result: {
        profiles: profilesCount.rows[0].count,
        markets: marketsCount.rows[0].count,
      },
    })

    return {
      success: true,
      message: "AWS RDS is working correctly!",
      diagnostics,
    }
  } catch (error: any) {
    return {
      success: false,
      message: "AWS RDS connection failed",
      error: error.message,
      diagnostics,
    }
  }
}
