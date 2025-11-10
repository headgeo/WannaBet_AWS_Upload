-- ========================================
-- COMPLETE AWS RDS DATABASE BACKUP SCRIPT
-- ========================================
-- This script contains 100% of the current prediction market platform functionality
-- Run this script to restore all tables, functions, triggers, indexes, and constraints
-- Last updated: Current state as of latest changes
-- ========================================

-- ========================================
-- PART 1: TABLE DEFINITIONS
-- ========================================

-- Profiles table (users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  balance NUMERIC DEFAULT 1000.00,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES profiles(id),
  qy NUMERIC DEFAULT 0,
  qn NUMERIC DEFAULT 0,
  b NUMERIC DEFAULT 100,
  yes_shares NUMERIC DEFAULT 0,
  no_shares NUMERIC DEFAULT 0,
  total_volume NUMERIC DEFAULT 0,
  liquidity_pool NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_settlement', 'settled', 'cancelled', 'suspended')),
  outcome BOOLEAN,
  winning_side BOOLEAN,
  settled_by UUID REFERENCES profiles(id),
  settled_at TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_private BOOLEAN DEFAULT FALSE,
  group_id UUID,
  settlement_status TEXT CHECK (settlement_status IN ('pending_contest', 'contested', 'resolved', 'uncontested') OR settlement_status IS NULL),
  settlement_initiated_at TIMESTAMP,
  contest_deadline TIMESTAMP,
  creator_settlement_outcome BOOLEAN,
  market_type TEXT DEFAULT 'private' CHECK (market_type IN ('private', 'public'))
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  market_id UUID REFERENCES markets(id),
  side BOOLEAN NOT NULL,
  shares NUMERIC NOT NULL DEFAULT 0,
  amount_invested NUMERIC NOT NULL DEFAULT 0,
  avg_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  market_id UUID REFERENCES markets(id),
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  shares NUMERIC DEFAULT 0,
  price_per_share NUMERIC,
  cost_basis NUMERIC,
  realized_pnl NUMERIC,
  side TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fees table
CREATE TABLE IF NOT EXISTS fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  user_id UUID REFERENCES profiles(id),
  fee_type TEXT NOT NULL CHECK (fee_type IN ('creator_fee', 'liquidity_fee')),
  fee_amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  market_id UUID REFERENCES markets(id),
  type TEXT NOT NULL CHECK (type IN ('market_settled', 'trade', 'creator_fee', 'trade_executed', 'shares_sold', 'settlement', 'settlement_bond_returned', 'bond_loss', 'liquidity_returned', 'contest_bond_returned', 'vote_bond_returned', 'market_cancelled')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Market price history table
CREATE TABLE IF NOT EXISTS market_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  yes_probability NUMERIC NOT NULL,
  no_probability NUMERIC NOT NULL,
  qy NUMERIC,
  qn NUMERIC,
  total_volume NUMERIC,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Groups table (for private markets)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User groups junction table
CREATE TABLE IF NOT EXISTS user_groups (
  user_id UUID REFERENCES profiles(id),
  group_id UUID REFERENCES groups(id),
  PRIMARY KEY (user_id, group_id)
);

-- Market participants table
CREATE TABLE IF NOT EXISTS market_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  user_id UUID REFERENCES profiles(id),
  invited_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(market_id, user_id)
);

-- Settlement bonds table
CREATE TABLE IF NOT EXISTS settlement_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  creator_id UUID REFERENCES profiles(id),
  bond_amount NUMERIC NOT NULL,
  outcome_chosen BOOLEAN NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'forfeited', 'resolved')),
  resolved_at TIMESTAMP,
  payout_amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Settlement contests table
CREATE TABLE IF NOT EXISTS settlement_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  creator_id UUID REFERENCES profiles(id),
  contestant_id UUID REFERENCES profiles(id),
  contest_bond_amount NUMERIC NOT NULL,
  contested_outcome BOOLEAN NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'voting', 'resolved')),
  vote_deadline TIMESTAMP NOT NULL,
  resolution_outcome BOOLEAN,
  payout_amount NUMERIC,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Settlement votes table
CREATE TABLE IF NOT EXISTS settlement_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES settlement_contests(id),
  voter_id UUID REFERENCES profiles(id),
  vote_outcome BOOLEAN NOT NULL,
  vote_bond_amount NUMERIC NOT NULL,
  is_correct BOOLEAN,
  payout_amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contest_id, voter_id)
);

-- Settlement notifications table
CREATE TABLE IF NOT EXISTS settlement_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  user_id UUID REFERENCES profiles(id),
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Blockchain transactions table
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  transaction_hash TEXT UNIQUE,
  transaction_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- UMA proposals table
CREATE TABLE IF NOT EXISTS uma_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id),
  proposer_id UUID REFERENCES profiles(id),
  proposed_outcome BOOLEAN NOT NULL,
  bond_amount NUMERIC NOT NULL,
  proposal_timestamp TIMESTAMP DEFAULT NOW(),
  expiry_timestamp TIMESTAMP,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- UMA disputes table
CREATE TABLE IF NOT EXISTS uma_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES uma_proposals(id),
  disputer_id UUID REFERENCES profiles(id),
  dispute_bond_amount NUMERIC NOT NULL,
  dispute_timestamp TIMESTAMP DEFAULT NOW(),
  resolution_outcome BOOLEAN,
  resolved_at TIMESTAMP,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- PART 2: PERFORMANCE INDEXES
-- ========================================

-- Markets table indexes
CREATE INDEX IF NOT EXISTS idx_markets_status_created 
  ON markets(status, created_at DESC) 
  WHERE status IN ('active', 'suspended', 'contested');

