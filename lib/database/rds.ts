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

    try {
      const url = new URL(connectionString)
      console.log("[RDS] Connection string validation:", {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || "5432",
        database: url.pathname.slice(1),
        hasUsername: !!url.username,
        hasPassword: !!url.password,
      })

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
        throw new Error(
          `Invalid POSTGRES_URL format. Expected: postgresql://username:password@host:5432/database\nGot: ${connectionString.replace(/:[^:@]+@/, ":****@")}`,
        )
      }
      throw error
    }

    console.log("[RDS] Initializing connection pool")

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Set to false for AWS RDS connections
      },
      max: 50, // Increased from 20 to 50 for better concurrency
      min: 5, // Keep 5 connections warm
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Reduced from 10s to 5s for faster failure
      statement_timeout: 30000, // 30 second query timeout
      query_timeout: 30000, // 30 second query timeout
    })

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("[RDS Pool] Unexpected error on idle client", err)
    })

    pool.on("connect", () => {
      console.log("[RDS Pool] New client connected")
    })

    pool.on("remove", () => {
      console.log("[RDS Pool] Client removed from pool")
    })

    pool
      .query("SELECT NOW()")
      .then(() => console.log("[RDS] Connection pool initialized successfully"))
      .catch((err) => console.error("[RDS] Failed to initialize connection pool:", err))
  }

  return pool
}

/**
 * Execute a query with automatic connection management and timeout protection
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getRDSPool()
  const start = Date.now()

  try {
    // Add statement timeout to prevent long-running queries
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout after 30 seconds")), 30000)
    })

    const queryPromise = pool.query(text, params)
    const result = await Promise.race([queryPromise, timeoutPromise])

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
    const duration = Date.now() - start
    console.error("[RDS] Query error:", {
      error,
      duration: `${duration}ms`,
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
