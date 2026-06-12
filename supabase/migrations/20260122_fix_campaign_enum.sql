-- Fix for "invalid input value for enum campaign_type: product_discount"
-- Adding 'product_discount' to the enum
DO $$ BEGIN ALTER TYPE campaign_type
ADD VALUE IF NOT EXISTS 'product_discount';
EXCEPTION
WHEN duplicate_object THEN null;
END $$;