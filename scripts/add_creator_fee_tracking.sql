-- Add creator fee tracking to the fees table
-- This script adds a fee_type column to distinguish between creator and site fees

-- Add fee_type column to fees table
ALTER TABLE fees ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'site';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_fees_type_market ON fees(fee_type, market_id);

-- Add creator_fees_earned column to markets table to track cumulative fees
ALTER TABLE markets ADD COLUMN IF NOT EXISTS creator_fees_earned NUMERIC DEFAULT 0;

-- Create function to split fees between creator and site
CREATE OR REPLACE FUNCTION split_trading_fees(
  p_user_id UUID,
  p_market_id UUID,
  p_creator_id UUID,
  p_transaction_type TEXT,
  p_original_amount NUMERIC,
  p_total_fee_amount NUMERIC
) RETURNS VOID AS $$
DECLARE
  creator_fee_amount NUMERIC;
  site_fee_amount NUMERIC;
BEGIN
  -- Split fee 50/50 between creator and site
  creator_fee_amount := p_total_fee_amount * 0.5;
  site_fee_amount := p_total_fee_amount * 0.5;
  
  -- Insert creator fee record (attributed to the market creator)
  INSERT INTO fees (
    user_id, 
    market_id, 
    transaction_type, 
    original_amount, 
    fee_amount, 
    fee_percentage, 
    net_amount,
    fee_type
  ) VALUES (
    p_creator_id, -- Creator fee goes to the market creator
    p_market_id,
    p_transaction_type,
    p_original_amount,
    creator_fee_amount,
    0.0025, -- 0.25% (half of 0.5%)
    creator_fee_amount,
    'creator'
  );
  
  -- Insert site fee record (not attributed to any specific user)
  INSERT INTO fees (
    user_id, 
    market_id, 
    transaction_type, 
    original_amount, 
    fee_amount, 
    fee_percentage, 
    net_amount,
    fee_type
  ) VALUES (
    NULL, -- Site fees are not attributed to any user
    p_market_id,
    p_transaction_type,
    p_original_amount,
    site_fee_amount,
    0.0025, -- 0.25% (half of 0.5%)
    site_fee_amount,
    'site'
  );
  
  -- Update market's cumulative creator fees (but don't add to creator balance yet)
  UPDATE markets 
  SET creator_fees_earned = COALESCE(creator_fees_earned, 0) + creator_fee_amount
  WHERE id = p_market_id;
  
END;
$$ LANGUAGE plpgsql;

-- Update existing fee records to be marked as 'site' fees
UPDATE fees SET fee_type = 'site' WHERE fee_type IS NULL;
