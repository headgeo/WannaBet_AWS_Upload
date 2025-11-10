import { getDb } from "./adapter"

export interface LedgerEntry {
  id: string
  transaction_id: string
  idempotency_key?: string
  created_at: string
  user_id: string
  account_type: string
  debit: number
  credit: number
  balance_after: number
  entry_type: string
  market_id?: string
  related_transaction_id?: string
  metadata?: Record<string, any>
  description?: string
}

export interface ReconciliationResult {
  user_id: string
  username: string
  profile_balance: number
  ledger_balance: number
  difference: number
}

/**
 * Get ledger entries for a user
 */
export async function getUserLedger(
  userId: string,
  options: {
    limit?: number
    offset?: number
    entryType?: string
    marketId?: string
  } = {},
): Promise<LedgerEntry[]> {
  const db = getDb()

  const where: Array<{ column: string; value: any }> = [{ column: "user_id", value: userId }]

  if (options.entryType) {
    where.push({ column: "entry_type", value: options.entryType })
  }

  if (options.marketId) {
    where.push({ column: "market_id", value: options.marketId })
  }

  const entries = await db.select<LedgerEntry>(
    "ledger_entries",
    "*",
    where,
    { column: "created_at", ascending: false },
    options.limit || 100,
  )

  return entries
}

/**
 * Get ledger entries for a specific transaction
 */
export async function getTransactionLedger(transactionId: string): Promise<LedgerEntry[]> {
  const db = getDb()

  const entries = await db.select<LedgerEntry>(
    "ledger_entries",
    "*",
    [{ column: "transaction_id", value: transactionId }],
    { column: "created_at", ascending: true },
  )

  return entries
}

/**
 * Reconcile a user's balance with their ledger
 */
export async function reconcileUserBalance(userId: string): Promise<ReconciliationResult> {
  const db = getDb()

  const result = await db.query<ReconciliationResult>("SELECT * FROM get_user_ledger_balance($1)", [userId])

  if (!result.rows[0]) {
    throw new Error(`User ${userId} not found`)
  }

  return result.rows[0]
}

/**
 * Reconcile ALL user balances (for periodic auditing)
 */
export async function reconcileAllBalances(): Promise<ReconciliationResult[]> {
  const db = getDb()

  const result = await db.query<ReconciliationResult>("SELECT * FROM check_all_balance_reconciliation()")

  return result.rows
}

/**
 * Get ledger summary for a user
 */
export async function getUserLedgerSummary(userId: string): Promise<{
  total_credits: number
  total_debits: number
  net_balance: number
  entry_count: number
  entry_types: Record<string, number>
}> {
  const db = getDb()

  const result = await db.query<{
    total_credits: string
    total_debits: string
    net_balance: string
    entry_count: string
  }>(
    `
    SELECT 
      COALESCE(SUM(credit), 0) as total_credits,
      COALESCE(SUM(debit), 0) as total_debits,
      COALESCE(SUM(credit - debit), 0) as net_balance,
      COUNT(*) as entry_count
    FROM ledger_entries
    WHERE user_id = $1 AND account_type = 'balance'
    `,
    [userId],
  )

  if (result.rows.length === 0) {
    return {
      total_credits: 0,
      total_debits: 0,
      net_balance: 0,
      entry_count: 0,
      entry_types: {},
    }
  }

  const row = result.rows[0]

  // Get entry type breakdown
  const typeResult = await db.query<{ entry_type: string; count: string }>(
    `
    SELECT entry_type, COUNT(*) as count
    FROM ledger_entries
    WHERE user_id = $1
    GROUP BY entry_type
    `,
    [userId],
  )

  const entry_types: Record<string, number> = {}
  typeResult.rows.forEach((r) => {
    entry_types[r.entry_type] = Number.parseInt(r.count)
  })

  return {
    total_credits: Number.parseFloat(row.total_credits),
    total_debits: Number.parseFloat(row.total_debits),
    net_balance: Number.parseFloat(row.net_balance),
    entry_count: Number.parseInt(row.entry_count),
    entry_types,
  }
}

/**
 * Get audit trail for a market (all balance changes related to this market)
 */
export async function getMarketLedgerAudit(marketId: string): Promise<LedgerEntry[]> {
  const db = getDb()

  const entries = await db.select<LedgerEntry>("ledger_entries", "*", [{ column: "market_id", value: marketId }], {
    column: "created_at",
    ascending: true,
  })

  return entries
}
