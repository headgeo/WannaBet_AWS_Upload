-- Create LMSR version of sell_shares function with fee handling
CREATE OR REPLACE FUNCTION sell_shares_lmsr(
  p_position_id UUID,
  p_shares_to_sell DECIMAL,
  p_expected_value DECIMAL,
  p_market_id UUID,
  p_user_id UUID,
  p_qy DECIMAL,
  p_qn DECIMAL,
  p_yes_shares DECIMAL,
  p_no_shares DECIMAL,
  p_total_volume DECIMAL,
  p_liquidity_pool DECIMAL
) RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_position RECORD;
  v_gross_value DECIMAL;
  v_fee_amount DECIMAL;
  v_net_value DECIMAL;
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_remaining_shares DECIMAL;
  v_side_text TEXT;
BEGIN
  -- Get the position details
  SELECT * INTO v_position
  FROM positions
  WHERE id = p_position_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Position not found or does not belong to user';
  END IF;

  -- Check if user has enough shares
  IF v_position.shares < p_shares_to_sell THEN
    RAISE EXCEPTION 'Insufficient shares to sell';
  END IF;

  -- Calculate fee and net value
  v_gross_value := p_expected_value;
  v_fee_amount := v_gross_value * 0.005; -- 0.5% fee
  v_net_value := v_gross_value - v_fee_amount;
  v_remaining_shares := v_position.shares - p_shares_to_sell;
  v_side_text := CASE WHEN v_position.side THEN 'yes' ELSE 'no' END;

  -- Get current user balance
  SELECT balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  v_new_balance := v_current_balance + v_net_value; -- Add net value (after fee)

  -- Update user balance (add net sell value)
  UPDATE profiles
  SET balance = v_new_balance
  WHERE id = p_user_id;

  -- Update or delete position
  IF v_remaining_shares > 0 THEN
    -- Update position with remaining shares
    UPDATE positions
    SET 
      shares = v_remaining_shares,
      amount_invested = v_position.amount_invested - (v_position.amount_invested * (p_shares_to_sell / v_position.shares))
    WHERE id = p_position_id;
  ELSE
    -- Delete position if all shares sold
    DELETE FROM positions WHERE id = p_position_id;
  END IF;

  -- Update market with LMSR parameters
  UPDATE markets
  SET 
    qy = p_qy,
    qn = p_qn,
    yes_shares = p_yes_shares,
    no_shares = p_no_shares,
    total_volume = p_total_volume,
    liquidity_pool = p_liquidity_pool
  WHERE id = p_market_id;

  -- Create transaction record (showing gross value)
  INSERT INTO transactions (user_id, market_id, type, amount, description)
  VALUES (p_user_id, p_market_id, 'bet', v_net_value, 
          'Sold ' || p_shares_to_sell || ' ' || v_side_text || ' shares for $' || v_gross_value || ' (LMSR) - Fee: $' || v_fee_amount);

  -- Record the fee in the fees table
  INSERT INTO fees (user_id, market_id, transaction_type, original_amount, fee_amount, fee_percentage, net_amount)
  VALUES (
    p_user_id,
    p_market_id,
    'sell',
    v_gross_value,
    v_fee_amount,
    0.005,
    v_net_value
  );

  -- Return success result
  RETURN json_build_object(
    'success', true,
    'gross_value', v_gross_value,
    'fee_amount', v_fee_amount,
    'net_value', v_net_value,
    'remaining_shares', v_remaining_shares,
    'new_balance', v_new_balance
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Sell execution failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sell_shares_lmsr TO authenticated;
