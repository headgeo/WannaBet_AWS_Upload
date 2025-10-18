-- Drop existing constraint if it exists
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_status_check;

-- Add new constraint with correct values
ALTER TABLE markets ADD CONSTRAINT markets_status_check 
CHECK (status IN ('active', 'pending', 'resolved', 'cancelled'));

-- Update any invalid status values
UPDATE markets SET status = 'active' WHERE status NOT IN ('active', 'pending', 'resolved', 'cancelled');
