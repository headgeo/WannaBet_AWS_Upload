DO $$
DECLARE
    v_ledger_entries_count INT;
    v_ledger_snapshots_count INT;
    v_ledger_accounts_count INT;
    v_transactions_count INT;
    v_deposit_withdraw_count INT;
    v_markets_count INT;
    v_market_participants_count INT;
    v_fees_count INT;
    v_bonds_count INT;
BEGIN
    RAISE NOTICE '=== SAFE DATA RESET (Preserving Profiles & Functions) ===';
    RAISE NOTICE ' ';
    
    -- Count records before deletion
    RAISE NOTICE '1. Current data counts:';
    SELECT COUNT(*) INTO v_ledger_entries_count FROM ledger_entries;
    SELECT COUNT(*) INTO v_ledger_snapshots_count FROM ledger_balance_snapshots;
    SELECT COUNT(*) INTO v_ledger_accounts_count FROM ledger_accounts;
    SELECT COUNT(*) INTO v_transactions_count FROM transactions;
    SELECT COUNT(*) INTO v_deposit_withdraw_count FROM deposit_withdraw;
    SELECT COUNT(*) INTO v_markets_count FROM markets;
    
    -- Check if optional tables exist
    BEGIN
        SELECT COUNT(*) INTO v_market_participants_count FROM market_participants;
    EXCEPTION WHEN undefined_table THEN
        v_market_participants_count := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO v_fees_count FROM fees;
    EXCEPTION WHEN undefined_table THEN
        v_fees_count := 0;
    END;
    
    BEGIN
        SELECT COUNT(*) INTO v_bonds_count FROM bonds;
    EXCEPTION WHEN undefined_table THEN
        v_bonds_count := 0;
    END;
    
    RAISE NOTICE '   - Ledger entries: %', v_ledger_entries_count;
    RAISE NOTICE '   - Ledger balance snapshots: %', v_ledger_snapshots_count;
    RAISE NOTICE '   - Ledger accounts: %', v_ledger_accounts_count;
    RAISE NOTICE '   - Transactions: %', v_transactions_count;
    RAISE NOTICE '   - Deposit/Withdraw: %', v_deposit_withdraw_count;
    RAISE NOTICE '   - Markets: %', v_markets_count;
    IF v_market_participants_count > 0 THEN
        RAISE NOTICE '   - Market participants: %', v_market_participants_count;
    END IF;
    IF v_fees_count > 0 THEN
        RAISE NOTICE '   - Fees: %', v_fees_count;
    END IF;
    IF v_bonds_count > 0 THEN
        RAISE NOTICE '   - Bonds: %', v_bonds_count;
    END IF;
    RAISE NOTICE ' ';
    
    RAISE NOTICE '2. Deleting data (preserving profiles, functions, and triggers)...';
    
    -- Delete in correct order to respect foreign key constraints
    -- Child tables first, then parent tables
    
    -- Delete ledger data (child tables first)
    DELETE FROM ledger_entries;
    RAISE NOTICE '   ✓ Deleted % ledger entries', v_ledger_entries_count;
    
    DELETE FROM ledger_balance_snapshots;
    RAISE NOTICE '   ✓ Deleted % ledger balance snapshots', v_ledger_snapshots_count;
    
    DELETE FROM ledger_accounts;
    RAISE NOTICE '   ✓ Deleted % ledger accounts', v_ledger_accounts_count;
    
    -- Delete deposit/withdraw records
    DELETE FROM deposit_withdraw;
    RAISE NOTICE '   ✓ Deleted % deposit/withdraw records', v_deposit_withdraw_count;
    
    -- Delete optional child tables if they exist
    IF v_market_participants_count > 0 THEN
        DELETE FROM market_participants;
        RAISE NOTICE '   ✓ Deleted % market participants', v_market_participants_count;
    END IF;
    
    IF v_fees_count > 0 THEN
        DELETE FROM fees;
        RAISE NOTICE '   ✓ Deleted % fees', v_fees_count;
    END IF;
    
    IF v_bonds_count > 0 THEN
        DELETE FROM bonds;
        RAISE NOTICE '   ✓ Deleted % bonds', v_bonds_count;
    END IF;
    
    -- Delete transactions (references markets)
    DELETE FROM transactions;
    RAISE NOTICE '   ✓ Deleted % transactions', v_transactions_count;
    
    -- Delete markets last (parent table)
    DELETE FROM markets;
    RAISE NOTICE '   ✓ Deleted % markets', v_markets_count;
    
    RAISE NOTICE ' ';
    RAISE NOTICE '3. Verifying cleanup:';
    RAISE NOTICE '   - Ledger entries: %', (SELECT COUNT(*) FROM ledger_entries);
    RAISE NOTICE '   - Ledger accounts: %', (SELECT COUNT(*) FROM ledger_accounts);
    RAISE NOTICE '   - Transactions: %', (SELECT COUNT(*) FROM transactions);
    RAISE NOTICE '   - Markets: %', (SELECT COUNT(*) FROM markets);
    RAISE NOTICE '   - Profiles: % (PRESERVED)', (SELECT COUNT(*) FROM profiles);
    RAISE NOTICE ' ';
    
    RAISE NOTICE '4. Checking functions and triggers are intact:';
    RAISE NOTICE '   - Functions: % (PRESERVED)', (
        SELECT COUNT(*) 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname LIKE '%ledger%'
    );
    RAISE NOTICE '   - Triggers: % (PRESERVED)', (
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
    RAISE NOTICE '✓ All transactional data cleared';
    RAISE NOTICE '✓ User profiles preserved';
    RAISE NOTICE '✓ All functions and triggers intact';
    RAISE NOTICE '✓ Ledger tracking will work for new transactions';
    RAISE NOTICE ' ';
    RAISE NOTICE 'The system is ready for fresh transactions!';
    
END $$;
