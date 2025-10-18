-- Create LMSR version of execute_trade function
CREATE OR REPLACE FUNCTION execute_trade_lmsr(
  p_market_id UUID,
  p_user_id UUID,
  p_bet_amount DECIMAL,
  p_bet_side TEXT,
  p_qy DECIMAL,
  p_qn DECIMAL,
  p_yes_shares DECIMAL,
  p_no_shares DECIMAL,
  p_total_volume DECIMAL,
  p_calculated_shares DECIMAL,
  p_liquidity_pool DECIMAL
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
  
  -- Update user balance (subtract bet amount)
  UPDATE profiles 
  SET balance = balance - p_bet_amount 
  WHERE id = p_user_id;
  
  -- Update market with LMSR parameters
  UPDATE markets 
  SET 
    qy = p_qy,
    qn = p_qn,
    yes_shares = p_yes_shares,
    no_shares = p_no_shares,
    total_volume = p_total_volume,
    liquidity_pool = p_liquidity_pool,
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
    'Bet ' || p_bet_amount || ' on ' || p_bet_side || ' (LMSR)'
  );
  
  -- Return the updated market data
  RETURN row_to_json(updated_market);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_trade_lmsr TO authenticated;
