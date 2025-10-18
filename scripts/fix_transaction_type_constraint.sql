-- First, let's see what the current constraint allows
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'transactions_type_check';

-- Check if there are any existing transactions to see what types are used
SELECT DISTINCT type FROM transactions LIMIT 10;

-- Drop the existing constraint if it exists
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Create a new constraint that allows common transaction types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'bet', 'payout', 'refund'));