CREATE INDEX IF NOT EXISTS idx_markets_end_date 
  ON markets(end_date) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_markets_creator 
  ON markets(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_markets_settlement_status 
  ON markets(settlement_status, contest_deadline) 
  WHERE settlement_status IN ('pending_contest', 'contested');

CREATE INDEX IF NOT EXISTS idx_markets_market_type 
  ON markets(market_type, status);

-- Positions table indexes
CREATE INDEX IF NOT EXISTS idx_positions_user_market 
  ON positions(user_id, market_id);

CREATE INDEX IF NOT EXISTS idx_positions_market 
  ON positions(market_id);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_market 
  ON transactions(market_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_type_created 
  ON transactions(type, created_at DESC) 
  WHERE type IN ('buy', 'sell');

-- Settlement tables indexes
CREATE INDEX IF NOT EXISTS idx_settlement_bonds_market 
  ON settlement_bonds(market_id, status);

CREATE INDEX IF NOT EXISTS idx_settlement_bonds_creator 
  ON settlement_bonds(creator_id, status);

CREATE INDEX IF NOT EXISTS idx_settlement_contests_market 
  ON settlement_contests(market_id, status);

CREATE INDEX IF NOT EXISTS idx_settlement_contests_deadline 
  ON settlement_contests(vote_deadline) 
  WHERE status = 'voting';

CREATE INDEX IF NOT EXISTS idx_settlement_votes_contest 
  ON settlement_votes(contest_id, vote_outcome);

CREATE INDEX IF NOT EXISTS idx_settlement_votes_voter 
  ON settlement_votes(voter_id, created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_market 
  ON notifications(market_id, created_at DESC) 
  WHERE market_id IS NOT NULL;

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_balance 
  ON profiles(balance) 
  WHERE balance > 0;

-- Market price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_market_time 
  ON market_price_history(market_id, timestamp DESC);

-- Groups indexes
CREATE INDEX IF NOT EXISTS idx_groups_creator 
  ON groups(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_groups_user 
  ON user_groups(user_id);

CREATE INDEX IF NOT EXISTS idx_user_groups_group 
  ON user_groups(group_id);

-- Market participants indexes
CREATE INDEX IF NOT EXISTS idx_market_participants_market 
  ON market_participants(market_id);

CREATE INDEX IF NOT EXISTS idx_market_participants_user 
  ON market_participants(user_id);

-- Fees indexes
CREATE INDEX IF NOT EXISTS idx_fees_market 
  ON fees(market_id, fee_type);

CREATE INDEX IF NOT EXISTS idx_fees_user 
  ON fees(user_id, created_at DESC);

-- UMA tables indexes
CREATE INDEX IF NOT EXISTS idx_uma_proposals_market 
  ON uma_proposals(market_id, status);

CREATE INDEX IF NOT EXISTS idx_uma_proposals_proposer 
  ON uma_proposals(proposer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uma_disputes_proposal 
  ON uma_disputes(proposal_id, status);

-- Blockchain transactions indexes
CREATE INDEX IF NOT EXISTS idx_blockchain_txns_market 
  ON blockchain_transactions(market_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_txns_hash 
  ON blockchain_transactions(transaction_hash);

-- ========================================
-- PART 3: CORE TRADING FUNCTIONS
-- ========================================

-- Execute trade (buy shares) function
CREATE OR REPLACE FUNCTION execute_trade_lmsr(
  p_user_id UUID,
  p_market_id UUID,
  p_side TEXT,
  p_amount NUMERIC,
  p_shares NUMERIC,
  p_new_qy NUMERIC,
  p_new_qn NUMERIC,
  p_total_volume NUMERIC,
  p_fee_amount NUMERIC,
  p_creator_fee NUMERIC,
  p_liquidity_fee NUMERIC,
  p_new_liquidity_pool NUMERIC
) RETURNS JSON AS $$
DECLARE
  v_user_balance NUMERIC;
  v_market_status TEXT;
  v_position_id UUID;
  v_existing_shares NUMERIC := 0;
  v_existing_invested NUMERIC := 0;
  v_new_avg_price NUMERIC;
  v_price_per_share NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Lock the user's profile row
  SELECT balance INTO v_user_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user has sufficient balance
  IF v_user_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Lock the market row
  SELECT status INTO v_market_status
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  -- Check if market is active
  IF v_market_status != 'active' THEN
    RAISE EXCEPTION 'Market is not active';
  END IF;

  -- Calculate price per share
  v_price_per_share := p_amount / NULLIF(p_shares, 0);

  -- Update user balance
  UPDATE profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  -- Update market state
  UPDATE markets
  SET 
    qy = p_new_qy,
    qn = p_new_qn,
    total_volume = p_total_volume,
    liquidity_pool = p_new_liquidity_pool
  WHERE id = p_market_id;

  -- Check if position exists
  SELECT id, shares, amount_invested
  INTO v_position_id, v_existing_shares, v_existing_invested
  FROM positions
  WHERE user_id = p_user_id 
    AND market_id = p_market_id 
    AND side = (p_side = 'YES');

  IF v_position_id IS NULL THEN
    -- Create new position
    v_new_avg_price := p_amount / NULLIF(p_shares, 0);
    
    INSERT INTO positions (user_id, market_id, side, shares, amount_invested, avg_price)
    VALUES (p_user_id, p_market_id, p_side = 'YES', p_shares, p_amount, v_new_avg_price)
    RETURNING id INTO v_position_id;
  ELSE
    -- Update existing position
    v_new_avg_price := (v_existing_invested + p_amount) / NULLIF(v_existing_shares + p_shares, 0);
    
    UPDATE positions
    SET 
      shares = shares + p_shares,
      amount_invested = amount_invested + p_amount,
      avg_price = v_new_avg_price
    WHERE id = v_position_id;
  END IF;

  -- Store transaction with P&L tracking data
  INSERT INTO transactions (
    user_id, 
    market_id, 
    type, 
    amount, 
    shares,
    price_per_share,
    side,
    description
  )
  VALUES (
    p_user_id,
    p_market_id,
    'bet',
    p_amount,
    p_shares,
    v_price_per_share,
    p_side,
    'Bought ' || p_shares || ' ' || p_side || ' shares'
  )
  RETURNING id INTO v_transaction_id;

  -- Create notification with market_id included
  INSERT INTO notifications (user_id, market_id, type, title, message, link)
  VALUES (
    p_user_id,
    p_market_id,
    'trade_executed',
    'Trade Executed',
    'Your trade of ' || p_shares || ' ' || p_side || ' shares was executed',
    '/market/' || p_market_id
  );

  RETURN json_build_object(
    'success', true,
    'position_id', v_position_id,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sell shares function
CREATE OR REPLACE FUNCTION sell_shares_lmsr(
  p_position_id UUID,
  p_shares_to_sell NUMERIC,
  p_expected_value NUMERIC,
  p_market_id UUID,
  p_user_id UUID,
  p_qy NUMERIC,
  p_qn NUMERIC,
  p_yes_shares NUMERIC,
  p_no_shares NUMERIC,
  p_total_volume NUMERIC,
  p_liquidity_pool NUMERIC
) RETURNS JSON AS $$
DECLARE
  v_position RECORD;
  v_market RECORD;
  v_sale_value NUMERIC;
  v_fee_amount NUMERIC;
  v_creator_fee NUMERIC;
  v_liquidity_fee NUMERIC;
  v_net_value NUMERIC;
  v_new_shares NUMERIC;
  v_cost_basis NUMERIC;
  v_realized_pnl NUMERIC;
  v_price_per_share NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Lock and get position
  SELECT * INTO v_position
  FROM positions
  WHERE id = p_position_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Position not found or does not belong to user';
  END IF;

  IF v_position.shares < p_shares_to_sell THEN
    RAISE EXCEPTION 'Insufficient shares to sell';
  END IF;

  -- Lock market
  SELECT * INTO v_market
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF v_market.status != 'active' THEN
    RAISE EXCEPTION 'Market is not active';
  END IF;

  -- Calculate sale value and fees
  v_sale_value := p_expected_value;
  v_fee_amount := v_sale_value * 0.01;
  v_creator_fee := v_fee_amount * 0.5;
  v_liquidity_fee := v_fee_amount * 0.5;
  v_net_value := v_sale_value - v_fee_amount;

  -- Calculate P&L metrics
  v_cost_basis := v_position.avg_price;
  v_price_per_share := v_sale_value / NULLIF(p_shares_to_sell, 0);
  v_realized_pnl := (v_price_per_share - v_cost_basis) * p_shares_to_sell;

  -- Update user balance
  UPDATE profiles
  SET balance = balance + v_net_value
  WHERE id = p_user_id;

  -- Update market state
  UPDATE markets
  SET 
    qy = p_qy,
    qn = p_qn,
    yes_shares = p_yes_shares,
    no_shares = p_no_shares,
    total_volume = p_total_volume,
    liquidity_pool = p_liquidity_pool
  WHERE id = p_market_id;

  -- Update or delete position
  v_new_shares := v_position.shares - p_shares_to_sell;
  
  IF v_new_shares < 0.01 THEN
    DELETE FROM positions WHERE id = p_position_id;
  ELSE
    UPDATE positions
    SET 
      shares = v_new_shares,
      amount_invested = amount_invested - (v_position.avg_price * p_shares_to_sell)
    WHERE id = p_position_id;
  END IF;

  -- Store transaction
  INSERT INTO transactions (
    user_id,
    market_id,
    type,
    amount,
    shares,
    price_per_share,
    cost_basis,
    realized_pnl,
    side,
    description
  )
  VALUES (
    p_user_id,
    p_market_id,
    'sell',
    v_net_value,
    p_shares_to_sell,
    v_price_per_share,
    v_cost_basis,
    v_realized_pnl,
    CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END,
    'Sold ' || p_shares_to_sell || ' ' || CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END || ' shares for $' || ROUND(v_net_value, 2)
  )
  RETURNING id INTO v_transaction_id;

  -- Create notification
  INSERT INTO notifications (user_id, market_id, type, title, message, link)
  VALUES (
    p_user_id,
    p_market_id,
    'shares_sold',
    'Shares Sold',
    'Sold ' || p_shares_to_sell || ' shares for $' || ROUND(v_net_value, 2) || ' (P&L: $' || ROUND(v_realized_pnl, 2) || ')',
    '/market/' || p_market_id
  );

  RETURN json_build_object(
    'success', true,
    'net_value', v_net_value,
    'fee_amount', v_fee_amount,
    'realized_pnl', v_realized_pnl,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PART 4: SETTLEMENT FUNCTIONS
-- ========================================

-- Initiate settlement function
CREATE OR REPLACE FUNCTION initiate_settlement(
  p_creator_id UUID,
  p_market_id UUID,
  p_outcome BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_fees DECIMAL(10,2);
  v_bond_id UUID;
  v_contest_deadline TIMESTAMP;
BEGIN
  -- Verify the user is the market creator
  IF NOT EXISTS (
    SELECT 1 FROM markets 
    WHERE id = p_market_id 
    AND creator_id = p_creator_id
    AND is_private = true
  ) THEN
    RAISE EXCEPTION 'Only the market creator can initiate settlement for private markets';
  END IF;

  -- Only block if market is actually settled or actively in contest/voting
  IF EXISTS (
    SELECT 1 FROM markets 
    WHERE id = p_market_id 
    AND (
      status = 'settled' 
      OR settlement_status IN ('pending_contest', 'contested', 'voting')
    )
  ) THEN
    RAISE EXCEPTION 'Market is already settled or in settlement process';
  END IF;

  -- Calculate creator's fees
  SELECT COALESCE(SUM(fee_amount), 0)
  INTO v_creator_fees
  FROM fees
  WHERE market_id = p_market_id
    AND fee_type = 'creator_fee'
    AND user_id = p_creator_id;

  -- Set contest deadline to 1 hour from now
  v_contest_deadline := NOW() + INTERVAL '1 hour';

  -- Create settlement bond
  INSERT INTO settlement_bonds (
    market_id,
    creator_id,
    bond_amount,
    outcome_chosen,
    status
  ) VALUES (
    p_market_id,
    p_creator_id,
    v_creator_fees,
    p_outcome,
    'active'
  )
  RETURNING id INTO v_bond_id;

  -- Update market status
  UPDATE markets
  SET 
    settlement_status = 'pending_contest',
    settlement_initiated_at = NOW(),
    contest_deadline = v_contest_deadline,
    creator_settlement_outcome = p_outcome,
    status = 'suspended'
  WHERE id = p_market_id;

  RETURN json_build_object(
    'bond_id', v_bond_id,
    'bond_amount', v_creator_fees,
    'contest_deadline', v_contest_deadline,
    'outcome', p_outcome
  );
END;
$$;

-- Check pending settlements function (comprehensive settlement processor)
CREATE OR REPLACE FUNCTION check_pending_settlements()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_market RECORD;
  v_contest RECORD;
  v_vote RECORD;
  v_position RECORD;
  v_bond RECORD;
  v_settlement_bond RECORD;
  v_settlement_bond_amount NUMERIC;
  v_yes_votes INT;
  v_no_votes INT;
  v_winning_outcome BOOLEAN;
  v_total_payout NUMERIC;
  v_payout NUMERIC;
  v_remaining_liquidity NUMERIC;
  v_initial_liquidity NUMERIC;
  v_liquidity_allocation NUMERIC;
  v_results JSON;
  v_processed_markets INT := 0;
  v_processed_contests INT := 0;
  v_total_incorrect_bonds NUMERIC := 0;
  v_total_correct_bonds NUMERIC := 0;
BEGIN
  v_results := '[]'::JSON;

  -- Part 1: Process uncontested markets past their contest deadline
  FOR v_market IN
    SELECT m.*, p.username as creator_username
    FROM markets m
    JOIN profiles p ON m.creator_id = p.id
    WHERE m.status IN ('pending_settlement', 'suspended')
      AND m.contest_deadline < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM settlement_contests sc
        WHERE sc.market_id = m.id AND sc.status IN ('active', 'voting')
      )
  LOOP
    v_settlement_bond_amount := COALESCE(
      (SELECT bond_amount FROM settlement_bonds 
       WHERE market_id = v_market.id 
       LIMIT 1),
      0
    );

    -- Calculate total payout
    SELECT COALESCE(SUM(
      CASE
        WHEN v_market.creator_settlement_outcome = p.side THEN p.shares * 1.00
        ELSE 0
      END
    ), 0) INTO v_total_payout
    FROM positions p
    WHERE p.market_id = v_market.id;

    -- Update market to settled
    UPDATE markets
    SET status = 'settled', 
        settlement_status = 'resolved',
        outcome = v_market.creator_settlement_outcome,
        winning_side = v_market.creator_settlement_outcome, 
        settled_at = NOW(), 
        settled_by = v_market.creator_id,
        liquidity_pool = GREATEST(0, liquidity_pool - v_total_payout)
    WHERE id = v_market.id;

    -- Process winning positions
    FOR v_position IN
      SELECT p.*, pr.username, pr.display_name
      FROM positions p
      JOIN profiles pr ON p.user_id = pr.id
      WHERE p.market_id = v_market.id
        AND v_market.creator_settlement_outcome = p.side
        AND p.shares > 0
    LOOP
      v_payout := v_position.shares * 1.00;
      UPDATE profiles SET balance = balance + v_payout WHERE id = v_position.user_id;

      INSERT INTO transactions (
        user_id, market_id, type, amount, shares, 
        price_per_share, cost_basis, realized_pnl, side, 
        description, created_at
      )
      VALUES (
        v_position.user_id, v_market.id, 'sell', v_payout, v_position.shares,
        1.00, v_position.amount_invested, v_payout - v_position.amount_invested,
        CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END,
        'Private market settlement - Winner', NOW()
      );

      INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
      VALUES (
        v_position.user_id, 'settlement', 'Market Settled',
        format('Market "%s" settled %s. You won $%s (P&L: %s$%s)',
          v_market.title,
          CASE WHEN v_market.creator_settlement_outcome THEN 'YES' ELSE 'NO' END,
          ROUND(v_payout, 2)::TEXT,
          CASE WHEN v_payout - v_position.amount_invested >= 0 THEN '+' ELSE '' END,
          ROUND(ABS(v_payout - v_position.amount_invested), 2)::TEXT
        ),
        v_market.id, NOW()
      );
    END LOOP;

    -- Process losing positions
    FOR v_position IN
      SELECT p.*, pr.username, pr.display_name
      FROM positions p
      JOIN profiles pr ON p.user_id = pr.id
      WHERE p.market_id = v_market.id
        AND v_market.creator_settlement_outcome != p.side
        AND p.shares > 0
    LOOP
      INSERT INTO transactions (
        user_id, market_id, type, amount, shares, 
        price_per_share, cost_basis, realized_pnl, side, 
        description, created_at
      )
      VALUES (
        v_position.user_id, v_market.id, 'sell', 0, v_position.shares,
        0, v_position.amount_invested, -v_position.amount_invested,
        CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END,
        'Private market settlement - Loser', NOW()
      );

      INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
      VALUES (
        v_position.user_id, 'settlement', 'Market Settled',
        format('Market "%s" settled %s. You lost $%s',
          v_market.title,
          CASE WHEN v_market.creator_settlement_outcome THEN 'YES' ELSE 'NO' END,
          ROUND(v_position.amount_invested, 2)::TEXT
        ),
        v_market.id, NOW()
      );
    END LOOP;

    -- Return settlement bond
    SELECT * INTO v_settlement_bond
    FROM settlement_bonds
    WHERE market_id = v_market.id
    LIMIT 1;

    IF FOUND THEN
      v_settlement_bond_amount := COALESCE(v_settlement_bond.bond_amount, 0);
      
      UPDATE settlement_bonds
      SET resolved_at = NOW(), 
          payout_amount = COALESCE(bond_amount, 0), 
          status = 'resolved'
      WHERE market_id = v_market.id;

      IF v_settlement_bond_amount > 0 THEN
        UPDATE profiles 
        SET balance = balance + v_settlement_bond_amount 
        WHERE id = v_market.creator_id;

        INSERT INTO transactions (
          user_id, market_id, type, amount, shares, 
          price_per_share, cost_basis, realized_pnl, side, 
          description, created_at
        )
        VALUES (
          v_market.creator_id, v_market.id, 'settlement_bond_return', v_settlement_bond_amount, 0,
          0, 0, 0, NULL,
          'Settlement bond returned - Uncontested market', NOW()
        );
      END IF;

      INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
      VALUES (
        v_market.creator_id, 'settlement_bond_returned', 'Settlement Bond Returned',
        format('Your settlement bond of $%s has been returned for market "%s" (P&L: $0.00)', 
          ROUND(v_settlement_bond_amount, 2)::TEXT, v_market.title),
        v_market.id, NOW()
      );
    END IF;

    -- Return liquidity
    SELECT COALESCE(liquidity_pool, 0) INTO v_remaining_liquidity FROM markets WHERE id = v_market.id;
    v_initial_liquidity := (COALESCE(v_market.b, 0) + 1) * ln(2);

    v_liquidity_allocation := 0;
    IF v_remaining_liquidity > 0 AND v_initial_liquidity > 0 THEN
      v_liquidity_allocation := LEAST(v_remaining_liquidity, v_initial_liquidity);
      UPDATE profiles SET balance = balance + v_liquidity_allocation WHERE id = v_market.creator_id;
      UPDATE markets SET liquidity_pool = liquidity_pool - v_liquidity_allocation WHERE id = v_market.id;

      INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
      VALUES (
        v_market.creator_id, 'liquidity_returned', 'Liquidity Returned',
        format('$%s liquidity returned from market "%s"', 
          ROUND(v_liquidity_allocation, 2)::TEXT, v_market.title),
        v_market.id, NOW()
      );
    END IF;

    v_processed_markets := v_processed_markets + 1;
  END LOOP;

  -- Part 2: Process contested markets
  FOR v_contest IN
    SELECT sc.*, m.title, m.creator_id, m.b, m.creator_settlement_outcome,
           p.username as creator_username
    FROM settlement_contests sc
    JOIN markets m ON sc.market_id = m.id
    JOIN profiles p ON m.creator_id = p.id
    WHERE sc.status IN ('active', 'voting')
      AND sc.vote_deadline < NOW()
  LOOP
    SELECT COALESCE(bond_amount, 0) INTO v_settlement_bond_amount
    FROM settlement_bonds
    WHERE market_id = v_contest.market_id AND creator_id = v_contest.creator_id;

    SELECT
      COUNT(*) FILTER (WHERE vote_outcome = TRUE) as yes_votes,
      COUNT(*) FILTER (WHERE vote_outcome = FALSE) as no_votes
    INTO v_yes_votes, v_no_votes
    FROM settlement_votes
    WHERE contest_id = v_contest.id;

    -- Include implicit votes
    IF v_contest.creator_settlement_outcome THEN
      v_yes_votes := v_yes_votes + 1;
      v_no_votes := v_no_votes + 1;
    ELSE
      v_no_votes := v_no_votes + 1;
      v_yes_votes := v_yes_votes + 1;
    END IF;

    -- Handle majority vote
    IF v_yes_votes != v_no_votes THEN
      v_winning_outcome := v_yes_votes > v_no_votes;
      
      -- Calculate total payout
      SELECT COALESCE(SUM(
        CASE
          WHEN v_winning_outcome = p.side THEN p.shares * 1.00
          ELSE 0
        END
      ), 0) INTO v_total_payout
      FROM positions p
      WHERE p.market_id = v_contest.market_id;

      -- Update market
      UPDATE markets
      SET status = 'settled', 
          settlement_status = 'resolved',
          outcome = v_winning_outcome,
          winning_side = v_winning_outcome, 
          settled_at = NOW(),
          liquidity_pool = GREATEST(0, liquidity_pool - v_total_payout)
      WHERE id = v_contest.market_id;
      
      UPDATE settlement_contests 
      SET status = 'resolved', 
          resolved_at = NOW(),
          resolution_outcome = v_winning_outcome
      WHERE id = v_contest.id;

      -- Calculate bond totals
      v_total_correct_bonds := 0;
      v_total_incorrect_bonds := 0;

      IF v_contest.creator_settlement_outcome = v_winning_outcome THEN
        v_total_correct_bonds := v_total_correct_bonds + v_settlement_bond_amount;
      ELSE
        v_total_incorrect_bonds := v_total_incorrect_bonds + v_settlement_bond_amount;
      END IF;

      IF NOT v_contest.creator_settlement_outcome = v_winning_outcome THEN
        v_total_correct_bonds := v_total_correct_bonds + v_contest.contest_bond_amount;
      ELSE
        v_total_incorrect_bonds := v_total_incorrect_bonds + v_contest.contest_bond_amount;
      END IF;

      -- Add voter bonds
      SELECT 
        v_total_correct_bonds + COALESCE(SUM(CASE WHEN vote_outcome = v_winning_outcome THEN vote_bond_amount ELSE 0 END), 0),
        v_total_incorrect_bonds + COALESCE(SUM(CASE WHEN vote_outcome != v_winning_outcome THEN vote_bond_amount ELSE 0 END), 0)
      INTO v_total_correct_bonds, v_total_incorrect_bonds
      FROM settlement_votes
      WHERE contest_id = v_contest.id;

      -- Distribute creator bond
      IF v_contest.creator_settlement_outcome = v_winning_outcome AND v_total_correct_bonds > 0 THEN
        v_payout := v_settlement_bond_amount + (v_total_incorrect_bonds * (v_settlement_bond_amount / v_total_correct_bonds));
        UPDATE settlement_bonds
        SET resolved_at = NOW(), payout_amount = v_payout, status = 'resolved'
        WHERE market_id = v_contest.market_id;
        UPDATE profiles SET balance = balance + v_payout WHERE id = v_contest.creator_id;
        
        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.creator_id, 'settlement_bond_returned', 'Settlement Resolved - You Were Correct!',
          format('Market "%s" settled %s. You won $%s (P&L: +$%s)',
            v_contest.title,
            CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
            ROUND(v_payout, 2)::TEXT,
            ROUND(v_payout - v_settlement_bond_amount, 2)::TEXT
          ),
          v_contest.market_id, NOW()
        );
      ELSIF NOT v_contest.creator_settlement_outcome = v_winning_outcome THEN
        UPDATE settlement_bonds
        SET resolved_at = NOW(), payout_amount = 0, status = 'forfeited'
        WHERE market_id = v_contest.market_id;
        
        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.creator_id, 'bond_loss', 'Settlement Resolved - Incorrect',
          format('Market "%s" settled %s. Your settlement was incorrect. Bond forfeited (P&L: -$%s)',
            v_contest.title,
            CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
            ROUND(v_settlement_bond_amount, 2)::TEXT
          ),
          v_contest.market_id, NOW()
        );
      END IF;

      -- Distribute contestant bond
      IF NOT v_contest.creator_settlement_outcome = v_winning_outcome AND v_total_correct_bonds > 0 THEN
        v_payout := v_contest.contest_bond_amount + (v_total_incorrect_bonds * (v_contest.contest_bond_amount / v_total_correct_bonds));
        UPDATE settlement_contests
        SET payout_amount = v_payout
        WHERE id = v_contest.id;
        UPDATE profiles SET balance = balance + v_payout WHERE id = v_contest.contestant_id;
        
        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.contestant_id, 'contest_bond_returned', 'Contest Resolved - You Were Correct!',
          format('Market "%s" settled %s. You won $%s (P&L: +$%s)',
            v_contest.title,
            CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
            ROUND(v_payout, 2)::TEXT,
            ROUND(v_payout - v_contest.contest_bond_amount, 2)::TEXT
          ),
          v_contest.market_id, NOW()
        );
      ELSIF v_contest.creator_settlement_outcome = v_winning_outcome THEN
        UPDATE settlement_contests
        SET payout_amount = 0
        WHERE id = v_contest.id;
        
        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.contestant_id, 'bond_loss', 'Contest Resolved - Incorrect',
          format('Market "%s" settled %s. Your contest was incorrect. Bond forfeited (P&L: -$%s)',
            v_contest.title,
            CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
            ROUND(v_contest.contest_bond_amount, 2)::TEXT
          ),
          v_contest.market_id, NOW()
        );
      END IF;

      -- Process voters
      FOR v_vote IN
        SELECT sv.*, p.username, p.display_name
        FROM settlement_votes sv
        JOIN profiles p ON sv.voter_id = p.id
        WHERE sv.contest_id = v_contest.id
      LOOP
        IF v_vote.vote_outcome = v_winning_outcome AND v_total_correct_bonds > 0 THEN
          v_payout := v_vote.vote_bond_amount + (v_total_incorrect_bonds * (v_vote.vote_bond_amount / v_total_correct_bonds));
          UPDATE settlement_votes
          SET is_correct = TRUE, payout_amount = v_payout
          WHERE id = v_vote.id;
          UPDATE profiles SET balance = balance + v_payout WHERE id = v_vote.voter_id;
          
          INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
          VALUES (
            v_vote.voter_id, 'vote_bond_returned', 'Vote Resolved - You Were Correct!',
            format('Market "%s" settled %s. You won $%s (P&L: +$%s)',
              v_contest.title,
              CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
              ROUND(v_payout, 2)::TEXT,
              ROUND(v_payout - v_vote.vote_bond_amount, 2)::TEXT
            ),
            v_contest.market_id, NOW()
          );
        ELSE
          UPDATE settlement_votes
          SET is_correct = FALSE, payout_amount = 0
          WHERE id = v_vote.id;
          
          INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
          VALUES (
            v_vote.voter_id, 'bond_loss', 'Vote Resolved - Incorrect',
            format('Market "%s" settled %s. Your vote was incorrect. Bond forfeited (P&L: -$%s)',
              v_contest.title,
              CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
              ROUND(v_vote.vote_bond_amount, 2)::TEXT
            ),
            v_contest.market_id, NOW()
          );
        END IF;
      END LOOP;

      -- Process winning positions
      FOR v_position IN
        SELECT p.*, pr.username, pr.display_name
        FROM positions p
        JOIN profiles pr ON p.user_id = pr.id
        WHERE p.market_id = v_contest.market_id
          AND v_winning_outcome = p.side
          AND p.shares > 0
      LOOP
        v_payout := v_position.shares * 1.00;
        UPDATE profiles SET balance = balance + v_payout WHERE id = v_position.user_id;

        INSERT INTO transactions (
          user_id, market_id, type, amount, shares, 
          price_per_share, cost_basis, realized_pnl, side, 
          description, created_at
        )
        VALUES (
          v_position.user_id, v_contest.market_id, 'sell', v_payout, v_position.shares,
          1.00, v_position.amount_invested, v_payout - v_position.amount_invested,
          CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END,
          'Private market settlement - Winner', NOW()
        );

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_position.user_id, 'settlement', 'Market Settled',
          format('Market "%s" settled %s. You won $%s (P&L: %s$%s)',
            v_contest.title,
            CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
            ROUND(v_payout, 2)::TEXT,
            CASE WHEN v_payout - v_position.amount_invested >= 0 THEN '+' ELSE '' END,
            ROUND(ABS(v_payout - v_position.amount_invested), 2)::TEXT
          ),
          v_contest.market_id, NOW()
        );
      END LOOP;

      -- Process losing positions
      FOR v_position IN
        SELECT p.*, pr.username, pr.display_name
        FROM positions p
        JOIN profiles pr ON p.user_id = pr.id
        WHERE p.market_id = v_contest.market_id
          AND v_winning_outcome != p.side
          AND p.shares > 0
      LOOP
        INSERT INTO transactions (
          user_id, market_id, type, amount, shares, 
          price_per_share, cost_basis, realized_pnl, side, 
          description, created_at
        )
        VALUES (
          v_position.user_id, v_contest.market_id, 'sell', 0, v_position.shares,
          0, v_position.amount_invested, -v_position.amount_invested,
          CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END,
          'Private market settlement - Loser', NOW()
        );

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_position.user_id, 'settlement', 'Market Settled',
          format('Market "%s" settled %s. You lost $%s',
            v_contest.title,
            CASE WHEN v_winning_outcome THEN 'YES' ELSE 'NO' END,
            ROUND(v_position.amount_invested, 2)::TEXT
          ),
          v_contest.market_id, NOW()
        );
      END LOOP;

      -- Return liquidity to creator (always, regardless of vote outcome)
      SELECT COALESCE(liquidity_pool, 0) INTO v_remaining_liquidity FROM markets WHERE id = v_contest.market_id;
      v_initial_liquidity := (COALESCE(v_contest.b, 0) + 1) * ln(2);

      IF v_remaining_liquidity > 0 AND v_initial_liquidity > 0 THEN
        v_liquidity_allocation := LEAST(v_remaining_liquidity, v_initial_liquidity);
        UPDATE profiles SET balance = balance + v_liquidity_allocation WHERE id = v_contest.creator_id;
        UPDATE markets SET liquidity_pool = liquidity_pool - v_liquidity_allocation WHERE id = v_contest.market_id;

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.creator_id, 'liquidity_returned', 'Liquidity Returned',
          format('$%s liquidity returned from market "%s"', 
            ROUND(v_liquidity_allocation, 2)::TEXT, v_contest.title),
          v_contest.market_id, NOW()
        );
      END IF;

    -- Handle tie vote (market cancelled)
    ELSIF v_yes_votes = v_no_votes THEN
      UPDATE markets 
      SET status = 'cancelled', 
          settlement_status = 'resolved',
          outcome = NULL,
          settled_at = NOW() 
      WHERE id = v_contest.market_id;
      
      UPDATE settlement_contests SET status = 'resolved', resolved_at = NOW() WHERE id = v_contest.id;

      -- Refund all positions
      FOR v_position IN
        SELECT p.*, pr.username, pr.display_name
        FROM positions p
        JOIN profiles pr ON p.user_id = pr.id
        WHERE p.market_id = v_contest.market_id AND p.shares > 0
      LOOP
        UPDATE profiles SET balance = balance + v_position.amount_invested WHERE id = v_position.user_id;

        INSERT INTO transactions (
          user_id, market_id, type, amount, shares, price_per_share,
          cost_basis, realized_pnl, side, description, created_at
        )
        VALUES (
          v_position.user_id, v_contest.market_id, 'sell', v_position.amount_invested,
          v_position.shares, v_position.amount_invested / NULLIF(v_position.shares, 0),
          v_position.amount_invested, 0, 
          CASE WHEN v_position.side THEN 'YES' ELSE 'NO' END,
          'Private market cancelled - Tie vote refund', NOW()
        );

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_position.user_id, 'settlement', 'Market Cancelled - Tie Vote',
          format('Market "%s" was cancelled due to a tie vote. Your position has been refunded at cost basis: $%s (P&L: $0.00)',
            v_contest.title, ROUND(v_position.amount_invested, 2)::TEXT),
          v_contest.market_id, NOW()
        );
      END LOOP;

      -- Return all bonds
      IF v_settlement_bond_amount > 0 THEN
        UPDATE settlement_bonds
        SET resolved_at = NOW(), payout_amount = bond_amount, status = 'resolved'
        WHERE market_id = v_contest.market_id;

        UPDATE profiles SET balance = balance + v_settlement_bond_amount WHERE id = v_contest.creator_id;

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.creator_id, 'settlement_bond_returned', 'Settlement Bond Returned - Tie Vote',
          format('Market "%s" was cancelled due to a tie vote. Your settlement bond has been returned (P&L: $0.00)', 
            v_contest.title),
          v_contest.market_id, NOW()
        );
      END IF;

      UPDATE settlement_contests SET payout_amount = contest_bond_amount WHERE id = v_contest.id;
      UPDATE profiles SET balance = balance + v_contest.contest_bond_amount WHERE id = v_contest.contestant_id;

      INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
      VALUES (
        v_contest.contestant_id, 'contest_bond_returned', 'Contest Bond Returned - Tie Vote',
        format('Market "%s" was cancelled due to a tie vote. Your contest bond has been returned (P&L: $0.00)', 
          v_contest.title),
        v_contest.market_id, NOW()
      );

      FOR v_bond IN
        SELECT sv.*, p.username, p.display_name
        FROM settlement_votes sv
        JOIN profiles p ON sv.voter_id = p.id
        WHERE sv.contest_id = v_contest.id
      LOOP
        UPDATE settlement_votes SET payout_amount = vote_bond_amount WHERE id = v_bond.id;
        UPDATE profiles SET balance = balance + v_bond.vote_bond_amount WHERE id = v_bond.voter_id;

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_bond.voter_id, 'vote_bond_returned', 'Vote Bond Returned - Tie Vote',
          format('Market "%s" was cancelled due to a tie vote. Your vote bond has been returned (P&L: $0.00)', 
            v_contest.title),
          v_contest.market_id, NOW()
        );
      END LOOP;

      -- Return liquidity
      SELECT COALESCE(liquidity_pool, 0) INTO v_remaining_liquidity FROM markets WHERE id = v_contest.market_id;
      v_initial_liquidity := (COALESCE(v_contest.b, 0) + 1) * ln(2);

      IF v_remaining_liquidity > 0 AND v_initial_liquidity > 0 THEN
        v_liquidity_allocation := LEAST(v_remaining_liquidity, v_initial_liquidity);
        UPDATE profiles SET balance = balance + v_liquidity_allocation WHERE id = v_contest.creator_id;
        UPDATE markets SET liquidity_pool = liquidity_pool - v_liquidity_allocation WHERE id = v_contest.market_id;

        INSERT INTO notifications (user_id, type, title, message, market_id, created_at)
        VALUES (
          v_contest.creator_id, 'liquidity_returned', 'Liquidity Returned - Tie Vote',
          format('$%s liquidity returned from cancelled market "%s"', 
            ROUND(v_liquidity_allocation, 2)::TEXT, v_contest.title),
          v_contest.market_id, NOW()
        );
      END IF;
    END IF;

    v_processed_contests := v_processed_contests + 1;
  END LOOP;

  RETURN json_build_object(
    'auto_settled', v_processed_markets,
    'contests_resolved', v_processed_contests,
    'total_processed', v_processed_markets + v_processed_contests
  );
