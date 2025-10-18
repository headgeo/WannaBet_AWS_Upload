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

    console.log("[RDS] Available env vars:", {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      selected: connectionString ? "found" : "not found",
    })

    if (!connectionString) {
      throw new Error(
        "No PostgreSQL connection string found. Please set one of: POSTGRES_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL_NON_POOLING",
      )
    }

    console.log("[RDS] Initializing connection pool")

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Set to false for AWS RDS connections
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
    })

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("[RDS Pool] Unexpected error on idle client", err)
    })

    pool
      .query("SELECT NOW()")
      .then(() => console.log("[RDS] Connection pool initialized successfully"))
      .catch((err) => console.error("[RDS] Failed to initialize connection pool:", err))
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

    // Log slow queries (over 1 second)
    if (duration > 1000) {
      console.warn("[RDS] Slow query detected:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
      })
    }

    return result
  } catch (error) {
    console.error("[RDS] Query error:", {
      error,
      query: text.substring(0, 100),
    })
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
