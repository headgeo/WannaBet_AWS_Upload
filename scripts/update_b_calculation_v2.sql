-- Update existing markets to use the new b calculation formula
-- Formula: b = (liquidity_pool / ln(2)) - 1
-- This replaces the hardcoded b = 100 with a dynamic calculation based on liquidity

-- Update all markets to use the new b calculation formula
UPDATE markets 
SET b = (liquidity_pool / LN(2)) - 1
WHERE liquidity_pool IS NOT NULL AND liquidity_pool > 0;

-- For markets with no liquidity_pool set, use default of 100 and calculate b
UPDATE markets 
SET 
  liquidity_pool = 100,
  b = (100 / LN(2)) - 1
WHERE liquidity_pool IS NULL OR liquidity_pool = 0;

-- Update the column comment to reflect the new calculation
COMMENT ON COLUMN markets.b IS 'LMSR liquidity parameter calculated as (liquidity_pool / ln(2)) - 1';

-- Verify the update by showing some sample calculations
-- This is just for verification and won't affect the data
SELECT 
  id,
  title,
  liquidity_pool,
  b,
  ROUND((liquidity_pool / LN(2)) - 1, 6) as calculated_b,
  CASE 
    WHEN ABS(b - ((liquidity_pool / LN(2)) - 1)) < 0.000001 THEN 'CORRECT'
    ELSE 'MISMATCH'
  END as verification
FROM markets 
LIMIT 10;