END;
$$;

-- Cancel market function
CREATE OR REPLACE FUNCTION cancel_market(
  market_id_param UUID,
  admin_user_id UUID
) RETURNS JSON AS $$
DECLARE
  market_record RECORD;
  position_record RECORD;
  user_net_investment NUMERIC;
  total_refunds NUMERIC := 0;
  users_refunded INTEGER := 0;
  remaining_liquidity NUMERIC := 0;
  initial_liquidity NUMERIC := 0;
  liquidity_return_amount NUMERIC := 0;
  result JSON;
BEGIN
  SELECT * INTO market_record FROM markets WHERE id = market_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  IF market_record.outcome IS NOT NULL OR market_record.status = 'settled' OR market_record.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Market already settled or cancelled');
  END IF;

  -- Process refunds
  FOR position_record IN 
    SELECT p.*, pr.username, pr.display_name
    FROM positions p
    JOIN profiles pr ON p.user_id = pr.id
    WHERE p.market_id = market_id_param 
    AND p.shares > 0.0001
  LOOP
    user_net_investment := position_record.amount_invested;
    
    IF user_net_investment > 0.01 THEN
      UPDATE profiles 
      SET balance = balance + user_net_investment
      WHERE id = position_record.user_id;
      
      INSERT INTO transactions (
        user_id, market_id, type, amount, shares, 
        price_per_share, cost_basis, realized_pnl, side, description
      )
      VALUES (
        position_record.user_id,
        market_id_param,
        'sell',
        user_net_investment,
        position_record.shares,
        position_record.avg_price,
        user_net_investment,
        0,
        position_record.side,
        'Market cancelled - refund at cost basis'
      );
      
      INSERT INTO notifications (user_id, market_id, type, title, message)
      VALUES (
        position_record.user_id,
        market_id_param,
        'market_cancelled',
        'Market Cancelled - Refund Issued',
        'The market "' || COALESCE(market_record.title, 'Unknown Market') || '" has been cancelled. You have been refunded $' || ROUND(user_net_investment, 2)::TEXT || ' (your investment, P&L: $0.00).'
      );
      
      total_refunds := total_refunds + user_net_investment;
      users_refunded := users_refunded + 1;
    END IF;
    
    DELETE FROM positions 
    WHERE user_id = position_record.user_id 
    AND market_id = market_id_param;
  END LOOP;

  UPDATE markets 
  SET liquidity_pool = GREATEST(0, liquidity_pool - total_refunds)
  WHERE id = market_id_param;
  
  SELECT liquidity_pool INTO remaining_liquidity
  FROM markets
  WHERE id = market_id_param;
  
  -- Return liquidity to creator
  IF market_record.b IS NOT NULL AND market_record.b > 0 THEN
    initial_liquidity := (market_record.b + 1) * LN(2);
    
    IF remaining_liquidity > 0 THEN
      liquidity_return_amount := LEAST(remaining_liquidity, initial_liquidity);
      
      UPDATE profiles 
      SET balance = balance + liquidity_return_amount
      WHERE id = market_record.creator_id;
      
      INSERT INTO transactions (user_id, market_id, type, amount, description)
      VALUES (
        market_record.creator_id,
        market_id_param,
        'liquidity_return',
        liquidity_return_amount,
        'Initial liquidity return from cancelled market'
      );
      
      UPDATE markets 
      SET liquidity_pool = liquidity_pool - liquidity_return_amount
      WHERE id = market_id_param;
    END IF;
  END IF;

  UPDATE markets 
  SET 
    status = 'cancelled',
    outcome = NULL,
    winning_side = NULL,
    settled_by = admin_user_id,
    settled_at = NOW()
  WHERE id = market_id_param;

  INSERT INTO notifications (user_id, market_id, type, title, message)
  VALUES (
    market_record.creator_id,
    market_id_param,
    'market_cancelled',
    'Market Cancelled',
    'Your market "' || COALESCE(market_record.title, 'Unknown Market') || '" has been cancelled. ' ||
    'All participants have been refunded their investments (total: $' || ROUND(total_refunds, 2)::TEXT || '). ' ||
    'Initial liquidity returned: $' || ROUND(COALESCE(liquidity_return_amount, 0), 2)::TEXT || '.'
  );

  result := json_build_object(
    'success', true,
    'total_refunds', total_refunds,
    'users_refunded', users_refunded,
    'liquidity_returned', liquidity_return_amount
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PART 5: PRICE HISTORY TRIGGER
-- ========================================

CREATE OR REPLACE FUNCTION record_price_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  last_snapshot_time TIMESTAMP;
  market_data RECORD;
  yes_prob NUMERIC;
  no_prob NUMERIC;
BEGIN
  IF NEW.type NOT IN ('bet', 'sell') THEN
    RETURN NEW;
  END IF;

  SELECT MAX(timestamp) INTO last_snapshot_time
  FROM market_price_history
  WHERE market_id = NEW.market_id;
  
  IF last_snapshot_time IS NULL OR (NOW() - last_snapshot_time) > INTERVAL '1 minute' THEN
    SELECT qy, qn, b, total_volume INTO market_data
    FROM markets
    WHERE id = NEW.market_id;
    
    IF market_data IS NOT NULL THEN
      yes_prob := EXP(market_data.qy / market_data.b) / 
                  (EXP(market_data.qy / market_data.b) + EXP(market_data.qn / market_data.b));
      no_prob := EXP(market_data.qn / market_data.b) / 
                 (EXP(market_data.qy / market_data.b) + EXP(market_data.qn / market_data.b));
      
      INSERT INTO market_price_history (
        market_id,
        yes_probability,
        no_probability,
        qy,
        qn,
        total_volume
      ) VALUES (
        NEW.market_id,
        yes_prob,
        no_prob,
        market_data.qy,
        market_data.qn,
        market_data.total_volume
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_price_snapshot ON transactions;

CREATE TRIGGER trigger_record_price_snapshot
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION record_price_snapshot();

-- ========================================
-- PART 6: ANALYZE TABLES
-- ========================================

ANALYZE markets;
ANALYZE positions;
ANALYZE transactions;
ANALYZE settlement_bonds;
ANALYZE settlement_contests;
ANALYZE settlement_votes;
ANALYZE notifications;
ANALYZE profiles;
ANALYZE market_price_history;
ANALYZE fees;
ANALYZE groups;
ANALYZE user_groups;
ANALYZE market_participants;
ANALYZE uma_proposals;
ANALYZE uma_disputes;
ANALYZE blockchain_transactions;

-- ========================================
-- END OF COMPLETE DATABASE BACKUP
-- ========================================
-- This script contains 100% of your current functionality
-- Safe to run if you need to restore to current state
-- ========================================
