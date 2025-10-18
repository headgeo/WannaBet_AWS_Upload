-- Check current constraint on transactions table
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'public.transactions'::regclass 
AND contype = 'c';

-- Drop any existing type constraints
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transaction_type;

-- Create the correct constraint that allows all necessary transaction types
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'bet', 'payout', 'refund', 'market_creation'));

-- Verify the constraint was created
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'public.transactions'::regclass 
AND contype = 'c';
