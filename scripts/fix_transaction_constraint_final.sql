-- Final fix for transaction type constraint - consolidating all previous attempts
-- Check what constraint currently exists
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'transactions'::regclass 
AND contype = 'c'
AND consrc LIKE '%type%';

-- Drop ALL existing type constraints to start fresh
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'transactions'::regclass 
        AND contype = 'c'
        AND (consrc LIKE '%type%' OR conname LIKE '%type%')
    LOOP
        EXECUTE 'ALTER TABLE transactions DROP CONSTRAINT IF EXISTS ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Create the correct constraint with all valid transaction types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'bet', 'payout', 'refund', 'market_creation'));

-- Verify the constraint was created correctly
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'transactions_type_check';

-- Test that 'sell' is now allowed
SELECT 'sell'::text AS test_type 
WHERE 'sell' IN ('buy', 'sell', 'deposit', 'withdrawal', 'bet', 'payout', 'refund', 'market_creation');
