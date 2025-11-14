-- Database Cleanup Script (CORRECTED)
-- PURPOSE: Delete all table entries EXCEPT profiles table
-- This preserves user accounts while cleaning all market/trading data
-- SAFE: Only deletes rows, does not drop tables or functions

-- WARNING: This will delete ALL data except user profiles!
-- Make sure you have a backup if needed

DO $$
BEGIN
  RAISE NOTICE 'Starting database cleanup...';
  RAISE NOTICE '';

  -- Disable triggers temporarily for faster deletion
  SET session_replication_role = 'replica';

  -- Delete in order respecting foreign key constraints
  -- Start with tables that have no dependencies on them

  -- Fixed table names and added missing tables from actual schema
  
  -- 1. Delete settlement_notifications (depends on settlement_contests)
  DELETE FROM settlement_notifications;
  RAISE NOTICE '✓ Deleted settlement_notifications';

  -- 2. Delete settlement_votes (depends on settlement_contests)
  DELETE FROM settlement_votes;
  RAISE NOTICE '✓ Deleted settlement_votes';

  -- 3. Delete settlement_contests (depends on markets)
  DELETE FROM settlement_contests;
  RAISE NOTICE '✓ Deleted settlement_contests';

  -- 4. Delete settlement_bonds (depends on markets)
  DELETE FROM settlement_bonds;
  RAISE NOTICE '✓ Deleted settlement_bonds';

  -- 5. Delete notifications (depends on users/markets)
  DELETE FROM notifications;
  RAISE NOTICE '✓ Deleted notifications';

  -- 6. Delete ledger entries (depends on users/markets)
  DELETE FROM ledger_entries;
  RAISE NOTICE '✓ Deleted ledger_entries';

  -- 7. Delete platform_ledger
  DELETE FROM platform_ledger;
  RAISE NOTICE '✓ Deleted platform_ledger';

  -- 8. Delete deposit_withdraw (depends on users)
  DELETE FROM deposit_withdraw;
  RAISE NOTICE '✓ Deleted deposit_withdraw';

  -- 9. Delete fees (depends on markets/users)
  DELETE FROM fees;
  RAISE NOTICE '✓ Deleted fees';

  -- 10. Delete positions (depends on markets/users)
  DELETE FROM positions;
  RAISE NOTICE '✓ Deleted positions';

  -- 11. Delete transactions (depends on markets/users)
  DELETE FROM transactions;
  RAISE NOTICE '✓ Deleted transactions';

  -- 12. Delete market price history (depends on markets)
  DELETE FROM market_price_history;
  RAISE NOTICE '✓ Deleted market_price_history';

  -- 13. Delete market participants (depends on markets/users/groups)
  DELETE FROM market_participants;
  RAISE NOTICE '✓ Deleted market_participants';

  -- 14. Delete blockchain_transactions (depends on markets)
  DELETE FROM blockchain_transactions;
  RAISE NOTICE '✓ Deleted blockchain_transactions';

  -- 15. Delete UMA related tables
  DELETE FROM uma_disputes;
  RAISE NOTICE '✓ Deleted uma_disputes';
  
  DELETE FROM uma_proposals;
  RAISE NOTICE '✓ Deleted uma_proposals';
  
  DELETE FROM uma_settlement_bonds;
  RAISE NOTICE '✓ Deleted uma_settlement_bonds';
  
  DELETE FROM uma_settlement_proposals;
  RAISE NOTICE '✓ Deleted uma_settlement_proposals';

  -- 16. Delete outbox_events
  DELETE FROM outbox_events;
  RAISE NOTICE '✓ Deleted outbox_events';

  -- 17. Delete user_groups (depends on groups/users)
  DELETE FROM user_groups;
  RAISE NOTICE '✓ Deleted user_groups';

  -- 18. Delete groups
  DELETE FROM groups;
  RAISE NOTICE '✓ Deleted groups';

  -- 19. Delete markets (main parent table - delete last)
  DELETE FROM markets;
  RAISE NOTICE '✓ Deleted markets';

  -- Re-enable triggers
  SET session_replication_role = 'origin';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Database cleanup complete!';
  RAISE NOTICE '✅ All data deleted except profiles table';
  RAISE NOTICE '✅ All triggers re-enabled';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- Reset sequences to start from 1 (optional but recommended)
-- Added deposit_withdraw sequence reset
ALTER SEQUENCE IF EXISTS deposit_withdraw_id_seq RESTART WITH 1;

-- Verify cleanup with detailed summary
-- Fixed table names in verification query
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
SELECT 'deposit_withdraw', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM deposit_withdraw
UNION ALL
SELECT 'fees', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM fees
UNION ALL
SELECT 'groups', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM groups
UNION ALL
SELECT 'user_groups', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM user_groups
UNION ALL
SELECT 'settlement_bonds', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM settlement_bonds
UNION ALL
SELECT 'settlement_contests', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM settlement_contests
UNION ALL
SELECT 'settlement_votes', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM settlement_votes
UNION ALL
SELECT 'settlement_notifications', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM settlement_notifications
UNION ALL
SELECT 'market_price_history', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM market_price_history
UNION ALL
SELECT 'market_participants', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM market_participants
UNION ALL
SELECT 'blockchain_transactions', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM blockchain_transactions
UNION ALL
SELECT 'uma_proposals', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM uma_proposals
UNION ALL
SELECT 'uma_disputes', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM uma_disputes
UNION ALL
SELECT 'uma_settlement_bonds', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM uma_settlement_bonds
UNION ALL
SELECT 'uma_settlement_proposals', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM uma_settlement_proposals
UNION ALL
SELECT 'outbox_events', COUNT(*), CASE WHEN COUNT(*) = 0 THEN '✅ CLEANED' ELSE '⚠️  HAS DATA' END FROM outbox_events
ORDER BY table_name;
