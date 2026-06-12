-- =====================================================
-- FIX: Missing coupon_code and Address Validation
-- Date: 2026-01-21
-- =====================================================
-- 1. FIX: Add coupon_code to orders
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'coupon_code'
) THEN
ALTER TABLE public.orders
ADD COLUMN coupon_code TEXT;
END IF;
END $$;