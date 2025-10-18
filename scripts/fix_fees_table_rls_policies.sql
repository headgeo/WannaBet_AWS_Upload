-- Fix RLS policies for fees table to allow fee recording
-- This script ensures that the split_trading_fees function can insert fee records

-- First, let's check if RLS is enabled and what policies exist
-- We'll disable RLS temporarily to allow the function to work, then create proper policies

-- Disable RLS on fees table temporarily (we'll re-enable with proper policies)
ALTER TABLE fees DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with proper policies
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow service role (used by functions) to insert any fee record
CREATE POLICY "Allow service role to insert fees" ON fees
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy 2: Allow authenticated users to view their own fee records
CREATE POLICY "Users can view their own fees" ON fees
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 3: Allow users to view fees for markets they created (creator fees)
CREATE POLICY "Creators can view their market fees" ON fees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM markets 
      WHERE markets.id = fees.market_id 
      AND markets.creator_id = auth.uid()
    )
  );

-- Policy 4: Allow the split_trading_fees function to insert records
-- This creates a security definer function that can bypass RLS
CREATE OR REPLACE FUNCTION split_trading_fees_secure(
  p_market_id UUID,
  p_user_id UUID,
  p_creator_id UUID,
  p_total_fee DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_fee DECIMAL;
  site_fee DECIMAL;
BEGIN
  -- Calculate split fees (50/50)
  creator_fee := p_total_fee / 2;
  site_fee := p_total_fee / 2;
  
  -- Insert creator fee record
  INSERT INTO fees (market_id, user_id, amount, fee_type, created_at)
  VALUES (p_market_id, p_creator_id, creator_fee, 'creator', NOW());
  
  -- Insert site fee record (no user_id for site fees)
  INSERT INTO fees (market_id, user_id, amount, fee_type, created_at)
  VALUES (p_market_id, NULL, site_fee, 'site', NOW());
  
  -- Update creator's total fees earned
  UPDATE markets 
  SET creator_fees_earned = COALESCE(creator_fees_earned, 0) + creator_fee
  WHERE id = p_market_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION split_trading_fees_secure TO authenticated;
