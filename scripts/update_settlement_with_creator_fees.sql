-- Drop the existing settlement function to avoid parameter conflicts
DROP FUNCTION IF EXISTS settle_market(UUID, BOOLEAN, UUID);

-- Update settlement function to pay out creator fees when market is settled
CREATE OR REPLACE FUNCTION settle_market(
  market_id_param UUID,
  outcome_param BOOLEAN,
  admin_user_id UUID
) RETURNS JSON AS $$
DECLARE
  market_record RECORD;
  position_record RECORD;
  total_payout NUMERIC := 0;
  creator_fees_to_pay NUMERIC := 0;
  result JSON;
BEGIN
  -- Get market details
  SELECT * INTO market_record FROM markets WHERE id = market_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  IF market_record.status = 'closed' THEN
    RETURN json_build_object('success', false, 'error', 'Market already settled');
  END IF;

  -- Calculate total payout needed for winners
  FOR position_record IN 
    SELECT p.*, pr.balance as user_balance
    FROM positions p
    JOIN profiles pr ON p.user_id = pr.id
    WHERE p.market_id = market_id_param 
    AND p.side = outcome_param
    AND p.shares > 0
  LOOP
    total_payout := total_payout + position_record.shares;
  END LOOP;

  -- Check if liquidity pool has sufficient funds for winner payouts only
  IF market_record.liquidity_pool < total_payout THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Insufficient liquidity pool funds for winner payouts',
      'required', total_payout,
      'available', market_record.liquidity_pool
    );
  END IF;

  -- Get creator fees earned for this market
  SELECT COALESCE(creator_fees_earned, 0) INTO creator_fees_to_pay 
  FROM markets WHERE id = market_id_param;

  -- Pay winners $1 per share from liquidity pool
  FOR position_record IN 
    SELECT p.*, pr.balance as user_balance
    FROM positions p
    JOIN profiles pr ON p.user_id = pr.id
    WHERE p.market_id = market_id_param 
    AND p.side = outcome_param
    AND p.shares > 0
  LOOP
    -- Update user balance
    UPDATE profiles 
    SET balance = balance + position_record.shares
    WHERE id = position_record.user_id;
    
    -- Record transaction
    INSERT INTO transactions (user_id, market_id, type, amount, description)
    VALUES (
      position_record.user_id,
      market_id_param,
      'settlement_payout',
      position_record.shares,
      'Settlement payout: $1 per share'
    );
    
    -- Send notification
    INSERT INTO notifications (user_id, market_id, type, title, message)
    VALUES (
      position_record.user_id,
      market_id_param,
      'settlement',
      'Market Settled - You Won!',
      format('Congratulations! You won $%.2f from "%s"', position_record.shares, market_record.title)
    );
  END LOOP;

  -- Pay creator their accumulated fees (not from liquidity pool - these were collected separately)
  IF creator_fees_to_pay > 0 THEN
    UPDATE profiles 
    SET balance = balance + creator_fees_to_pay
    WHERE id = market_record.creator_id;
    
    -- Record creator fee payout transaction
    INSERT INTO transactions (user_id, market_id, type, amount, description)
    VALUES (
      market_record.creator_id,
      market_id_param,
      'creator_fee_payout',
      creator_fees_to_pay,
      'Creator fee payout from market settlement'
    );
    
    -- Send notification to creator
    INSERT INTO notifications (user_id, market_id, type, title, message)
    VALUES (
      market_record.creator_id,
      market_id_param,
      'creator_payout',
      'Creator Fees Paid',
      format('You received $%.2f in creator fees from "%s"', creator_fees_to_pay, market_record.title)
    );
  END IF;

  -- Update market status and deduct ONLY winner payouts from liquidity pool
  UPDATE markets 
  SET 
    status = 'closed',
    outcome = outcome_param,
    winning_side = outcome_param,
    settled_by = admin_user_id,
    settled_at = NOW(),
    liquidity_pool = liquidity_pool - total_payout,  -- Only deduct winner payouts
    creator_fees_earned = 0  -- Reset since fees have been paid out
  WHERE id = market_id_param;

  -- Notify losers
  FOR position_record IN 
    SELECT p.*, pr.balance as user_balance
    FROM positions p
    JOIN profiles pr ON p.user_id = pr.id
    WHERE p.market_id = market_id_param 
    AND p.side != outcome_param
    AND p.shares > 0
  LOOP
    INSERT INTO notifications (user_id, market_id, type, title, message)
    VALUES (
      position_record.user_id,
      market_id_param,
      'settlement',
      'Market Settled',
      format('The market "%s" has been settled. Unfortunately, your prediction was incorrect.', market_record.title)
    );
  END LOOP;

  result := json_build_object(
    'success', true,
    'total_payout', total_payout,
    'creator_fees_paid', creator_fees_to_pay,
    'remaining_liquidity', market_record.liquidity_pool - total_payout
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION settle_market TO authenticated;
