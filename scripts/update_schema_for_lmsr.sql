-- Update database schema to support LMSR pricing
-- 1. Add liquidity_pool column to markets table (single pool instead of yes/no liquidity)
-- 2. Rename yes_liquidity and no_liquidity to qy and qn (share quantities)
-- 3. Add b parameter for market depth (set to 100)

-- First, add the new columns
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS liquidity_pool DECIMAL DEFAULT 100,
ADD COLUMN IF NOT EXISTS qy DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS qn DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS b DECIMAL DEFAULT 100;

-- Migrate existing data from yes_liquidity/no_liquidity to qy/qn
-- For existing markets, convert liquidity to share quantities
UPDATE markets 
SET 
  qy = COALESCE(yes_shares, 0),
  qn = COALESCE(no_shares, 0),
  liquidity_pool = 100,
  b = 100
WHERE qy IS NULL OR qn IS NULL;

-- Set default values for any NULL entries
UPDATE markets 
SET 
  qy = COALESCE(qy, 0),
  qn = COALESCE(qn, 0),
  liquidity_pool = COALESCE(liquidity_pool, 100),
  b = COALESCE(b, 100);

-- Make the new columns NOT NULL after setting defaults
ALTER TABLE markets 
ALTER COLUMN qy SET NOT NULL,
ALTER COLUMN qn SET NOT NULL,
ALTER COLUMN liquidity_pool SET NOT NULL,
ALTER COLUMN b SET NOT NULL;

-- Add comments to explain the new LMSR columns
COMMENT ON COLUMN markets.qy IS 'Quantity of YES shares in LMSR model';
COMMENT ON COLUMN markets.qn IS 'Quantity of NO shares in LMSR model';
COMMENT ON COLUMN markets.liquidity_pool IS 'Single liquidity pool for the market (starts at $100)';
COMMENT ON COLUMN markets.b IS 'LMSR liquidity parameter (market depth, set to 100)';
