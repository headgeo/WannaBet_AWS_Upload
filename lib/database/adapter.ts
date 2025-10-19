/**
 * Database adapter for AWS RDS PostgreSQL
 * All data operations use AWS RDS. Supabase is only used for authentication.
 */

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { query as rdsQuery, transaction as rdsTransaction } from "./rds"
import type { PoolClient } from "pg"

const USE_RDS = !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING)

console.log("[Adapter] Database mode:", USE_RDS ? "AWS RDS (with Supabase fallback)" : "Supabase only")
console.log("[Adapter] Environment check:", {
  POSTGRES_URL: !!process.env.POSTGRES_URL,
  POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
  POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
})

export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
}

/**
 * Execute a raw SQL query
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  if (USE_RDS) {
    try {
      return await rdsQuery(sql, params)
    } catch (error: any) {
      if (error.message?.includes("Connection terminated") || error.message?.includes("timeout")) {
        console.warn("[Adapter] RDS connection failed, falling back to Supabase")
        throw new Error(
          "AWS RDS connection failed. Please check your network configuration. See AWS_RDS_NETWORK_SETUP.md for help.",
        )
      }
      throw error
    }
  }

  throw new Error("Direct SQL queries not supported with Supabase. Use Supabase client methods.")
}

/**
 * Execute an INSERT and return the inserted row(s)
 */
