-- PostgreSQL Migration: SaaS Commerce Core RPCs
-- Date: 2026-06-10
-- Version: 1.0.1

CREATE OR REPLACE FUNCTION public.place_order_secure(
    p_tenant_id UUID,
    p_user_id TEXT,
    p_customer_name TEXT,
    p_delivery_address TEXT,
    p_items JSONB, -- Array of {"id": "...", "name": "...", "quantity": 1, "extras": [...], "notes": ""}
    p_payment_method TEXT,
    p_service_type TEXT DEFAULT 'delivery',
    p_table_number TEXT DEFAULT NULL,
    p_address_note TEXT DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_order_id UUID;
    v_customer_id UUID;
    v_calculated_total NUMERIC := 0;
    v_item JSONB;
    v_product RECORD;
    v_extra JSONB;
    v_extra_price NUMERIC;
    v_item_total NUMERIC;
    v_coupon_discount NUMERIC := 0;
    v_final_total NUMERIC;
BEGIN
    -- 1. Ensure customer exists and get their UUID
    INSERT INTO public.customers (tenant_id, phone, name)
    VALUES (p_tenant_id, p_user_id, p_customer_name)
    ON CONFLICT (tenant_id, phone) DO UPDATE
    SET name = EXCLUDED.name,
        meta_data = public.customers.meta_data || jsonb_build_object('last_order_at', now())
    RETURNING id INTO v_customer_id;

    -- 2. Calculate order total from products prices in database
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        -- Get product from public.products table
        SELECT * INTO v_product
        FROM public.products
        WHERE id = (v_item->>'id')::UUID
          AND tenant_id = p_tenant_id
          AND is_active = true;

        IF v_product.price IS NULL THEN
            RAISE EXCEPTION 'Geçersiz ürün: %', v_item->>'id';
        END IF;

        -- Base price * quantity
        v_item_total := v_product.price * (v_item->>'quantity')::INT;

        -- Add extras if provided
        IF v_item->'extras' IS NOT NULL THEN
            FOR v_extra IN SELECT * FROM jsonb_array_elements(v_item->'extras') LOOP
                v_extra_price := (v_extra->>'price')::NUMERIC;
                IF v_extra_price IS NOT NULL THEN
                    v_item_total := v_item_total + (v_extra_price * (v_item->>'quantity')::INT);
                END IF;
            END LOOP;
        END IF;

        v_calculated_total := v_calculated_total + v_item_total;
    END LOOP;

    -- 3. Apply coupon discount if provided
    IF p_coupon_code IS NOT NULL THEN
        SELECT (rules->>'value')::NUMERIC INTO v_coupon_discount
        FROM public.campaigns
        WHERE name = p_coupon_code
          AND tenant_id = p_tenant_id
          AND is_active = true;
          
        IF v_coupon_discount IS NOT NULL THEN
            v_calculated_total := v_calculated_total * (1 - v_coupon_discount / 100);
        END IF;
    END IF;

    v_final_total := v_calculated_total;

    -- 4. Insert order with validated total
    INSERT INTO public.orders (
        tenant_id,
        customer_id,
        status,
        items,
        subtotal_amount,
        discount_amount,
        final_amount,
        payment_method,
        payment_status,
        meta_data
    )
    VALUES (
        p_tenant_id,
        v_customer_id,
        CASE
            WHEN p_payment_method = 'online' THEN 'payment_pending'
            ELSE 'pending'
        END,
        p_items,
        v_calculated_total,
        v_calculated_total - v_final_total,
        v_final_total,
        p_payment_method,
        'pending',
        jsonb_build_object(
            'service_type', p_service_type,
            'table_number', p_table_number,
            'delivery_address', p_delivery_address,
            'address_note', p_address_note,
            'coupon_code', p_coupon_code
        )
    )
    RETURNING id INTO v_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total', v_final_total,
        'message', 'Sipariş başarıyla oluşturuldu.'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order_secure TO authenticated, anonymous, service_role;
