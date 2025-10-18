-- Add role column to profiles table for admin functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add settlement fields to markets table
ALTER TABLE public.markets 
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settled_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS winning_side BOOLEAN;

-- Create index for settlement queries
CREATE INDEX IF NOT EXISTS idx_markets_status_settled ON public.markets(status, settled_at);

-- Update RLS policies to allow admins to view and manage all data
-- Allow admins to view all profiles
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON public.profiles;
CREATE POLICY "admins_can_view_all_profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to update any profile
DROP POLICY IF EXISTS "admins_can_update_all_profiles" ON public.profiles;
CREATE POLICY "admins_can_update_all_profiles" ON public.profiles
FOR UPDATE USING (
  auth.uid() = id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to view all markets
DROP POLICY IF EXISTS "admins_can_view_all_markets" ON public.markets;
CREATE POLICY "admins_can_view_all_markets" ON public.markets
FOR SELECT USING (
  is_private = false OR 
  creator_id = auth.uid() OR 
  invited_user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to update any market (for settlement)
DROP POLICY IF EXISTS "admins_can_update_all_markets" ON public.markets;
CREATE POLICY "admins_can_update_all_markets" ON public.markets
FOR UPDATE USING (
  creator_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to view all positions (for settlement calculations)
DROP POLICY IF EXISTS "admins_can_view_all_positions" ON public.positions;
CREATE POLICY "admins_can_view_all_positions" ON public.positions
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Create settlement function
CREATE OR REPLACE FUNCTION settle_market(
  market_id_param UUID,
  winning_side_param BOOLEAN,
  admin_id_param UUID
) RETURNS JSON AS $$
DECLARE
  market_record RECORD;
  position_record RECORD;
  total_winners_shares NUMERIC := 0;
  total_pool_value NUMERIC := 0;
  payout_per_share NUMERIC := 0;
  settlement_result JSON;
  winners_count INTEGER := 0;
  losers_count INTEGER := 0;
BEGIN
  -- Verify admin permissions
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_id_param AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can settle markets';
  END IF;

  -- Get market details
  SELECT * INTO market_record FROM markets WHERE id = market_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;

  IF market_record.status = 'settled' THEN
    RAISE EXCEPTION 'Market already settled';
  END IF;

  -- Calculate total pool value (liquidity + fees)
  total_pool_value := COALESCE(market_record.liquidity_pool, 0);
  
  -- Add any collected fees to the pool
  SELECT COALESCE(SUM(fee_amount), 0) INTO total_pool_value 
  FROM fees 
  WHERE market_id = market_id_param;
  
  total_pool_value := total_pool_value + COALESCE(total_pool_value, 0);

  -- Calculate total winning shares
  SELECT COALESCE(SUM(shares), 0) INTO total_winners_shares
  FROM positions 
  WHERE market_id = market_id_param AND side = winning_side_param;

  -- Calculate payout per winning share
  IF total_winners_shares > 0 THEN
    payout_per_share := total_pool_value / total_winners_shares;
  ELSE
    payout_per_share := 0;
  END IF;

  -- Update winner balances and count participants
  FOR position_record IN 
    SELECT * FROM positions WHERE market_id = market_id_param
  LOOP
    IF position_record.side = winning_side_param THEN
      -- Winner: gets payout
      UPDATE profiles 
      SET balance = balance + (position_record.shares * payout_per_share)
      WHERE id = position_record.user_id;
      
      winners_count := winners_count + 1;
    ELSE
      -- Loser: gets nothing (shares become worthless)
      losers_count := losers_count + 1;
    END IF;
  END LOOP;

  -- Update market status
  UPDATE markets 
  SET 
    status = 'settled',
    outcome = winning_side_param,
    winning_side = winning_side_param,
    settled_at = NOW(),
    settled_by = admin_id_param
  WHERE id = market_id_param;

  -- Create settlement result
  settlement_result := json_build_object(
    'market_id', market_id_param,
    'winning_side', winning_side_param,
    'total_pool_value', total_pool_value,
    'total_winners_shares', total_winners_shares,
    'payout_per_share', payout_per_share,
    'winners_count', winners_count,
    'losers_count', losers_count,
    'settled_at', NOW(),
    'settled_by', admin_id_param
  );

  RETURN settlement_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION settle_market TO authenticated;
