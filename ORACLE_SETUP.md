# Oracle Settlement System - Comprehensive Guide

## Overview
The oracle settlement system is a bond-based dispute resolution mechanism for private prediction markets. It allows market creators to settle their markets while providing a democratic challenge system where participants can contest incorrect settlements through a voting process.

## Core Principles

### Bond-Based Incentives
- **Settlement Bond**: Creator posts their accumulated fees as collateral
- **Contest Bond**: $50 to challenge a settlement
- **Vote Bond**: $25 to participate in voting
- **Skin in the Game**: All participants risk capital to ensure honest behavior

### Democratic Resolution
- Participants vote on the correct outcome
- Majority vote determines the final settlement
- Correct voters share the bonds of incorrect parties
- Ties result in market cancellation and full refunds

## Complete System Flow

### Phase 1: Settlement Initiation (Creator)

**Trigger**: Creator clicks "Initiate Oracle Settlement" on their private market

**Requirements**:
- Market must be private (`is_private = true`)
- Market must be active (`status = 'active'`)
- Only the creator can initiate settlement
- Creator must have accumulated fees to post as bond

**Process**:
1. System calculates bond amount (creator's accumulated fees from the market)
2. Creator chooses outcome (YES/NO)
3. Creator posts bond (deducted from balance)
4. Market status changes to `'suspended'`
5. Settlement status set to `'pending'`
6. 1-hour contest period begins (`contest_deadline` set)
7. All market participants are notified

**Database Changes**:
\`\`\`sql
-- Insert into settlement_bonds table
INSERT INTO settlement_bonds (
  market_id,
  creator_id,
  bond_amount,
  outcome_chosen,
  status
) VALUES (
  market_id,
  creator_id,
  creator_fees_earned,
  chosen_outcome,
  'active'
);

-- Update markets table
UPDATE markets SET
  status = 'suspended',
  settlement_status = 'pending',
  settlement_initiated_at = NOW(),
  contest_deadline = NOW() + INTERVAL '1 hour',
  creator_settlement_outcome = chosen_outcome
WHERE id = market_id;
\`\`\`

**Notifications Sent**:
- All participants: "Market Settlement Initiated - You can contest within 1 hour"

---

### Phase 2A: No Contest (Uncontested Settlement)

**Condition**: No one contests within 1 hour

**Auto-Settlement Process** (triggered by cron job):
1. System detects expired contest deadline
2. Market settles with creator's chosen outcome
3. Creator gets bond back (full amount)
4. Positions are settled normally:
   - Winners get $1 per share
   - Losers get $0
5. Creator receives:
   - Settlement bond returned
   - Accumulated fees
   - Initial liquidity returned

**Database Changes**:
\`\`\`sql
-- Update settlement bond
UPDATE settlement_bonds SET
  status = 'returned',
  resolved_at = NOW(),
  payout_amount = bond_amount  -- Full bond returned
WHERE market_id = market_id;

-- Update market
UPDATE markets SET
  status = 'settled',
  outcome = creator_settlement_outcome,
  settlement_status = 'resolved',
  resolved_at = NOW()
WHERE id = market_id;

-- Pay winners ($1 per share)
UPDATE profiles SET
  balance = balance + winning_shares
WHERE user_id IN (SELECT user_id FROM positions WHERE side = winning_side);

-- Return creator fees and liquidity
UPDATE profiles SET
  balance = balance + creator_fees + initial_liquidity
WHERE id = creator_id;
\`\`\`

**Notifications Sent**:
- Creator: "Market Settled - Bond Returned + Fees ($X.XX) + Liquidity ($Y.YY)"
- Winners: "Market Settled - You Won! Received $X.XX (Z shares × $1.00)"
- Losers: "Market Settled - Your prediction was incorrect"

---

### Phase 2B: Contested Settlement

**Trigger**: Any participant clicks "Contest Settlement" within 1-hour window

**Requirements**:
- Must be a market participant (has positions or trades)
- Must post $50 contest bond
- Must be within contest deadline

**Process**:
1. Contestant posts $50 bond (deducted from balance)
2. System creates settlement contest
3. **Contestant's vote is automatically set to OPPOSITE of creator's outcome**
4. System selects verifiers:
   - If ≤5 participants: all are notified to vote
   - If >5 participants: random ≥30% subset notified to vote
5. 1-hour voting period begins (`vote_deadline` set)
6. Market status changes to `'contested'`

**Database Changes**:
\`\`\`sql
-- Insert into settlement_contests table
INSERT INTO settlement_contests (
  market_id,
  contestant_id,
  contest_bond_amount,
  created_at,
  vote_deadline
) VALUES (
  market_id,
  contestant_id,
  50.00,
  NOW(),
  NOW() + INTERVAL '1 hour'
);

-- Update market
UPDATE markets SET
  status = 'contested',
  settlement_status = 'contested',
  contest_deadline = NOW() + INTERVAL '1 hour'
WHERE id = market_id;

-- Deduct contest bond from contestant
UPDATE profiles SET
  balance = balance - 50.00
WHERE id = contestant_id;
\`\`\`

**Verifier Selection Logic**:
\`\`\`sql
-- Get all participants
SELECT DISTINCT user_id FROM positions WHERE market_id = market_id
UNION
SELECT DISTINCT user_id FROM transactions WHERE market_id = market_id;

-- If ≤5 participants: notify all
-- If >5 participants: notify random ≥30% (ORDER BY RANDOM())
\`\`\`

**Notifications Sent**:
- Creator: "Your settlement has been contested! Voting period started."
- Contestant: "You contested the settlement. Voting period started."
- Selected verifiers: "You've been selected to vote on a contested settlement. Post $25 bond to vote."

---

### Phase 3: Voting Period

**Duration**: 1 hour from contest initiation

**Voting Process**:
1. Notified verifiers can vote YES or NO
2. Each vote requires $25 bond
3. Votes are blind (not visible to others)
4. Voting closes after 1 hour

**Database Changes**:
\`\`\`sql
-- Insert vote
INSERT INTO settlement_votes (
  contest_id,
  voter_id,
  vote_outcome,
  vote_bond_amount,
  created_at
) VALUES (
  contest_id,
  voter_id,
  vote_outcome,
  25.00,
  NOW()
);

-- Deduct vote bond
UPDATE profiles SET
  balance = balance - 25.00
WHERE id = voter_id;
\`\`\`

**Notifications Sent**:
- Voter: "Your vote has been recorded. Results will be available after voting closes."

---

### Phase 4A: Resolution - Majority Vote (Winner Determined)

**Condition**: One side has more votes than the other

**Vote Counting Logic**:
\`\`\`sql
-- Count votes (creator + contestant + voters)
v_true_votes = 
  COUNT(votes WHERE vote_outcome = true) +
  (creator_outcome = true ? 1 : 0) +
  (NOT creator_outcome ? 1 : 0);  -- Contestant votes opposite

v_false_votes = 
  COUNT(votes WHERE vote_outcome = false) +
  (creator_outcome = false ? 1 : 0) +
  (NOT creator_outcome = false ? 1 : 0);  -- Contestant votes opposite

-- Determine winner
IF v_true_votes > v_false_votes THEN
  winning_outcome = true
ELSIF v_false_votes > v_true_votes THEN
  winning_outcome = false
END IF;
\`\`\`

**Settlement Process**:
1. Market settles with majority outcome
2. Positions are settled:
   - Winners get $1 per share
   - Losers get $0
3. **Bond Distribution**:
   - **Correct voters**: Share ALL incorrect bonds proportionally
   - **Incorrect voters**: Lose their bonds
   - **Creator (if correct)**: Gets bond back + share of incorrect bonds
   - **Creator (if incorrect)**: Loses bond
   - **Contestant (if correct)**: Gets bond back + share of incorrect bonds
   - **Contestant (if incorrect)**: Loses bond

**Bond Payout Calculation**:
\`\`\`sql
-- Total pool of incorrect bonds
total_incorrect_bonds = 
  SUM(bonds WHERE is_correct = false);

-- Each correct voter's share
FOR each_correct_voter:
  voter_share = 25.00 / total_correct_bonds;
  payout = 25.00 + (total_incorrect_bonds * voter_share);
  
-- Creator's share (if correct)
IF creator_correct:
  creator_share = bond_amount / total_correct_bonds;
  payout = bond_amount + (total_incorrect_bonds * creator_share);

-- Contestant's share (if correct)
IF contestant_correct:
  contestant_share = 50.00 / total_correct_bonds;
  payout = 50.00 + (total_incorrect_bonds * contestant_share);
\`\`\`

**Database Changes**:
\`\`\`sql
-- Update market
UPDATE markets SET
  status = 'settled',
  outcome = winning_outcome,
  settlement_status = 'resolved',
  resolved_at = NOW()
WHERE id = market_id;

-- Update settlement bond (creator)
UPDATE settlement_bonds SET
  status = (creator_correct ? 'returned' : 'forfeited'),
  resolved_at = NOW(),
  payout_amount = (creator_correct ? bond_amount + profit : 0)
WHERE market_id = market_id;

-- Update contest bond
UPDATE settlement_contests SET
  status = (contestant_correct ? 'resolved' : 'resolved'),
  resolved_at = NOW(),
  resolution_outcome = winning_outcome,
  payout_amount = (contestant_correct ? 50.00 + profit : 0)
WHERE market_id = market_id;

-- Update vote bonds
UPDATE settlement_votes SET
  is_correct = (vote_outcome = winning_outcome),
  payout_amount = (is_correct ? 25.00 + profit : 0)
WHERE contest_id = contest_id;

-- Pay out correct voters
UPDATE profiles SET
  balance = balance + payout_amount
WHERE id IN (SELECT voter_id FROM settlement_votes WHERE is_correct = true);

-- Pay winners ($1 per share)
UPDATE profiles SET
  balance = balance + winning_shares
WHERE user_id IN (SELECT user_id FROM positions WHERE side = winning_side);

-- Return creator fees and liquidity (if creator was correct)
IF creator_correct:
  UPDATE profiles SET
    balance = balance + creator_fees + initial_liquidity
  WHERE id = creator_id;
\`\`\`

**Notifications Sent**:
- **Correct voters**: "Settlement Resolved - You Won! Received $X.XX (bond + profit)"
- **Incorrect voters**: "Settlement Resolved - Your vote was incorrect. Bond forfeited."
- **Creator (if correct)**: "Settlement Resolved - You Were Correct! Received $X.XX (bond + profit + fees + liquidity)"
- **Creator (if incorrect)**: "Settlement Resolved - Your settlement was incorrect. Bond forfeited."
- **Contestant (if correct)**: "Settlement Resolved - You Were Correct! Received $X.XX (bond + profit)"
- **Contestant (if incorrect)**: "Settlement Resolved - Your contest was incorrect. Bond forfeited."
- **All position holders**: "Market Settled - [Win/Loss message with payout]"

---

### Phase 4B: Resolution - Tie Vote (Market Cancelled)

**Condition**: Equal votes on both sides (e.g., creator vs contestant with no other voters)

**Cancellation Process**:
1. Market is cancelled (no winner)
2. **All positions refunded at cost basis** (0 P&L close)
3. **All bonds returned in full**:
   - Creator gets settlement bond back
   - Contestant gets contest bond back
   - All voters get vote bonds back
4. No winners or losers

**Position Refund Calculation**:
\`\`\`sql
-- For each position holder
FOR each_position:
  -- Calculate average cost basis
  total_cost = SUM(transaction_amount WHERE type IN ('buy', 'sell'));
  shares_held = current_shares;
  
  -- Refund at cost basis (0 P&L)
  refund_amount = total_cost;
  
  -- Update balance
  UPDATE profiles SET
    balance = balance + refund_amount
  WHERE id = user_id;
  
  -- Record transaction
  INSERT INTO transactions (
    user_id,
    market_id,
    type,
    amount,
    realized_pnl
  ) VALUES (
    user_id,
    market_id,
    'market_cancelled',
    refund_amount,
    0.00  -- Zero P&L
  );
\`\`\`

**Database Changes**:
\`\`\`sql
-- Update market
UPDATE markets SET
  status = 'cancelled',
  settlement_status = 'resolved',
  resolved_at = NOW(),
  outcome = NULL  -- No winner
WHERE id = market_id;

-- Return all bonds (full amount)
UPDATE settlement_bonds SET
  status = 'returned',
  resolved_at = NOW(),
  payout_amount = bond_amount
WHERE market_id = market_id;

UPDATE settlement_contests SET
  status = 'tied',
  resolved_at = NOW(),
  payout_amount = contest_bond_amount
WHERE market_id = market_id;

UPDATE settlement_votes SET
  is_correct = NULL,  -- No correct/incorrect in tie
  payout_amount = vote_bond_amount
WHERE contest_id = contest_id;

-- Refund all positions at cost basis
FOR each_position:
  UPDATE profiles SET
    balance = balance + cost_basis
  WHERE id = user_id;

-- Return all bonds
UPDATE profiles SET
  balance = balance + bond_amount
WHERE id IN (creator_id, contestant_id, voter_ids);
\`\`\`

**Notifications Sent**:
- **Creator**: "Market Cancelled - Tie Vote. Bond returned ($X.XX). All positions refunded."
- **Contestant**: "Market Cancelled - Tie Vote. Bond returned ($50.00). All positions refunded."
- **Voters**: "Market Cancelled - Tie Vote. Bond returned ($25.00). All positions refunded."
- **All position holders**: "Market Cancelled - Tie Vote. Your position refunded at cost basis: $X.XX (0 P&L)"

---

## Database Schema

### settlement_bonds
Tracks creator settlement bonds.

\`\`\`sql
CREATE TABLE settlement_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID UNIQUE NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bond_amount NUMERIC NOT NULL CHECK (bond_amount > 0),
  outcome_chosen BOOLEAN NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'forfeited')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  payout_amount NUMERIC DEFAULT 0  -- Actual payout received (for P&L calculation)
);
\`\`\`

**Status Values**:
- `active`: Bond is posted, awaiting resolution
- `returned`: Bond returned (creator was correct or tie)
- `forfeited`: Bond lost (creator was incorrect)

### settlement_contests
Tracks contest initiation and voting.

\`\`\`sql
CREATE TABLE settlement_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID UNIQUE NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  contestant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contest_bond_amount NUMERIC DEFAULT 50.00 CHECK (contest_bond_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  vote_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_outcome BOOLEAN,  -- Final outcome after voting
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'tied')),
  payout_amount NUMERIC DEFAULT 0  -- Actual payout received (for P&L calculation)
);
\`\`\`

**Status Values**:
- `active`: Contest is ongoing, voting in progress
- `resolved`: Contest resolved with winner
- `tied`: Contest resulted in tie (market cancelled)

**Important**: The contestant's vote is NOT stored in `resolution_outcome`. The contestant automatically votes OPPOSITE of the creator's outcome. The `resolution_outcome` is only set after voting completes.

### settlement_votes
Tracks individual verifier votes.

\`\`\`sql
CREATE TABLE settlement_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES settlement_contests(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_outcome BOOLEAN NOT NULL,
  vote_bond_amount NUMERIC DEFAULT 25.00 CHECK (vote_bond_amount > 0),
  is_correct BOOLEAN,  -- Set after resolution
  payout_amount NUMERIC DEFAULT 0,  -- Actual payout received (for P&L calculation)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contest_id, voter_id)
);
\`\`\`

### settlement_notifications
Tracks who was notified to vote (for verifier selection).

\`\`\`sql
CREATE TABLE settlement_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES settlement_contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contest_id, user_id)
);
\`\`\`

### markets (settlement columns)
Additional columns added to markets table for settlement tracking.

\`\`\`sql
ALTER TABLE markets ADD COLUMN settlement_status TEXT;
ALTER TABLE markets ADD COLUMN settlement_initiated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE markets ADD COLUMN contest_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE markets ADD COLUMN creator_settlement_outcome BOOLEAN;
\`\`\`

---

## SQL Functions

### check_pending_settlements()
Main function called by cron job to process all pending settlements.

**Triggers**:
- Vercel cron job every 5 minutes
- Manual trigger from admin page

**Process**:
1. Find all uncontested markets past contest deadline
2. Auto-settle them with creator's outcome
3. Find all contested markets past vote deadline
4. Resolve them based on vote results

**Returns**: JSON with counts of processed settlements

### initiate_settlement(market_id, outcome, creator_id)
Initiates settlement process for a private market.

**Parameters**:
- `market_id`: UUID of market to settle
- `outcome`: Boolean (true = YES, false = NO)
- `creator_id`: UUID of creator initiating settlement

**Returns**: JSON with settlement details

### contest_settlement(market_id, contestant_id)
Contests an existing settlement.

**Parameters**:
- `market_id`: UUID of market being contested
- `contestant_id`: UUID of user contesting

**Returns**: JSON with contest details

### submit_vote(contest_id, voter_id, vote_outcome)
Submits a vote on a contested settlement.

**Parameters**:
- `contest_id`: UUID of contest
- `voter_id`: UUID of voter
- `vote_outcome`: Boolean (true = YES, false = NO)

**Returns**: JSON with vote confirmation

---

## Automated Jobs

### Vercel Cron Job Configuration

**File**: `vercel.json`
\`\`\`json
{
  "crons": [{
    "path": "/api/cron/settlement",
    "schedule": "*/5 * * * *"
  }]
}
\`\`\`

**Endpoint**: `/api/cron/settlement`
- **Method**: GET
- **Auth**: Bearer token (CRON_SECRET)
- **Schedule**: Every 5 minutes
- **Function**: Calls `check_pending_settlements()`

**Setup**:
1. Add `CRON_SECRET` to environment variables
2. Deploy to Vercel (cron auto-configured)
3. Test endpoint: `curl -H "Authorization: Bearer YOUR_SECRET" https://your-app.vercel.app/api/cron/settlement`

---

## Frontend Components

### Market Detail Page (`app/market/[id]/market-detail-client.tsx`)

**Settlement Initiation Section**:
- Visible to: Creator only
- Conditions: Private market, active status, no existing settlement
- Shows: Bond amount (creator fees), outcome selector, initiate button

**Contest Section**:
- Visible to: All participants (except creator)
- Conditions: Settlement initiated, within contest deadline
- Shows: Contest deadline countdown, $50 bond requirement, contest button

**Voting Section**:
- Visible to: Notified verifiers only
- Conditions: Contest active, within vote deadline, user was notified
- Shows: Vote deadline countdown, $25 bond requirement, YES/NO vote buttons

**Status Display**:
- Shows current settlement state
- Displays relevant deadlines
- Updates in real-time

### My Bets Page - Bonds Tab (`app/my-bets/my-bets-client.tsx`)

**Bond Display**:
- **Outstanding Bonds** (orange border): Pending resolution
- **Returned Bonds** (green border): Won or tie
- **Lost Bonds** (red border): Forfeited

**P&L Calculation**:
\`\`\`typescript
const pnl = bond.payout_amount - bond.bond_amount;
// Green if pnl > 0
// Red if pnl < 0
// Black if pnl = 0
\`\`\`

**Bond Types Shown**:
1. Settlement Bonds (creator fees)
2. Contest Bonds ($50)
3. Vote Bonds ($25)

### Home Page - Earner View (`components/home-page-client.tsx`)

**Market Status Detection**:
\`\`\`typescript
const isSettled = 
  market.outcome !== null || 
  market.status !== 'active';

const canSettle = 
  market.is_private && 
  !isSettled;
\`\`\`

**Display**:
- Shows "Settle" button for unsettled private markets
- Shows "Settled" badge for settled markets
- Shows "Cancelled" badge for cancelled markets

---

## Security & Authorization

### Settlement Initiation
- Only creator can initiate
- Only private markets
- Only active markets
- Must have accumulated fees for bond

### Contesting
- Only market participants
- Must be within contest deadline
- Must have $50 balance

### Voting
- Only notified verifiers
- Must be within vote deadline
- Must have $25 balance
- One vote per user per contest

### Cron Endpoint
- Protected by CRON_SECRET
- Only processes expired deadlines
- Idempotent (safe to run multiple times)

---

## Testing Procedures

### Manual Testing Checklist

**Uncontested Settlement**:
- [ ] Creator initiates settlement on private market
- [ ] Bond amount equals creator fees
- [ ] Market status changes to 'suspended'
- [ ] All participants notified
- [ ] Wait 1 hour (or use admin force settle)
- [ ] Market auto-settles with creator's outcome
- [ ] Creator receives bond + fees + liquidity
- [ ] Winners receive $1 per share
- [ ] Losers receive $0
- [ ] All notifications sent correctly

**Contested Settlement - Majority Vote**:
- [ ] Creator initiates settlement
- [ ] Participant contests within 1 hour
- [ ] $50 deducted from contestant
- [ ] Verifiers notified
- [ ] Verifiers vote with $25 bonds
- [ ] Wait 1 hour (or use admin force settle)
- [ ] Market settles with majority outcome
- [ ] Correct voters receive bond + profit
- [ ] Incorrect voters lose bonds
- [ ] Creator/contestant receive appropriate payout
- [ ] All notifications sent correctly

**Contested Settlement - Tie Vote**:
- [ ] Creator initiates settlement
- [ ] Participant contests (no other voters)
- [ ] Wait 1 hour (or use admin force settle)
- [ ] Market is cancelled
- [ ] All bonds returned in full
- [ ] All positions refunded at cost basis
- [ ] All P&L shows $0.00
- [ ] All notifications sent correctly

**Bond Display**:
- [ ] Outstanding bonds show orange border
- [ ] Returned bonds show green border with positive P&L
- [ ] Lost bonds show red border with negative P&L
- [ ] Tie bonds show gray border with $0.00 P&L

**Earner View**:
- [ ] Unsettled private markets show "Settle" button
- [ ] Settled markets show "Settled" badge
- [ ] Cancelled markets show "Cancelled" badge
- [ ] No settlement button on settled markets

### Admin Testing Tools

**Force Settlement** (`/admin` page):
- "Test Settlement Now" button
- Manually triggers `check_pending_settlements()`
- Useful for testing without waiting 1 hour

**Settlement Status Debug** (`/api/debug/settlement-status`):
- Shows all pending settlements
- Displays deadlines and vote counts
- Useful for debugging issues

---

## Common Issues & Fixes

### Issue: Tie votes settling to creator instead of cancelling
**Cause**: Contestant's vote not being counted
**Fix**: Contestant automatically votes OPPOSITE of creator (fixed in `fix_tie_detection_and_pnl_tracking.sql`)

### Issue: P&L not showing for bonds
**Cause**: `payout_amount` not stored in database
**Fix**: Added `payout_amount` column to all bond tables (fixed in `add_payout_amount_to_bonds.sql`)

### Issue: Positions not refunded on cancellation
**Cause**: Cancellation logic only returned bonds, not positions
**Fix**: Added position refund at cost basis for cancelled markets (fixed in `fix_cancellation_refunds_and_notifications.sql`)

### Issue: Notifications not sent to all participants
**Cause**: Notification logic only sent to creator
**Fix**: Added notifications for all participants in all scenarios (fixed in `fix_settlement_complete_with_refunds.sql`)

### Issue: Settled markets still showing settlement button
**Cause**: Earner view only checking `outcome === null`
**Fix**: Also check `status !== 'active'` (fixed in `components/home-page-client.tsx`)

---

## Architecture Decisions

### Why Bond-Based System?
- **Skin in the game**: Participants risk capital to ensure honest behavior
- **Self-policing**: Incorrect settlements are financially punished
- **Democratic**: Majority vote determines outcome
- **Fair**: Ties result in full refunds (no one loses)

### Why Contestant Votes Opposite?
- **Logical**: If you contest, you disagree with creator
- **Simplifies**: No need to ask contestant for their vote
- **Prevents gaming**: Can't contest and then vote with creator

### Why Refund at Cost Basis on Cancellation?
- **Fair**: No one profits or loses from a tie
- **Zero P&L**: Everyone gets back exactly what they put in
- **Prevents gaming**: Can't profit from forcing a tie

### Why 1-Hour Deadlines?
- **Fast resolution**: Markets settle quickly
- **Sufficient time**: Participants have time to respond
- **Prevents stalling**: Can't delay indefinitely

---

## Future Enhancements

### Potential Improvements
- [ ] Adjustable deadlines (creator chooses contest/vote duration)
- [ ] Reputation system (track correct/incorrect votes)
- [ ] Escalation mechanism (appeal to higher authority)
- [ ] Partial refunds (graduated penalties for incorrect votes)
- [ ] Evidence submission (attach proof for votes)
- [ ] Weighted voting (based on stake or reputation)

### Known Limitations
- Fixed bond amounts ($50 contest, $25 vote)
- Fixed deadlines (1 hour for both phases)
- No appeal process
- No evidence submission
- Random verifier selection (no reputation weighting)

---

## Support & Troubleshooting

### Logs & Debugging
- Check `/api/debug/settlement-status` for pending settlements
- Use admin page "Test Settlement Now" to manually trigger
- Check notifications table for sent notifications
- Check transactions table for bond payments

### Common Questions

**Q: What happens if no one votes?**
A: If only creator and contestant (1-1 tie), market is cancelled and all bonds returned.

**Q: Can I cancel a settlement after initiating?**
A: No, once initiated, it must complete (either auto-settle or be contested).

**Q: What if I vote incorrectly?**
A: You lose your $25 vote bond, which is distributed to correct voters.

**Q: Can I contest my own settlement?**
A: No, only other participants can contest.

**Q: What if the market is already resolved?**
A: You cannot initiate settlement on already resolved markets.

---

## Version History

### v3.0 (Current)
- Added position refunds at cost basis for cancelled markets
- Fixed tie detection (contestant votes opposite of creator)
- Added P&L tracking for all bond types
- Added comprehensive notifications for all participants
- Fixed earner view to properly detect settled markets

### v2.0
- Added automated cron job for settlement processing
- Added bond-based voting system
- Added verifier selection logic
- Added tie vote handling

### v1.0
- Initial oracle settlement system
- Basic settlement initiation
- Contest mechanism
- Manual resolution

---

## Contact & Support

For issues or questions:
1. Check this documentation first
2. Review common issues section
3. Check debug endpoints
4. Contact development team

---

**Last Updated**: January 2025
**Maintained By**: Development Team
**Status**: Production Ready
