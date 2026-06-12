-- Migration: Change table_number column from INTEGER to VARCHAR
-- This fixes: "invalid input syntax for type integer: 'A-1'"
-- Allows alphanumeric table names like "A-1", "B-5", "VIP-1", etc.
-- Step 1: Change column type from INTEGER to VARCHAR(50)
ALTER TABLE restaurant_tables
ALTER COLUMN table_number TYPE VARCHAR(50) USING table_number::VARCHAR;
-- Step 2: Verify the change
SELECT column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'restaurant_tables'
    AND column_name = 'table_number';