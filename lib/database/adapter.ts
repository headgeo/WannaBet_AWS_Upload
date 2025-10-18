/**
 * Database adapter that provides a unified interface for both Supabase and RDS
 * This allows seamless switching between backends with USE_RDS environment variable
 */

import { createClient as createSupabaseClient } from "@/lib/supabase/server"
import { query as rdsQuery, transaction as rdsTransaction } from "./rds"
import type { PoolClient } from "pg"

const hasRDSConfig = !!(
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING
)

const USE_RDS = hasRDSConfig

console.log("[Adapter] Database backend:", USE_RDS ? "AWS RDS" : "Supabase", {
  hasRDSConfig,
  POSTGRES_URL: !!process.env.POSTGRES_URL,
  POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
  POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
})

export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
}

/**
 * Execute a SELECT query
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  if (USE_RDS) {
    // Use RDS directly
    return await rdsQuery(sql, params)
  } else {
    // Use Supabase - we'll keep using the Supabase client directly
    // This function is just a wrapper for consistency
    throw new Error("Direct SQL queries not supported with Supabase. Use Supabase client methods.")
  }
}

/**
 * Execute an INSERT and return the inserted row(s)
 */
export async function insert<T = any>(
  table: string,
  data: Record<string, any> | Record<string, any>[],
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    if (USE_RDS) {
      // Convert to SQL INSERT
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
    } else {
      // Use Supabase
      const supabase = await createSupabaseClient()
      const { data: result, error } = await supabase.from(table).insert(data).select()

      if (error) return { data: null, error }
      return { data: result as T[], error: null }
    }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Execute an UPDATE and return the updated row(s)
 * Fixed signature to match usage patterns
 */
export async function update<T = any>(
  table: string,
  data: Record<string, any>,
  where: { column: string; operator?: string; value: any },
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    if (USE_RDS) {
      // Convert to SQL UPDATE
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
    } else {
      // Use Supabase
      const supabase = await createSupabaseClient()
      const { data: result, error } = await supabase.from(table).update(data).eq(where.column, where.value).select()

      if (error) return { data: null, error }
      return { data: result as T[], error: null }
    }
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
  if (USE_RDS) {
    // Convert to SQL DELETE
    const sql = `
      DELETE FROM ${table}
      WHERE ${where.column} = $1
      RETURNING *
    `
    return await rdsQuery(sql, [where.value])
  } else {
    // Use Supabase
    const supabase = await createSupabaseClient()
    const { data: result, error } = await supabase.from(table).delete().eq(where.column, where.value).select()

    if (error) throw error
    return { rows: result || [], rowCount: result?.length || 0 }
  }
}

/**
 * Execute a SELECT query with WHERE clause
 * Simplified API that accepts either positional parameters or options object
 */
export async function select<T = any>(
  table: string,
  columns: string | string[] = "*",
  where?: Array<{ column: string; operator?: string; value: any }>,
  orderBy?: { column: string; ascending?: boolean },
  limit?: number,
): Promise<T[]> {
  const columnsStr = Array.isArray(columns) ? columns.join(", ") : columns

  if (USE_RDS) {
    // Convert to SQL SELECT
    let sql = `SELECT ${columnsStr} FROM ${table}`
    const params: any[] = []
    let paramIndex = 1

    if (where && where.length > 0) {
      const whereClause = where
        .map((w) => {
          const operator = w.operator || "="

          // Handle special operators
          if (operator === "not.in") {
            params.push(w.value)
            return `${w.column} NOT IN ($${paramIndex++})`
          } else if (operator === "in" || operator === "IN") {
            // For IN operator, value should be an array
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
  } else {
    // Use Supabase
    const supabase = await createSupabaseClient()
    let query = supabase.from(table).select(columnsStr)

    if (where) {
      where.forEach((w) => {
        const operator = w.operator || "eq"

        // Handle Supabase-style operators
        if (operator === "=" || operator === "eq") {
          query = query.eq(w.column, w.value)
        } else if (operator === "!=" || operator === "neq") {
          query = query.neq(w.column, w.value)
        } else if (operator === "<" || operator === "lt") {
          query = query.lt(w.column, w.value)
        } else if (operator === ">" || operator === "gt") {
          query = query.gt(w.column, w.value)
        } else if (operator === "<=" || operator === "lte") {
          query = query.lte(w.column, w.value)
        } else if (operator === ">=" || operator === "gte") {
          query = query.gte(w.column, w.value)
        } else if (operator === "in" || operator === "IN") {
          query = query.in(w.column, Array.isArray(w.value) ? w.value : [w.value])
        } else if (operator === "not.in") {
          // Parse the value if it's a string like "(settled,cancelled,closed)"
          let values = w.value
          if (typeof values === "string") {
            values = values.replace(/[()]/g, "").split(",")
          }
          query = query.not(w.column, "in", `(${Array.isArray(values) ? values.join(",") : values})`)
        }
      })
    }

    if (orderBy) {
      query = query.order(orderBy.column, {
        ascending: orderBy.ascending !== false,
      })
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) throw error
    return (data as T[]) || []
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(callback: (client: PoolClient | any) => Promise<T>): Promise<T> {
  if (USE_RDS) {
    return await rdsTransaction(callback)
  } else {
    // Supabase doesn't support explicit transactions in the same way
    // Execute the callback with a Supabase client
    const supabase = await createSupabaseClient()
    return await callback(supabase)
  }
}

/**
 * Get the Supabase client directly (for complex queries that need the full API)
 */
export async function getSupabaseClient() {
  if (USE_RDS) {
    throw new Error("Supabase client not available when using RDS")
  }
  return await createSupabaseClient()
}

/**
 * Check which database backend is being used
 */
export function isUsingRDS(): boolean {
  return USE_RDS
}

/**
 * Call a PostgreSQL function (RPC)
 * Works with both Supabase and RDS backends
 */
export async function rpc<T = any>(
  functionName: string,
  params: Record<string, any> = {},
): Promise<{ data: T | null; error: Error | null }> {
  if (USE_RDS) {
    // Convert to PostgreSQL function call
    const paramKeys = Object.keys(params)
    const paramValues = Object.values(params)

    // Build the function call with named parameters
    const paramList = paramKeys.map((key, i) => `${key} => $${i + 1}`).join(", ")
    const sql = `SELECT * FROM ${functionName}(${paramList})`

    try {
      const result = await rdsQuery(sql, paramValues)
      // RDS functions typically return a single row with the result
      return { data: result.rows[0] as T, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  } else {
    // Use Supabase RPC
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc(functionName, params)
    return { data, error }
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
  if (USE_RDS) {
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

      // Add where clauses
      if (options.where && options.where.length > 0) {
        const whereClause = options.where
          .map((w) => {
            params.push(w.value)
            const operator = w.operator || "="
            return `${w.column} ${operator} $${paramIndex++}`
          })
          .join(" AND ")
        sql += ` WHERE ${whereClause}`
      }

      // Add order by
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.ascending !== false ? "ASC" : "DESC"}`
      }

      // Add limit
      if (options.limit) {
        sql += ` LIMIT ${options.limit}`
      }

      const result = await rdsQuery(sql, params)

      if (options.single) {
        return { data: (result.rows[0] as T) || null, error: null }
      }

      return { data: result.rows as T[], error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  } else {
    // Use Supabase
    try {
      const supabase = await createSupabaseClient()
      let query = supabase.from(table).select(options.select || "*")

      // Supabase handles joins differently - they're part of the select string
      // So we expect the select string to already include the join syntax

      // Add where clauses
      if (options.where) {
        options.where.forEach((w) => {
          const operator = w.operator || "eq"
          if (operator === "=") {
            query = query.eq(w.column, w.value)
          } else if (operator === "!=") {
            query = query.neq(w.column, w.value)
          } else if (operator === "<") {
            query = query.lt(w.column, w.value)
          } else if (operator === ">") {
            query = query.gt(w.column, w.value)
          } else if (operator === "<=") {
            query = query.lte(w.column, w.value)
          } else if (operator === ">=") {
            query = query.gte(w.column, w.value)
          } else if (operator === "IN") {
            query = query.in(w.column, w.value)
          }
        })
      }

      // Add order by
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending !== false,
        })
      }

      // Add limit
      if (options.limit) {
        query = query.limit(options.limit)
      }

      // Single or multiple
      if (options.single) {
        const { data, error } = await query.single()
        return { data, error }
      } else {
        const { data, error } = await query
        return { data, error }
      }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }
}

/**
 * Get the appropriate database client for direct queries
 * Returns Supabase client when USE_RDS=false, throws error when USE_RDS=true
 */
export async function getClient() {
  if (USE_RDS) {
    throw new Error("Direct client access not available when using RDS. Use adapter functions instead.")
  }
  return await createSupabaseClient()
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
