-- Database Cleanup Script
-- PURPOSE: Delete all table entries EXCEPT profiles table
-- This preserves user accounts while cleaning all market/trading data
-- SAFE: Only deletes rows, does not drop tables or functions

-- WARNING: This will delete ALL data except user profiles!
-- Make sure you have a backup if needed

DO $$
BEGIN
  -- Disable triggers temporarily for faster deletion
  SET session_replication_role = 'replica';

  RAISE NOTICE 'Starting database cleanup...';

  -- Delete in order respecting foreign key constraints
  -- Start with tables that have no dependencies on them

  -- 1. Delete notifications (depends on users/markets)
  DELETE FROM notifications;
  RAISE NOTICE '✓ Deleted notifications';

  -- 2. Delete bonds (depends on markets/users)
  DELETE FROM settlement_bonds;
  DELETE FROM contest_bonds;
  DELETE FROM vote_bonds;
  RAISE NOTICE '✓ Deleted all bonds';

  -- 3. Delete ledger entries (depends on users/markets)
  DELETE FROM ledger_entries;
  DELETE FROM platform_ledger;
  RAISE NOTICE '✓ Deleted ledger entries';

  -- 4. Delete fees (depends on markets/users)
  DELETE FROM fees;
  RAISE NOTICE '✓ Deleted fees';

  -- 5. Delete positions (depends on markets/users)
  DELETE FROM positions;
  RAISE NOTICE '✓ Deleted positions';

  -- 6. Delete transactions (depends on markets/users)
  DELETE FROM transactions;
  RAISE NOTICE '✓ Deleted transactions';

  -- 7. Delete market price history (depends on markets)
  DELETE FROM market_price_history;
  RAISE NOTICE '✓ Deleted market price history';

  -- 8. Delete market participants (depends on markets/users)
  DELETE FROM market_participants;
  RAISE NOTICE '✓ Deleted market participants';

  -- 9. Delete user_groups (depends on groups/users)
  DELETE FROM user_groups;
  RAISE NOTICE '✓ Deleted user_groups';

  -- 10. Delete groups
  DELETE FROM groups;
  RAISE NOTICE '✓ Deleted groups';

  -- 11. Delete UMA/blockchain related tables if they exist
  DELETE FROM uma_assertions;
  RAISE NOTICE '✓ Deleted UMA assertions';

  -- 12. Delete markets (main parent table - delete last)
  DELETE FROM markets;
  RAISE NOTICE '✓ Deleted markets';

  -- Re-enable triggers
  SET session_replication_role = 'origin';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Database cleanup complete!';
  RAISE NOTICE '✅ All data deleted except profiles table';
  RAISE NOTICE '========================================';
END $$;

-- Reset sequences to start from 1 (optional but recommended)
-- This ensures new records start with clean IDs
ALTER SEQUENCE IF EXISTS markets_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS positions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS ledger_entries_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS platform_ledger_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS fees_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS groups_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS market_price_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS settlement_bonds_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS contest_bonds_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vote_bonds_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS market_participants_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS user_groups_id_seq RESTART WITH 1;

-- Verify cleanup with detailed summary
SELECT 
  'profiles' as table_name, 
  COUNT(*) as rows_remaining,
  '✅ PRESERVED' as status
FROM profiles
UNION ALL
SELECT 'markets', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM markets
UNION ALL
SELECT 'transactions', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM transactions
UNION ALL
SELECT 'positions', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM positions
UNION ALL
SELECT 'notifications', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM notifications
UNION ALL
SELECT 'ledger_entries', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM ledger_entries
UNION ALL
SELECT 'platform_ledger', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM platform_ledger
UNION ALL
SELECT 'fees', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM fees
UNION ALL
SELECT 'groups', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM groups
UNION ALL
SELECT 'user_groups', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM user_groups
UNION ALL
SELECT 'settlement_bonds', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM settlement_bonds
UNION ALL
SELECT 'contest_bonds', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM contest_bonds
UNION ALL
SELECT 'vote_bonds', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM vote_bonds
UNION ALL
SELECT 'market_price_history', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM market_price_history
UNION ALL
SELECT 'market_participants', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM market_participants
ORDER BY table_name;
