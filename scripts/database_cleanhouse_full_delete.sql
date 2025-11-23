-- Database Cleanup Script (UPDATED WITH LEDGER ACCOUNT TABLES)
-- PURPOSE: Delete all table entries EXCEPT profiles table
-- WARNING: This will delete ALL trading/market/ledger data

DO $$
BEGIN
  RAISE NOTICE 'Starting database cleanup...';
  RAISE NOTICE '';

  -- Disable triggers temporarily for faster deletion
  SET session_replication_role = 'replica';

  -------------------------------------------------------------------
  -- LEDGER TABLES (must delete in correct order)
  -------------------------------------------------------------------

  -- A. Delete ledger_entries first (depends on ledger_accounts)
  DELETE FROM ledger_entries;
  RAISE NOTICE '✓ Deleted ledger_entries';

  -- B. Delete ledger_balance_snapshots (depends on ledger_accounts)
  DELETE FROM ledger_balance_snapshots;
  RAISE NOTICE '✓ Deleted ledger_balance_snapshots';

  -- C. Delete ledger_accounts (top-level, referenced by both)
  DELETE FROM ledger_accounts;
  RAISE NOTICE '✓ Deleted ledger_accounts';


  -------------------------------------------------------------------
  -- ORIGINAL CLEANUP TABLES
  -------------------------------------------------------------------

  DELETE FROM settlement_notifications;
  RAISE NOTICE '✓ Deleted settlement_notifications';

  DELETE FROM settlement_votes;
  RAISE NOTICE '✓ Deleted settlement_votes';

  DELETE FROM settlement_contests;
  RAISE NOTICE '✓ Deleted settlement_contests';

  DELETE FROM settlement_bonds;
  RAISE NOTICE '✓ Deleted settlement_bonds';

  DELETE FROM notifications;
  RAISE NOTICE '✓ Deleted notifications';

  -- (ledger_entries previously moved to top)
  
  DELETE FROM platform_ledger;
  RAISE NOTICE '✓ Deleted platform_ledger';

  DELETE FROM deposit_withdraw;
  RAISE NOTICE '✓ Deleted deposit_withdraw';

  DELETE FROM fees;
  RAISE NOTICE '✓ Deleted fees';

  DELETE FROM positions;
  RAISE NOTICE '✓ Deleted positions';

  DELETE FROM transactions;
  RAISE NOTICE '✓ Deleted transactions';

  DELETE FROM market_price_history;
  RAISE NOTICE '✓ Deleted market_price_history';

  DELETE FROM market_participants;
  RAISE NOTICE '✓ Deleted market_participants';

  DELETE FROM blockchain_transactions;
  RAISE NOTICE '✓ Deleted blockchain_transactions';

  DELETE FROM uma_disputes;
  RAISE NOTICE '✓ Deleted uma_disputes';
  
  DELETE FROM uma_proposals;
  RAISE NOTICE '✓ Deleted uma_proposals';
  
  DELETE FROM uma_settlement_bonds;
  RAISE NOTICE '✓ Deleted uma_settlement_bonds';
  
  DELETE FROM uma_settlement_proposals;
  RAISE NOTICE '✓ Deleted uma_settlement_proposals';

  DELETE FROM outbox_events;
  RAISE NOTICE '✓ Deleted outbox_events';

  DELETE FROM user_groups;
  RAISE NOTICE '✓ Deleted user_groups';

  DELETE FROM groups;
  RAISE NOTICE '✓ Deleted groups';

  DELETE FROM markets;
  RAISE NOTICE '✓ Deleted markets';


  -- Re-enable triggers
  SET session_replication_role = 'origin';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Database cleanup complete!';
  RAISE NOTICE '✅ All data deleted except profiles table';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;


-- Reset sequences
ALTER SEQUENCE IF EXISTS deposit_withdraw_id_seq RESTART WITH 1;



-------------------------------------------------------------------
-- VERIFICATION QUERY (updated to include ledger_accounts & snapshots)
-------------------------------------------------------------------

SELECT 
  'profiles' AS table_name,
  COUNT(*) AS rows_remaining,
  '✅ PRESERVED' AS status
FROM profiles

UNION ALL SELECT 'ledger_accounts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM ledger_accounts

UNION ALL SELECT 'ledger_balance_snapshots', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM ledger_balance_snapshots

UNION ALL SELECT 'ledger_entries', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM ledger_entries

UNION ALL SELECT 'markets', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM markets

UNION ALL SELECT 'transactions', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM transactions

UNION ALL SELECT 'positions', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM positions

UNION ALL SELECT 'notifications', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM notifications

UNION ALL SELECT 'platform_ledger', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM platform_ledger

UNION ALL SELECT 'deposit_withdraw', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM deposit_withdraw

UNION ALL SELECT 'fees', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM fees

UNION ALL SELECT 'groups', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM groups

UNION ALL SELECT 'user_groups', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM user_groups

UNION ALL SELECT 'settlement_bonds', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM settlement_bonds

UNION ALL SELECT 'settlement_contests', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM settlement_contests

UNION ALL SELECT 'settlement_votes', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM settlement_votes

UNION ALL SELECT 'settlement_notifications', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM settlement_notifications

UNION ALL SELECT 'market_price_history', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM market_price_history

UNION ALL SELECT 'market_participants', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM market_participants

UNION ALL SELECT 'blockchain_transactions', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM blockchain_transactions

UNION ALL SELECT 'uma_proposals', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM uma_proposals

UNION ALL SELECT 'uma_disputes', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM uma_disputes

UNION ALL SELECT 'uma_settlement_bonds', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM uma_settlement_bonds

UNION ALL SELECT 'uma_settlement_proposals', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM uma_settlement_proposals

UNION ALL SELECT 'outbox_events', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️ HAS DATA' END
FROM outbox_events

ORDER BY table_name;
