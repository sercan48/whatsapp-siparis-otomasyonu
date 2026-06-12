-- =====================================================
-- SECURITY REMEDIATION V1
-- Focus: Prevent Price Manipulation & Abuse
-- =====================================================
-- 1. SECURE ORDER PLACEMENT FUNCTION (RPC)
-- This function calculates the price SERVER-SIDE to prevent manipulation.
CREATE OR REPLACE FUNCTION public.place_order_secure(
        p_tenant_id UUID,
        p_user_id TEXT,
        -- User phone
        p_customer_name TEXT,
        p_delivery_address TEXT,
        p_address_note TEXT,
        p_items JSONB,
        -- Array of {product_id, quantity, extras: []}
        p_payment_method TEXT,
        p_service_type service_type,
        p_table_number TEXT DEFAULT NULL,
        p_coupon_code TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER -- Runs with elevated privileges to check menu prices and insert
    AS $$
DECLARE v_subtotal NUMERIC(10, 2) := 0;
v_discount NUMERIC(10, 2) := 0;
v_delivery_fee NUMERIC(10, 2) := 0;
v_final_total NUMERIC(10, 2) := 0;
v_item RECORD;
v_extra RECORD;
v_menu_item RECORD;
v_coupon RECORD;
v_order_id UUID;
v_is_banned BOOLEAN;
BEGIN -- 1. Anti-Abuse: Check if user is banned
SELECT is_banned INTO v_is_banned
FROM public.customers
WHERE phone = p_user_id
    AND tenant_id = p_tenant_id;
IF v_is_banned THEN RETURN jsonb_build_object(
    'success',
    false,
    'message',
    'Hesabınız askıya alınmıştır. Lütfen restoranla iletişime geçin.'
);
END IF;
-- 2. Calculate Subtotal (Server-Side Truth)
FOR v_item IN
SELECT *
FROM jsonb_array_elements(p_items) LOOP -- Fetch current price from Menu table
SELECT * INTO v_menu_item
FROM public.menu
WHERE id = (v_item.value->>'id')::UUID
    AND tenant_id = p_tenant_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Ürün bulunamadı: %',
v_item.value->>'name';
END IF;
v_subtotal := v_subtotal + (
    v_menu_item.price * (v_item.value->>'quantity')::INT
);
-- Handle Extras (Snapshot prices)
-- In a more robust system, extras would also be in a 1:N table with prices.
-- For now, we assume extras prices are part of the JSONB but we could validate them if we had an "extras" table.
END LOOP;
-- 3. Calculate Coupon/Discount
IF p_coupon_code IS NOT NULL THEN
SELECT * INTO v_coupon
FROM public.coupons
WHERE code = UPPER(p_coupon_code)
    AND tenant_id = p_tenant_id
    AND is_active = true
    AND (
        expires_at IS NULL
        OR expires_at > NOW()
    );
IF FOUND THEN IF v_coupon.min_order_amount IS NULL
OR v_subtotal >= v_coupon.min_order_amount THEN v_discount := (v_subtotal * v_coupon.discount_percent / 100);
END IF;
END IF;
END IF;
-- 4. Calculate Delivery Fee (Fetch from Store Settings)
-- This assumes store settings are in profiles.store_settings
SELECT (store_settings->>'delivery_fee')::NUMERIC INTO v_delivery_fee
FROM public.profiles
WHERE id = p_tenant_id;
-- Free delivery threshold check
DECLARE v_free_threshold NUMERIC;
BEGIN
SELECT (store_settings->>'free_delivery_threshold')::NUMERIC INTO v_free_threshold
FROM public.profiles
WHERE id = p_tenant_id;
IF v_free_threshold > 0
AND v_subtotal >= v_free_threshold THEN v_delivery_fee := 0;
END IF;
END;
-- 5. Final Calculation
v_final_total := v_subtotal - v_discount + COALESCE(v_delivery_fee, 0);
-- 6. Insert Order
INSERT INTO public.orders (
        tenant_id,
        user_id,
        customer_name,
        delivery_address,
        address_note,
        items,
        subtotal,
        delivery_fee,
        discount_amount,
        coupon_code,
        total_amount,
        final_amount,
        status,
        payment_method,
        service_type,
        table_number,
        source,
        created_at
    )
VALUES (
        p_tenant_id,
        p_user_id,
        p_customer_name,
        p_delivery_address,
        p_address_note,
        p_items,
        v_subtotal,
        v_delivery_fee,
        v_discount,
        p_coupon_code,
        v_final_total,
        v_final_total,
        CASE
            WHEN p_payment_method IN ('cash', 'card_on_delivery') THEN 'confirmed'::order_status
            ELSE 'new'::order_status
        END,
        p_payment_method,
        p_service_type,
        p_table_number,
        'secure_rpc',
        NOW()
    )
RETURNING id INTO v_order_id;
RETURN jsonb_build_object(
    'success',
    true,
    'order_id',
    v_order_id,
    'total',
    v_final_total,
    'message',
    'Sipariş başarıyla oluşturuldu.'
);
END;
$$;
-- 2. HARDEN RLS FOR ORDERS
-- Now that we have a secure RPC, we can restrict direct inserts if needed,
-- or at least add a check against the ban list in the policy.
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
CREATE POLICY "Public can insert orders with ban check" ON public.orders FOR
INSERT WITH CHECK (
        NOT EXISTS (
            SELECT 1
            FROM public.customers
            WHERE phone = user_id
                AND tenant_id = orders.tenant_id
                AND is_banned = true
        )
    );
-- Note: In a full lockdown, we would only allow INSERT via SECURITY DEFINER functions.