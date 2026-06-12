-- =====================================================
-- SECURITY REMEDIATION V2
-- Focus: POS Order Integrity
-- =====================================================
-- 1. SECURE POS ORDER PLACEMENT (RPC)
CREATE OR REPLACE FUNCTION public.place_pos_order_secure(
        p_session_id UUID,
        p_items JSONB,
        -- Array of {product_id, quantity, note}
        p_order_note TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tenant_id UUID;
v_order_id UUID;
v_item RECORD;
v_product RECORD;
v_cart_sum NUMERIC(10, 2) := 0;
BEGIN -- 1. Get Tenant ID from Session
SELECT tenant_id INTO v_tenant_id
FROM public.pos_sessions
WHERE id = p_session_id;
IF v_tenant_id IS NULL THEN RETURN jsonb_build_object(
    'success',
    false,
    'message',
    'Oturum bulunamadı.'
);
END IF;
-- 2. Create Order Container
INSERT INTO public.pos_orders (
        tenant_id,
        pos_session_id,
        note,
        status
    )
VALUES (
        v_tenant_id,
        p_session_id,
        p_order_note,
        'pending'
    )
RETURNING id INTO v_order_id;
-- 3. Calculate Prices & Insert Items
FOR v_item IN
SELECT *
FROM jsonb_array_elements(p_items) LOOP -- Fetch current price from Products table
SELECT * INTO v_product
FROM public.products
WHERE id = (v_item.value->>'product_id')::UUID
    AND tenant_id = v_tenant_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Ürün bulunamadı: %',
v_item.value->>'name';
END IF;
INSERT INTO public.pos_order_items (
        tenant_id,
        pos_order_id,
        product_id,
        name,
        price,
        quantity,
        note,
        status
    )
VALUES (
        v_tenant_id,
        v_order_id,
        v_product.id,
        v_product.name,
        v_product.price,
        (v_item.value->>'quantity')::INT,
        v_item.value->>'note',
        'pending'
    );
v_cart_sum := v_cart_sum + (
    v_product.price * (v_item.value->>'quantity')::INT
);
END LOOP;
-- 4. Update Session Total
UPDATE public.pos_sessions
SET total_amount = COALESCE(total_amount, 0) + v_cart_sum
WHERE id = p_session_id;
RETURN jsonb_build_object(
    'success',
    true,
    'order_id',
    v_order_id,
    'cart_sum',
    v_cart_sum,
    'message',
    'Sipariş başarıyla kaydedildi.'
);
END;
$$;