export async function insert<T = any>(
  table: string,
  data: Record<string, any> | Record<string, any>[],
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    const records = Array.isArray(data) ? data : [data]
    if (records.length === 0) {
      return { data: [], error: null }
    }

    const keys = Object.keys(records[0])
    const values = records.map((record) => keys.map((key) => record[key]))
    const placeholders = records
      .map((_, i) => `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(", ")})`)
      .join(", ")

    const sql = `
      INSERT INTO ${table} (${keys.join(", ")})
      VALUES ${placeholders}
      RETURNING *
    `
    const flatValues = values.flat()
    const result = await rdsQuery(sql, flatValues)
    return { data: result.rows as T[], error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Execute an UPDATE and return the updated row(s)
 */
export async function update<T = any>(
  table: string,
  data: Record<string, any>,
  where: { column: string; operator?: string; value: any },
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    const keys = Object.keys(data)
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ")
    const values = keys.map((key) => data[key])

    const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${where.column} = $${keys.length + 1}
      RETURNING *
    `
    const result = await rdsQuery(sql, [...values, where.value])
    return { data: result.rows as T[], error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Execute a DELETE and return the deleted row(s)
 */
export async function deleteRows<T = any>(
  table: string,
  where: { column: string; value: any },
): Promise<QueryResult<T>> {
  const sql = `
    DELETE FROM ${table}
    WHERE ${where.column} = $1
    RETURNING *
  `
  return await rdsQuery(sql, [where.value])
}

/**
 * Execute a SELECT query with WHERE clause
 */
export async function select<T = any>(
  table: string,
  columns: string | string[] = "*",
  where?: Array<{ column: string; operator?: string; value: any }>,
  orderBy?: { column: string; ascending?: boolean },
  limit?: number,
): Promise<T[]> {
  if (USE_RDS) {
    try {
      const columnsStr = Array.isArray(columns) ? columns.join(", ") : columns
      let sql = `SELECT ${columnsStr} FROM ${table}`
      const params: any[] = []
      let paramIndex = 1

      if (where && where.length > 0) {
        const whereClause = where
          .map((w) => {
            let operator = w.operator || "="
            if (operator === "eq") operator = "="
            if (operator === "neq") operator = "!="

            if (w.value === null) {
              if (operator === "=") {
                return `${w.column} IS NULL`
              } else if (operator === "!=") {
                return `${w.column} IS NOT NULL`
              }
            }

            if (operator === "not.in") {
              params.push(w.value)
              return `${w.column} NOT IN ($${paramIndex++})`
            } else if (operator === "in" || operator === "IN") {
              const values = Array.isArray(w.value) ? w.value : [w.value]
              const placeholders = values.map(() => `$${paramIndex++}`).join(", ")
              params.push(...values)
              return `${w.column} IN (${placeholders})`
            } else {
              params.push(w.value)
              return `${w.column} ${operator} $${paramIndex++}`
            }
          })
          .join(" AND ")
        sql += ` WHERE ${whereClause}`
      }

      if (orderBy) {
        sql += ` ORDER BY ${orderBy.column} ${orderBy.ascending !== false ? "ASC" : "DESC"}`
      }

      if (limit) {
        sql += ` LIMIT ${limit}`
      }

      const result = await rdsQuery(sql, params)
      return result.rows as T[]
    } catch (error: any) {
      if (error.message?.includes("Connection terminated") || error.message?.includes("timeout")) {
        console.warn("[Adapter] RDS connection failed, falling back to Supabase for select query")
        // Fallback to Supabase
        const supabase = createSupabaseClient()
        let query = supabase.from(table).select(Array.isArray(columns) ? columns.join(", ") : columns)

        if (where) {
          where.forEach((w) => {
            if (w.value === null) {
              query = query.is(w.column, null)
            } else if (w.operator === "in" || w.operator === "IN") {
              query = query.in(w.column, Array.isArray(w.value) ? w.value : [w.value])
            } else {
              query = query.eq(w.column, w.value)
            }
          })
        }

        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending !== false })
        }

        if (limit) {
          query = query.limit(limit)
        }

        const { data, error } = await query
        if (error) throw error
        return (data as T[]) || []
      }
      throw error
    }
  }

  // Supabase mode
  const supabase = createSupabaseClient()
  let query = supabase.from(table).select(Array.isArray(columns) ? columns.join(", ") : columns)

  if (where) {
    where.forEach((w) => {
      if (w.value === null) {
        query = query.is(w.column, null)
      } else if (w.operator === "in" || w.operator === "IN") {
        query = query.in(w.column, Array.isArray(w.value) ? w.value : [w.value])
      } else {
        query = query.eq(w.column, w.value)
      }
    })
  }

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending !== false })
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as T[]) || []
}

/**
 * Execute a transaction
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  return await rdsTransaction(callback)
}

/**
 * Check which database backend is being used
 */
export function isUsingRDS(): boolean {
  return USE_RDS
}

/**
 * Call a PostgreSQL function (RPC)
 */
export async function rpc<T = any>(
  functionName: string,
  params: Record<string, any> = {},
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const paramKeys = Object.keys(params)
    const paramValues = Object.values(params)
    const paramList = paramKeys.map((key, i) => `${key} => $${i + 1}`).join(", ")
    const sql = `SELECT * FROM ${functionName}(${paramList})`

    const result = await rdsQuery(sql, paramValues)
    return { data: result.rows[0] as T, error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Execute a complex SELECT query with joins
 */
export async function selectWithJoin<T = any>(
  table: string,
  options: {
    select?: string
    joins?: Array<{
      table: string
      on: string
      type?: "INNER" | "LEFT" | "RIGHT"
    }>
    where?: Array<{ column: string; operator?: string; value: any }>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
    single?: boolean
  } = {},
): Promise<{ data: T | T[] | null; error: Error | null }> {
  try {
    const columns = options.select || "*"
    let sql = `SELECT ${columns} FROM ${table}`
    const params: any[] = []
    let paramIndex = 1

    // Add joins
    if (options.joins) {
      options.joins.forEach((join) => {
        const joinType = join.type || "INNER"
        sql += ` ${joinType} JOIN ${join.table} ON ${join.on}`
      })
    }

    if (options.where && options.where.length > 0) {
      const whereClause = options.where
        .map((w) => {
          const operator = w.operator || "="

          if (w.value === null) {
            if (operator === "=") {
              return `${w.column} IS NULL`
            } else if (operator === "!=") {
              return `${w.column} IS NOT NULL`
            }
          }

          if (operator === "IN" || operator === "in") {
            const values = Array.isArray(w.value) ? w.value : [w.value]
            const placeholders = values.map(() => `$${paramIndex++}`).join(", ")
            params.push(...values)
            return `${w.column} IN (${placeholders})`
          }

          params.push(w.value)
          return `${w.column} ${operator} $${paramIndex++}`
        })
        .join(" AND ")
      sql += ` WHERE ${whereClause}`
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.ascending !== false ? "ASC" : "DESC"}`
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`
    }

    console.log("[v0] RDS Query:", sql, params)
    const result = await rdsQuery(sql, params)

    if (options.single) {
      return { data: (result.rows[0] as T) || null, error: null }
    }

    return { data: result.rows as T[], error: null }
  } catch (error) {
    console.error("[v0] selectWithJoin error:", error)
    return { data: null, error: error as Error }
  }
}

export function getDb() {
  return {
    query,
    select,
    insert,
    update,
    delete: deleteRows,
    transaction,
    rpc,
    selectWithJoin,
    isUsingRDS,
  }
}
