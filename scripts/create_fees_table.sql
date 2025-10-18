-- Create fees table to track all transaction fees
CREATE TABLE IF NOT EXISTS public.fees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
    original_amount NUMERIC NOT NULL CHECK (original_amount > 0),
    fee_amount NUMERIC NOT NULL CHECK (fee_amount > 0),
    fee_percentage NUMERIC NOT NULL DEFAULT 0.005 CHECK (fee_percentage > 0),
    net_amount NUMERIC NOT NULL CHECK (net_amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fees_user_id ON public.fees(user_id);
CREATE INDEX IF NOT EXISTS idx_fees_market_id ON public.fees(market_id);
CREATE INDEX IF NOT EXISTS idx_fees_created_at ON public.fees(created_at);
CREATE INDEX IF NOT EXISTS idx_fees_transaction_type ON public.fees(transaction_type);

-- Enable RLS
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own fees" ON public.fees
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fees" ON public.fees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT ON public.fees TO authenticated;
-- Removed the sequence grant since we use UUID, not SERIAL

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fees_updated_at BEFORE UPDATE ON public.fees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
