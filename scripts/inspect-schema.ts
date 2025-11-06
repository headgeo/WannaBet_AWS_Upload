import { query } from "../lib/database/rds"

async function inspectSchema() {
  console.log("🔍 Inspecting Database Schema\n")

  try {
    // Get markets table schema
    console.log("📊 MARKETS TABLE:")
    const marketsSchema = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'markets'
      ORDER BY ordinal_position;
    `)
    console.table(marketsSchema.rows)

    // Get uma_settlement_bonds table schema
    console.log("\n📊 UMA_SETTLEMENT_BONDS TABLE:")
    const bondsSchema = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'uma_settlement_bonds'
      ORDER BY ordinal_position;
    `)
    console.table(bondsSchema.rows)

    // Get uma_settlement_proposals table schema
    console.log("\n📊 UMA_SETTLEMENT_PROPOSALS TABLE:")
    const proposalsSchema = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'uma_settlement_proposals'
      ORDER BY ordinal_position;
    `)
    console.table(proposalsSchema.rows)

    // Get blockchain_transactions table schema
    console.log("\n📊 BLOCKCHAIN_TRANSACTIONS TABLE:")
    const txSchema = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'blockchain_transactions'
      ORDER BY ordinal_position;
    `)
    console.table(txSchema.rows)

    console.log("\n✅ Schema inspection complete")
    process.exit(0)
  } catch (error) {
    console.error("❌ Schema inspection failed:", error)
    process.exit(1)
  }
}

inspectSchema()
