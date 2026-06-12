-- =====================================================
-- CREATE SECURE ORDER PLACEMENT RPC (FIXED)
-- =====================================================
-- This function handles order creation with server-side price validation
-- to prevent client-side price manipulation attacks.
CREATE OR REPLACE FUNCTION public.place_order_secure(
        p_tenant_id UUID,
        p_user_id TEXT,
        p_customer_name TEXT,
        p_delivery_address TEXT,
        p_items JSONB,
        p_payment_method TEXT,
        p_service_type TEXT DEFAULT 'delivery',
        p_table_number TEXT DEFAULT NULL,
        p_address_note TEXT DEFAULT NULL,
        p_coupon_code TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_order_id UUID;
v_calculated_total NUMERIC := 0;
v_item JSONB;
v_product_price NUMERIC;
-- FIXED: Changed from RECORD to NUMERIC
v_extra JSONB;
v_extra_price NUMERIC;
v_item_total NUMERIC;
v_coupon_discount NUMERIC := 0;
v_final_total NUMERIC;
BEGIN -- 1. Calculate order total from database prices (NOT client prices)
FOR v_item IN
SELECT *
FROM jsonb_array_elements(p_items) LOOP -- Get product price from database
SELECT price INTO v_product_price
FROM menu_items
WHERE id = (v_item->>'id')::UUID
    AND tenant_id = p_tenant_id
    AND is_active = true;
IF v_product_price IS NULL THEN RAISE EXCEPTION 'Invalid product: %',
v_item->>'id';
END IF;
-- Start with base price * quantity
v_item_total := v_product_price * (v_item->>'quantity')::INT;
-- FIXED: Use v_product_price directly
-- Add extras prices
IF v_item->'extras' IS NOT NULL THEN FOR v_extra IN
SELECT *
FROM jsonb_array_elements(v_item->'extras') LOOP
SELECT price INTO v_extra_price
FROM extras
WHERE id = (v_extra->>'id')::UUID
    AND tenant_id = p_tenant_id;
IF v_extra_price IS NOT NULL THEN v_item_total := v_item_total + (v_extra_price * (v_item->>'quantity')::INT);
END IF;
END LOOP;
END IF;
v_calculated_total := v_calculated_total + v_item_total;
END LOOP;
-- 2. Apply coupon discount if provided
IF p_coupon_code IS NOT NULL THEN
SELECT discount_percentage INTO v_coupon_discount
FROM coupons
WHERE code = p_coupon_code
    AND tenant_id = p_tenant_id
    AND is_active = true
    AND expires_at > NOW();
IF v_coupon_discount IS NOT NULL THEN v_calculated_total := v_calculated_total * (1 - v_coupon_discount / 100);
END IF;
END IF;
v_final_total := v_calculated_total;
-- 3. Create order with validated total
INSERT INTO orders (
        tenant_id,
        user_id,
        customer_name,
        delivery_address,
        address_note,
        items,
        total,
        payment_method,
        service_type,
        table_number,
        coupon_code,
        status,
        created_at
    )
VALUES (
        p_tenant_id,
        p_user_id,
        p_customer_name,
        p_delivery_address,
        p_address_note,
        p_items,
        v_final_total,
        p_payment_method,
        p_service_type,
        p_table_number,
        p_coupon_code,
        CASE
            WHEN p_payment_method = 'Online' THEN 'payment_pending'
            ELSE 'pending'
        END,
        NOW()
    )
RETURNING id INTO v_order_id;
-- 4. Return success response
RETURN jsonb_build_object(
    'success',
    true,
    'order_id',
    v_order_id,
    'total',
    v_final_total,
    'message',
    'Order created successfully'
);
EXCEPTION
WHEN OTHERS THEN RETURN jsonb_build_object(
    'success',
    false,
    'message',
    SQLERRM
);
END;
$$;
-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.place_order_secure TO authenticated,
    service_role;
-- Add comment
COMMENT ON FUNCTION public.place_order_secure IS 'Securely create order with server-side price validation to prevent manipulation attacks';