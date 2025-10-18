-- Creating sell_shares database function
CREATE OR REPLACE FUNCTION sell_shares(
  p_position_id UUID,
  p_shares_to_sell DECIMAL,
  p_expected_price DECIMAL,
  p_market_id UUID,
  p_user_id UUID,
  p_yes_liquidity DECIMAL,
  p_no_liquidity DECIMAL,
  p_yes_shares DECIMAL,
  p_no_shares DECIMAL,
  p_total_volume DECIMAL
) RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_position RECORD;
  v_sell_value DECIMAL;
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

  -- Calculate sell value
  v_sell_value := p_shares_to_sell * p_expected_price;
  v_remaining_shares := v_position.shares - p_shares_to_sell;
  v_side_text := CASE WHEN v_position.side THEN 'yes' ELSE 'no' END;

  -- Get current user balance
  SELECT balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  v_new_balance := v_current_balance + v_sell_value;

  -- Update user balance
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

  -- Update market liquidity (add back to the pool)
  UPDATE markets
  SET 
    yes_liquidity = p_yes_liquidity,
    no_liquidity = p_no_liquidity,
    yes_shares = p_yes_shares,
    no_shares = p_no_shares,
    total_volume = p_total_volume
  WHERE id = p_market_id;

  -- Changed transaction type from 'sell' to 'bet' to match working execute_trade function
  -- Create transaction record
  INSERT INTO transactions (user_id, market_id, type, amount, description)
  VALUES (p_user_id, p_market_id, 'bet', v_sell_value, 
          'Sold ' || p_shares_to_sell || ' ' || v_side_text || ' shares at $' || p_expected_price || ' per share');

  -- Return success result
  RETURN json_build_object(
    'success', true,
    'sell_value', v_sell_value,
    'remaining_shares', v_remaining_shares,
    'new_balance', v_new_balance
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Sell execution failed: %', SQLERRM;
END;
$$;
