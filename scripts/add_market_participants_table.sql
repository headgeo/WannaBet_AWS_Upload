-- Create market_participants table to support multiple counterparties in private bets
CREATE TABLE IF NOT EXISTS market_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'participant')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(market_id, user_id)
);

-- Add RLS policies
ALTER TABLE market_participants ENABLE ROW LEVEL SECURITY;

-- Users can see participants for markets they're involved in
CREATE POLICY "Users can view market participants for their markets" ON market_participants
  FOR SELECT USING (
    user_id = auth.uid() OR 
    market_id IN (
      SELECT id FROM markets WHERE creator_id = auth.uid() OR invited_user_id = auth.uid()
    )
  );

-- Users can insert participants when creating markets
CREATE POLICY "Users can add participants to their markets" ON market_participants
  FOR INSERT WITH CHECK (
    market_id IN (SELECT id FROM markets WHERE creator_id = auth.uid())
  );

-- Users can update their own participation status
CREATE POLICY "Users can update their own participation" ON market_participants
  FOR UPDATE USING (user_id = auth.uid());
