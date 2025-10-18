-- AGGRESSIVE RLS FIX - Completely reset all policies to prevent infinite recursion
-- This script will disable RLS, drop all policies, and create simple non-recursive ones

-- First, disable RLS on all tables to stop the recursion immediately
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE markets DISABLE ROW LEVEL SECURITY;
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (this will not error if they don't exist)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on profiles table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON profiles';
    END LOOP;
    
    -- Drop all policies on markets table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'markets') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON markets';
    END LOOP;
    
    -- Drop all policies on positions table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'positions') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON positions';
    END LOOP;
    
    -- Drop all policies on transactions table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'transactions') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON transactions';
    END LOOP;
END $$;

-- Now create VERY SIMPLE policies that don't reference other tables

-- PROFILES TABLE - Simple policies that only check auth.uid()
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- MARKETS TABLE - Allow all authenticated users to read, only creators to modify
CREATE POLICY "markets_select_all" ON markets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "markets_insert_auth" ON markets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "markets_update_creator" ON markets FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "markets_delete_creator" ON markets FOR DELETE USING (auth.uid() = creator_id);

-- POSITIONS TABLE - Users can only see/modify their own positions
CREATE POLICY "positions_select_own" ON positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "positions_insert_own" ON positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "positions_update_own" ON positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "positions_delete_own" ON positions FOR DELETE USING (auth.uid() = user_id);

-- TRANSACTIONS TABLE - Users can only see their own transactions
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Re-enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('profiles', 'markets', 'positions', 'transactions')
ORDER BY tablename, policyname;
