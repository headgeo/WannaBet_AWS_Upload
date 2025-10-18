-- Add liquidity columns to markets table for AMM functionality
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS yes_liquidity NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS no_liquidity NUMERIC DEFAULT 100;

-- Update existing markets to have initial liquidity based on current shares
-- This ensures existing markets work with the new AMM system
UPDATE markets 
SET 
  yes_liquidity = GREATEST(100, yes_shares + 100),
  no_liquidity = GREATEST(100, no_shares + 100)
WHERE yes_liquidity IS NULL OR no_liquidity IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_markets_liquidity ON markets(yes_liquidity, no_liquidity);
