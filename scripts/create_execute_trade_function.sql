-- Create a function to execute trades with proper permissions
CREATE OR REPLACE FUNCTION execute_trade(
  p_market_id UUID,
  p_user_id UUID,
  p_bet_amount DECIMAL,
  p_bet_side TEXT,
  p_yes_liquidity DECIMAL,
  p_no_liquidity DECIMAL,
  p_yes_shares DECIMAL,
  p_no_shares DECIMAL,
  p_total_volume DECIMAL,
  p_calculated_shares DECIMAL
) RETURNS JSON AS $$
DECLARE
  current_balance DECIMAL;
  updated_market RECORD;
BEGIN
  -- Get current user balance
  SELECT balance INTO current_balance 
  FROM profiles 
  WHERE id = p_user_id;
  
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF current_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Update user balance
  UPDATE profiles 
  SET balance = balance - p_bet_amount 
  WHERE id = p_user_id;
  
  -- Update market liquidity (this bypasses RLS since it's in a function)
  UPDATE markets 
  SET 
    yes_liquidity = p_yes_liquidity,
    no_liquidity = p_no_liquidity,
    yes_shares = p_yes_shares,
    no_shares = p_no_shares,
    total_volume = p_total_volume,
    updated_at = NOW()
  WHERE id = p_market_id
  RETURNING * INTO updated_market;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, market_id, type, amount, description)
  VALUES (
    p_user_id, 
    p_market_id, 
    'bet', 
    p_bet_amount, 
    'Bet ' || p_bet_amount || ' on ' || p_bet_side
  );
  
  -- Return the updated market data
  RETURN row_to_json(updated_market);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_trade TO authenticated;
