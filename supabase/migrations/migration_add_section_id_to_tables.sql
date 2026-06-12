-- Migration: Add section_id column to restaurant_tables
-- This fixes: "Could not find the 'section_id' column of 'restaurant_tables' in the schema cache"
-- Step 1: Add section_id column if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'restaurant_tables'
        AND column_name = 'section_id'
) THEN
ALTER TABLE restaurant_tables
ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE
SET NULL;
END IF;
END $$;
-- Step 2: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_section_id ON restaurant_tables(section_id);
-- Step 3: Verify the column exists
SELECT column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'restaurant_tables'
    AND column_name = 'section_id';