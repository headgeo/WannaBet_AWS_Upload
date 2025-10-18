-- Fix RLS policies for prediction market app
-- This script removes problematic recursive policies and creates simple, secure ones

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- Drop policies on other tables that might cause issues
DROP POLICY IF EXISTS "Users can view all markets" ON markets;
DROP POLICY IF EXISTS "Users can create markets" ON markets;
DROP POLICY IF EXISTS "Users can update their own markets" ON markets;
DROP POLICY IF EXISTS "Users can view all positions" ON positions;
DROP POLICY IF EXISTS "Users can create positions" ON positions;
DROP POLICY IF EXISTS "Users can update their own positions" ON positions;
DROP POLICY IF EXISTS "Users can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create transactions" ON transactions;

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies for profiles
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT USING (true); -- Allow all authenticated users to read profiles

CREATE POLICY "profiles_insert_policy" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id); -- Users can only insert their own profile

CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE USING (auth.uid() = id); -- Users can only update their own profile

-- Create policies for markets (public read, authenticated create/update)
CREATE POLICY "markets_select_policy" ON markets
    FOR SELECT USING (true); -- All users can view markets

CREATE POLICY "markets_insert_policy" ON markets
    FOR INSERT WITH CHECK (auth.uid() = creator_id); -- Users can create markets

CREATE POLICY "markets_update_policy" ON markets
    FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = settled_by); -- Creators and settlers can update

-- Create policies for positions
CREATE POLICY "positions_select_policy" ON positions
    FOR SELECT USING (auth.uid() = user_id); -- Users can only see their own positions

CREATE POLICY "positions_insert_policy" ON positions
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Users can only create their own positions

CREATE POLICY "positions_update_policy" ON positions
    FOR UPDATE USING (auth.uid() = user_id); -- Users can only update their own positions

-- Create policies for transactions
CREATE POLICY "transactions_select_policy" ON transactions
    FOR SELECT USING (auth.uid() = user_id); -- Users can only see their own transactions

CREATE POLICY "transactions_insert_policy" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Users can only create their own transactions

-- Create policies for market_participants
CREATE POLICY "market_participants_select_policy" ON market_participants
    FOR SELECT USING (true); -- All users can see market participants

CREATE POLICY "market_participants_insert_policy" ON market_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Users can only add themselves as participants

CREATE POLICY "market_participants_update_policy" ON market_participants
    FOR UPDATE USING (auth.uid() = user_id); -- Users can only update their own participation

-- Create policies for fees
CREATE POLICY "fees_select_policy" ON fees
    FOR SELECT USING (auth.uid() = user_id); -- Users can only see their own fees

CREATE POLICY "fees_insert_policy" ON fees
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Users can only create their own fee records

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON markets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON positions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON market_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON fees TO authenticated;

-- Grant all permissions to service role (for admin functions)
GRANT ALL ON profiles TO service_role;
GRANT ALL ON markets TO service_role;
GRANT ALL ON positions TO service_role;
GRANT ALL ON transactions TO service_role;
GRANT ALL ON market_participants TO service_role;
GRANT ALL ON fees TO service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_markets_creator_id ON markets(creator_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_market_id ON transactions(market_id);
