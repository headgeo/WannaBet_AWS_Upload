/**
 * Comprehensive AWS RDS Schema Inspector
 * Shows complete database structure with all tables, columns, types, and constraints
 * Run with: npx tsx scripts/inspect-schema.ts
 */

import { Pool } from "pg"

async function inspectSchema() {
  console.log("🔍 Inspecting AWS RDS Database Schema...\n")

  const connectionString =
    process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING

  if (!connectionString) {
    console.error("❌ No PostgreSQL connection string found!")
    return
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })

  try {
    const client = await pool.connect()
    console.log("✅ Connected to AWS RDS\n")
    console.log("=".repeat(80))
    console.log("DATABASE SCHEMA")
    console.log("=".repeat(80))

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log(`\nFound ${tablesResult.rows.length} tables:\n`)

    // For each table, get detailed column information
    for (const table of tablesResult.rows) {
      const tableName = table.table_name

      // Get columns with types and constraints
      const columnsResult = await client.query(
        `
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.is_nullable,
          c.column_default,
          CASE 
            WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
            WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY'
            ELSE ''
          END as key_type
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = $1
            AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = $1
            AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_name = $1
        ORDER BY c.ordinal_position
      `,
        [tableName],
      )

      // Get row count
      const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`)
      const rowCount = countResult.rows[0].count

      console.log(`\n📋 Table: ${tableName.toUpperCase()}`)
      console.log(`   Rows: ${rowCount}`)
      console.log("-".repeat(80))

      for (const col of columnsResult.rows) {
        let typeInfo = col.data_type
        if (col.character_maximum_length) {
          typeInfo += `(${col.character_maximum_length})`
        } else if (col.numeric_precision) {
          typeInfo += `(${col.numeric_precision}${col.numeric_scale ? `,${col.numeric_scale}` : ""})`
        }

        const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL"
        const keyType = col.key_type ? ` [${col.key_type}]` : ""
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : ""

        console.log(`   • ${col.column_name.padEnd(30)} ${typeInfo.padEnd(20)} ${nullable}${keyType}${defaultVal}`)
      }

      // Get indexes for this table
      const indexesResult = await client.query(
        `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
          AND schemaname = 'public'
        ORDER BY indexname
      `,
        [tableName],
      )

      if (indexesResult.rows.length > 0) {
        console.log(`\n   Indexes (${indexesResult.rows.length}):`)
        for (const idx of indexesResult.rows) {
          console.log(`   • ${idx.indexname}`)
        }
      }
    }

    console.log("\n" + "=".repeat(80))
    console.log("SUMMARY")
    console.log("=".repeat(80))
    console.log(`Total Tables: ${tablesResult.rows.length}`)
    console.log(`\nTable List:`)
    tablesResult.rows.forEach((t) => console.log(`  • ${t.table_name}`))
    console.log("\n✅ Schema inspection complete!\n")

    client.release()
  } catch (error) {
    console.error("❌ Error inspecting schema:")
    console.error(error)
  } finally {
    await pool.end()
  }
}

inspectSchema()
