import { Pool, type PoolClient } from "pg"

// Singleton pool instance
let pool: Pool | null = null

/**
 * Get or create PostgreSQL connection pool for AWS RDS
 * Uses connection pooling for efficient database connections
 */
export function getRDSPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING

    if (!connectionString) {
      throw new Error(
        "No PostgreSQL connection string found. Please set one of: POSTGRES_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL_NON_POOLING",
      )
    }

    try {
      const url = new URL(connectionString)

      if (!url.hostname || url.hostname === "base") {
        throw new Error(
          `Invalid hostname in connection string: "${url.hostname}". Expected format: postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/database_name`,
        )
      }

      if (!url.username || !url.password) {
        throw new Error("Connection string must include username and password")
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Invalid POSTGRES_URL format. Expected: postgresql://username:password@host:5432/database`)
      }
      throw error
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[RDS] Initializing connection pool")
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Set to false for AWS RDS connections
      },
      max: 25, // Increased from 5 to 25 for better concurrency
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    })

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("[RDS] Unexpected pool error:", err.message)
    })

    pool.query("SELECT NOW()").catch((err) => console.error("[RDS] Pool initialization failed:", err.message))
  }

  return pool
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getRDSPool()
  const start = Date.now()

  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start

    if (duration > 1000) {
      console.warn("[RDS] Slow query:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
      })
    }

    return result
  } catch (error) {
    console.error("[RDS] Query error:", (error as Error).message)
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getRDSPool()
  return await pool.connect()
}

/**
 * Execute a function within a transaction
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient()

  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/**
 * Close the pool (useful for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
