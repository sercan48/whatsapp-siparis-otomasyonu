-- Migration: Create Discounts/Coupons System
-- Created: 2026-01-19
-- Run this in Supabase SQL Editor
-- STEP 1: Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
    code text NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    value numeric NOT NULL CHECK (value > 0),
    min_order_amount numeric DEFAULT 0 CHECK (min_order_amount >= 0),
    is_active boolean DEFAULT true,
    valid_from timestamptz DEFAULT now(),
    valid_until timestamptz,
    max_uses integer,
    used_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- STEP 2: Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
-- STEP 3: Policies (DROP first if they exist)
DROP POLICY IF EXISTS "Public can read active coupons for validation" ON public.coupons;
DROP POLICY IF EXISTS "Tenant admins can manage their coupons" ON public.coupons;
CREATE POLICY "Public can read active coupons for validation" ON public.coupons FOR
SELECT TO anon,
    authenticated USING (is_active = true);
CREATE POLICY "Tenant admins can manage their coupons" ON public.coupons FOR ALL TO authenticated USING (tenant_id = auth.uid());
-- STEP 4: Add discount columns to pos_orders
ALTER TABLE public.pos_orders
ADD COLUMN IF NOT EXISTS discount_code text,
    ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
-- STEP 5: RPC Function to validate coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(
        p_code text,
        p_cart_total numeric,
        p_tenant_id uuid DEFAULT NULL
    ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_coupon record;
v_discount_amount numeric;
BEGIN -- Fetch coupon
SELECT * INTO v_coupon
FROM public.coupons
WHERE code = UPPER(TRIM(p_code))
    AND (
        p_tenant_id IS NULL
        OR tenant_id = p_tenant_id
        OR tenant_id IS NULL
    );
-- 1. Check existence
IF v_coupon IS NULL THEN RETURN json_build_object(
    'valid',
    false,
    'message',
    'Geçersiz kupon kodu.',
    'amount',
    0
);
END IF;
-- 2. Check active status
IF NOT v_coupon.is_active THEN RETURN json_build_object(
    'valid',
    false,
    'message',
    'Bu kupon aktif değil.',
    'amount',
    0
);
END IF;
-- 3. Check dates
IF (v_coupon.valid_from > now())
OR (
    v_coupon.valid_until IS NOT NULL
    AND v_coupon.valid_until < now()
) THEN RETURN json_build_object(
    'valid',
    false,
    'message',
    'Kupon süresi dolmuş veya henüz başlamamış.',
    'amount',
    0
);
END IF;
-- 4. Check usage limits
IF v_coupon.max_uses IS NOT NULL
AND v_coupon.used_count >= v_coupon.max_uses THEN RETURN json_build_object(
    'valid',
    false,
    'message',
    'Bu kupon kullanım limitine ulaşmış.',
    'amount',
    0
);
END IF;
-- 5. Check min order amount
IF p_cart_total < v_coupon.min_order_amount THEN RETURN json_build_object(
    'valid',
    false,
    'message',
    format(
        'Bu kuponu kullanmak için sepet tutarı en az %s TL olmalıdır.',
        v_coupon.min_order_amount
    ),
    'amount',
    0
);
END IF;
-- Calculate Discount
IF v_coupon.discount_type = 'percentage' THEN v_discount_amount := ROUND((p_cart_total * v_coupon.value / 100), 2);
ELSE v_discount_amount := v_coupon.value;
END IF;
-- Ensure discount doesn't exceed total
IF v_discount_amount > p_cart_total THEN v_discount_amount := p_cart_total;
END IF;
RETURN json_build_object(
    'valid',
    true,
    'message',
    'Kupon uygulandı!',
    'amount',
    v_discount_amount,
    'type',
    v_coupon.discount_type,
    'value',
    v_coupon.value
);
END;
$$;
-- STEP 6: Function to increment coupon usage
CREATE OR REPLACE FUNCTION public.use_coupon(p_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
UPDATE public.coupons
SET used_count = used_count + 1
WHERE code = UPPER(TRIM(p_code));
END;
$$;
-- STEP 7: Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_tenant ON public.coupons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active)
WHERE is_active = true;
-- STEP 8: Create a test coupon (optional)
-- INSERT INTO public.coupons (code, discount_type, value, min_order_amount, is_active)
-- VALUES ('TEST10', 'percentage', 10, 50, true);