DO $$
DECLARE
    v_test_market_id UUID;
    v_test_user_id UUID;
    v_proposal_bond_id UUID;
    v_contest_bond_id UUID;
    v_ledger_entries_before INT;
    v_ledger_entries_after INT;
    v_ledger_accounts_before INT;
    v_ledger_accounts_after INT;
BEGIN
    RAISE NOTICE '=== TESTING BOND PAYOUT WITH EXISTING MARKET ===';
    RAISE NOTICE ' ';
    
    -- Get an existing user
    SELECT id INTO v_test_user_id FROM profiles LIMIT 1;
    RAISE NOTICE '1. Using test user: %', v_test_user_id;
    
    -- Check valid settlement_status values
    RAISE NOTICE ' ';
    RAISE NOTICE '2. Checking valid settlement_status values:';
    RAISE NOTICE '   Current constraint definition:';
    SELECT conbin::text INTO STRICT v_test_user_id FROM pg_constraint 
    WHERE conname = 'markets_settlement_status_check';
    RAISE NOTICE '   %', v_test_user_id;
    
    -- Get an existing private market or create one with correct status
    RAISE NOTICE ' ';
    RAISE NOTICE '3. Getting existing private market:';
    SELECT id INTO v_test_market_id 
    FROM markets 
    WHERE is_private = true 
    LIMIT 1;
    
    IF v_test_market_id IS NULL THEN
        RAISE NOTICE '   No existing private market, checking sample settlement_status values...';
        -- Check what values exist in the table
        RAISE NOTICE '   Existing settlement_status values in markets:';
        FOR v_test_user_id IN 
            SELECT DISTINCT settlement_status::TEXT FROM markets WHERE settlement_status IS NOT NULL
        LOOP
            RAISE NOTICE '     - %', v_test_user_id;
        END LOOP;
        
        RAISE NOTICE '   ✗ Cannot test without a private market';
        RETURN;
    ELSE
        RAISE NOTICE '   ✓ Using market: %', v_test_market_id;
    END IF;
    
    -- Count ledger entries before
    SELECT COUNT(*) INTO v_ledger_entries_before FROM ledger_entries;
    SELECT COUNT(*) INTO v_ledger_accounts_before FROM ledger_accounts;
    
    RAISE NOTICE ' ';
    RAISE NOTICE '4. Before bond payout:';
    RAISE NOTICE '   - Ledger entries: %', v_ledger_entries_before;
    RAISE NOTICE '   - Ledger accounts: %', v_ledger_accounts_before;
    
    -- Create test bonds for this market
    RAISE NOTICE ' ';
    RAISE NOTICE '5. Creating test bonds:';
    
    -- Insert proposal bond
    INSERT INTO settlement_bonds (market_id, creator_id, bond_amount, created_at)
    VALUES (v_test_market_id, v_test_user_id, 100.00, NOW())
    RETURNING id INTO v_proposal_bond_id;
    RAISE NOTICE '   ✓ Proposal bond created: % ($100)', v_proposal_bond_id;
    
    -- Insert contest bond
    INSERT INTO settlement_contests (market_id, creator_id, contest_bond_amount, created_at)
    VALUES (v_test_market_id, v_test_user_id, 50.00, NOW())
    RETURNING id INTO v_contest_bond_id;
    RAISE NOTICE '   ✓ Contest bond created: % ($50)', v_contest_bond_id;
    
    -- Call the payout function
    RAISE NOTICE ' ';
    RAISE NOTICE '6. Calling payout_bonds_to_ledger(market_id, ''proposal''):';
    
    BEGIN
        PERFORM payout_bonds_to_ledger(v_test_market_id, 'proposal');
        RAISE NOTICE '   ✓ Function executed successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '   ✗ ERROR: %', SQLERRM;
    END;
    
    -- Count ledger entries after
    SELECT COUNT(*) INTO v_ledger_entries_after FROM ledger_entries;
    SELECT COUNT(*) INTO v_ledger_accounts_after FROM ledger_accounts;
    
    RAISE NOTICE ' ';
    RAISE NOTICE '7. After bond payout:';
    RAISE NOTICE '   - Ledger entries: % (change: %)', 
        v_ledger_entries_after, v_ledger_entries_after - v_ledger_entries_before;
    RAISE NOTICE '   - Ledger accounts: % (change: %)', 
        v_ledger_accounts_after, v_ledger_accounts_after - v_ledger_accounts_before;
    
    IF v_ledger_entries_after > v_ledger_entries_before THEN
        RAISE NOTICE '   ✓ Ledger entries were created!';
        
        -- Show the new entries
        RAISE NOTICE ' ';
        RAISE NOTICE '8. New ledger entries created:';
        FOR v_test_user_id IN 
            SELECT id, account_id, entry_type, debit, credit, description
            FROM ledger_entries
            WHERE created_at > NOW() - INTERVAL '1 minute'
            ORDER BY created_at DESC
        LOOP
            RAISE NOTICE '   Entry: type=%, debit=%, credit=%, desc=%', 
                v_test_user_id;
        END LOOP;
    ELSE
        RAISE NOTICE '   ✗ NO ledger entries created';
    END IF;
    
    RAISE NOTICE ' ';
    RAISE NOTICE '=== TEST COMPLETE (will rollback) ===';
    
    -- Rollback everything
    RAISE EXCEPTION 'Rolling back test transaction';
    
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM != 'Rolling back test transaction' THEN
        RAISE NOTICE 'ERROR during test: %', SQLERRM;
    END IF;
END $$;
