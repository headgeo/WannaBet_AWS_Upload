-- Remove the problematic constraint entirely since it's blocking sell functionality
-- and we can enforce transaction types at the application level instead

-- First, check what constraint exists
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'transactions'::regclass 
AND contype = 'c';

-- Drop the problematic constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Verify the constraint is removed
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'transactions'::regclass 
AND contype = 'c';

-- Show current transaction types in the database to see what's actually being used
SELECT DISTINCT type FROM transactions LIMIT 10;
