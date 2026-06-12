-- FUNCTION: cancel_order
-- Usage: SELECT cancel_order('ORDER_UUID_HERE', 'Customer request');

CREATE OR REPLACE FUNCTION cancel_order(
    p_order_id UUID, 
    p_cancel_reason TEXT DEFAULT 'User requested'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to bypass RLS if needed
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_time_diff INTERVAL;
BEGIN
    -- 1. Get Order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sipariş bulunamadı.');
    END IF;

    -- 2. Check Status Rule (Allow cancel only if order is in initial states like 'received' or 'paid')
    -- In a multi-tenant environment, initial status is typically 'received' or 'paid'
    IF v_order.status NOT IN ('received', 'paid', 'new') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('Sipariş şu an "%s" aşamasında, iptal edilemez.', v_order.status)
        );
    END IF;

    -- 3. Check Time Rule (Example: 5 Minutes)
    v_time_diff := now() - v_order.created_at;
    IF v_time_diff > INTERVAL '5 minutes' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Siparişin üzerinden 5 dakika geçtiği için iptal edilemez. Lütfen işletmeyle iletişime geçin.'
        );
    END IF;

    -- 4. Execute Cancel by updating status and merging cancellation details into JSONB meta_data
    UPDATE public.orders 
    SET 
        status = 'cancelled',
        meta_data = meta_data || jsonb_build_object(
            'cancel_reason', p_cancel_reason,
            'cancelled_at', timezone('utc'::text, now())
        )
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Sipariş başarıyla iptal edildi.');
END;
$$;

-------------------------------------------------------------------------
-- FUNCTION: reconcile_bank_transactions
-- Usage: SELECT reconcile_bank_transactions('TENANT_UUID_HERE');
-------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reconcile_bank_transactions(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges to update matching order statuses
AS $$
DECLARE
    r RECORD;
    v_matched_count INT := 0;
    v_order_id UUID;
BEGIN
    FOR r IN 
        SELECT * FROM public.bank_transactions 
        WHERE tenant_id = p_tenant_id AND status = 'unmatched'
    LOOP
        -- Find a pending bank_transfer order that has matching amount AND matching description details
        SELECT id INTO v_order_id
        FROM public.orders
        WHERE tenant_id = p_tenant_id 
          AND payment_status = 'pending'
          AND payment_method = 'bank_transfer'
          AND final_amount = r.amount
          AND (
              r.description ILIKE '%' || split_part(id::text, '-', 1) || '%' -- Match short order ID segment (e.g. ord-101)
              OR r.description ILIKE '%' || id::text || '%'
              OR customer_id IN (
                  SELECT id FROM public.customers 
                  WHERE name ILIKE '%' || r.sender_name || '%' 
                     OR r.sender_name ILIKE '%' || name || '%'
              )
          )
        LIMIT 1;

        -- If match found, reconcile them
        IF v_order_id IS NOT NULL THEN
            UPDATE public.orders 
            SET payment_status = 'paid',
                meta_data = meta_data || jsonb_build_object(
                    'reconciled_at', timezone('utc'::text, now()),
                    'reconciliation_source', 'bank_statement',
                    'bank_transaction_id', r.id
                )
            WHERE id = v_order_id;

            UPDATE public.bank_transactions 
            SET matched_order_id = v_order_id,
                status = 'matched'
            WHERE id = r.id;

            v_matched_count := v_matched_count + 1;
            v_order_id := NULL;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'matched_count', v_matched_count);
END;
$$;

