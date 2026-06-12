-- =====================================================
-- FIX: Comprehensive Order Schema Update
-- Addresses: missing delivery_fee, discount_amount, etc.
-- =====================================================
DO $$ BEGIN -- 1. delivery_fee
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'delivery_fee'
) THEN
ALTER TABLE public.orders
ADD COLUMN delivery_fee NUMERIC(10, 2) DEFAULT 0;
END IF;
-- 2. discount_amount
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'discount_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN discount_amount NUMERIC(10, 2) DEFAULT 0;
END IF;
-- 3. final_amount
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'final_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN final_amount NUMERIC(10, 2);
END IF;
-- 4. payment_method
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'payment_method'
) THEN
ALTER TABLE public.orders
ADD COLUMN payment_method TEXT;
END IF;
-- 5. payment_status
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'payment_status'
) THEN
ALTER TABLE public.orders
ADD COLUMN payment_status TEXT DEFAULT 'pending';
END IF;
-- 6. order_source
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'order_source'
) THEN
ALTER TABLE public.orders
ADD COLUMN order_source TEXT DEFAULT 'digital_menu';
END IF;
-- 7. source (if used as alias)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'source'
) THEN
ALTER TABLE public.orders
ADD COLUMN source TEXT DEFAULT 'digital_menu';
END IF;
END $$;