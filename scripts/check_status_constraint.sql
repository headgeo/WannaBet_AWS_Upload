-- Check the current status constraint on markets table
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'markets' 
AND conname LIKE '%status%';

-- If the constraint doesn't exist or needs updating, create/update it
-- First, let's see what status values currently exist
SELECT DISTINCT status FROM markets;
