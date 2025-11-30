DO $$
DECLARE
    v_ledger_entries_count INT;
    v_ledger_snapshots_count INT;
    v_ledger_accounts_count INT;
    v_transactions_count INT;
    v_positions_count INT;
    v_notifications_count INT;
    v_deposit_withdraw_count INT;
    v_markets_count INT;
    v_market_participants_count INT;
    v_settlement_bonds_count INT;
    v_settlement_contests_count INT;
    v_settlement_votes_count INT;
    v_profiles_count INT;
BEGIN
    RAISE NOTICE '=== SAFE DATA RESET (Preserving Profiles & Functions) ===';
    RAISE NOTICE ' ';
    
    -- Count records before deletion
    RAISE NOTICE '1. Current data counts:';
    
    SELECT COUNT(*) INTO v_profiles_count FROM profiles;
    SELECT COUNT(*) INTO v_markets_count FROM markets;
    SELECT COUNT(*) INTO v_transactions_count FROM transactions;
    SELECT COUNT(*) INTO v_ledger_entries_count FROM ledger_entries;
    SELECT COUNT(*) INTO v_ledger_snapshots_count FROM ledger_balance_snapshots;
    SELECT COUNT(*) INTO v_ledger_accounts_count FROM ledger_accounts;
    SELECT COUNT(*) INTO v_deposit_withdraw_count FROM deposit_withdraw;
    
    -- Check optional tables
    BEGIN SELECT COUNT(*) INTO v_positions_count FROM positions;
    EXCEPTION WHEN undefined_table THEN v_positions_count := 0; END;
    
    BEGIN SELECT COUNT(*) INTO v_notifications_count FROM notifications;
    EXCEPTION WHEN undefined_table THEN v_notifications_count := 0; END;
    
    BEGIN SELECT COUNT(*) INTO v_market_participants_count FROM market_participants;
    EXCEPTION WHEN undefined_table THEN v_market_participants_count := 0; END;
    
    BEGIN SELECT COUNT(*) INTO v_settlement_bonds_count FROM settlement_bonds;
    EXCEPTION WHEN undefined_table THEN v_settlement_bonds_count := 0; END;
    
    BEGIN SELECT COUNT(*) INTO v_settlement_contests_count FROM settlement_contests;
    EXCEPTION WHEN undefined_table THEN v_settlement_contests_count := 0; END;
    
    BEGIN SELECT COUNT(*) INTO v_settlement_votes_count FROM settlement_votes;
    EXCEPTION WHEN undefined_table THEN v_settlement_votes_count := 0; END;
    
    RAISE NOTICE '   - Profiles: % (will preserve, reset balance to 0)', v_profiles_count;
    RAISE NOTICE '   - Markets: %', v_markets_count;
    RAISE NOTICE '   - Transactions: %', v_transactions_count;
    RAISE NOTICE '   - Positions: %', v_positions_count;
    RAISE NOTICE '   - Notifications: %', v_notifications_count;
    RAISE NOTICE '   - Settlement bonds: %', v_settlement_bonds_count;
    RAISE NOTICE '   - Settlement contests: %', v_settlement_contests_count;
    RAISE NOTICE '   - Settlement votes: %', v_settlement_votes_count;
    RAISE NOTICE '   - Market participants: %', v_market_participants_count;
    RAISE NOTICE '   - Ledger entries: %', v_ledger_entries_count;
    RAISE NOTICE '   - Ledger snapshots: %', v_ledger_snapshots_count;
    RAISE NOTICE '   - Ledger accounts: %', v_ledger_accounts_count;
    RAISE NOTICE '   - Deposit/Withdraw: %', v_deposit_withdraw_count;
    RAISE NOTICE ' ';
    
    RAISE NOTICE '2. Deleting data (correct FK order - children first, then parents)...';
    
    -- LEVEL 1: Ledger data (no dependencies on other tables we're clearing)
    DELETE FROM ledger_balance_snapshots;
    RAISE NOTICE '   ✓ Deleted ledger_balance_snapshots';
    
    DELETE FROM ledger_entries;
    RAISE NOTICE '   ✓ Deleted ledger_entries';
    
    DELETE FROM ledger_accounts;
    RAISE NOTICE '   ✓ Deleted ledger_accounts';
    
    -- LEVEL 2: Tables that reference markets/profiles
    DELETE FROM deposit_withdraw;
    RAISE NOTICE '   ✓ Deleted deposit_withdraw';
    
    IF v_notifications_count > 0 THEN
        DELETE FROM notifications;
        RAISE NOTICE '   ✓ Deleted notifications';
    END IF;
    
    IF v_positions_count > 0 THEN
        DELETE FROM positions;
        RAISE NOTICE '   ✓ Deleted positions';
    END IF;
    
    -- LEVEL 3: Settlement tables (reference markets)
    IF v_settlement_votes_count > 0 THEN
        DELETE FROM settlement_votes;
        RAISE NOTICE '   ✓ Deleted settlement_votes';
    END IF;
    
    IF v_settlement_contests_count > 0 THEN
        DELETE FROM settlement_contests;
        RAISE NOTICE '   ✓ Deleted settlement_contests';
    END IF;
    
    IF v_settlement_bonds_count > 0 THEN
        DELETE FROM settlement_bonds;
        RAISE NOTICE '   ✓ Deleted settlement_bonds';
    END IF;
    
    IF v_market_participants_count > 0 THEN
        DELETE FROM market_participants;
        RAISE NOTICE '   ✓ Deleted market_participants';
    END IF;
    
    -- LEVEL 4: Transactions (references markets)
    DELETE FROM transactions;
    RAISE NOTICE '   ✓ Deleted transactions';
    
    -- Delete platform_ledger BEFORE markets to avoid FK cascade issue
    BEGIN
      DELETE FROM platform_ledger;
      RAISE NOTICE '   ✓ Deleted platform_ledger';
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '   - platform_ledger does not exist (skipped)';
    END;
    
    -- LEVEL 5: Markets (parent table - delete last)
    DELETE FROM markets;
    RAISE NOTICE '   ✓ Deleted markets';
    
    RAISE NOTICE ' ';
    RAISE NOTICE '3. Resetting profile balances to 0...';
    UPDATE profiles SET balance = 0;
    RAISE NOTICE '   ✓ Reset % profile balances to 0', v_profiles_count;
    
    RAISE NOTICE ' ';
    RAISE NOTICE '4. Verifying cleanup:';
    RAISE NOTICE '   - Markets: %', (SELECT COUNT(*) FROM markets);
    RAISE NOTICE '   - Transactions: %', (SELECT COUNT(*) FROM transactions);
    RAISE NOTICE '   - Ledger entries: %', (SELECT COUNT(*) FROM ledger_entries);
    RAISE NOTICE '   - Profiles: % (PRESERVED, balances = 0)', (SELECT COUNT(*) FROM profiles);
    RAISE NOTICE ' ';
    
    RAISE NOTICE '5. Checking functions and triggers are intact:';
    RAISE NOTICE '   - Public functions: %', (
        SELECT COUNT(*) 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    );
    RAISE NOTICE '   - Public triggers: %', (
        SELECT COUNT(*)
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
    );
    RAISE NOTICE ' ';
    
    RAISE NOTICE '=== RESET COMPLETE ===';
    RAISE NOTICE ' ';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '✓ All market/transaction data cleared';
    RAISE NOTICE '✓ All ledger data cleared';
    RAISE NOTICE '✓ All settlement data cleared';
    RAISE NOTICE '✓ User profiles preserved (balances reset to 0)';
    RAISE NOTICE '✓ All functions and triggers intact';
    RAISE NOTICE ' ';
    RAISE NOTICE 'The system is ready for fresh testing!';
    
END $$;
