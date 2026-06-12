-- =====================================================
-- FIX: Missing address_note and Admin/QR enhancements
-- Date: 2026-01-21
-- =====================================================
-- 1. FIX: Add address_note to orders
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'address_note'
) THEN
ALTER TABLE public.orders
ADD COLUMN address_note TEXT;
END IF;
END $$;