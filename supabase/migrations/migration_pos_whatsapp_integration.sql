-- =====================================================
-- MIGRATION: WhatsApp-POS Entegrasyonu
-- Date: 2026-01-11
-- WhatsApp siparişlerini POS sistemine entegre eder
-- =====================================================
-- =====================================================
-- 1. POS_SESSIONS - Session Tipi Ekleme
-- =====================================================
DO $$ BEGIN -- session_type kolonu (dine_in, takeaway, delivery)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_sessions'
        AND column_name = 'session_type'
) THEN
ALTER TABLE pos_sessions
ADD COLUMN session_type TEXT DEFAULT 'dine_in';
END IF;
-- customer_phone (WhatsApp siparişleri için)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_sessions'
        AND column_name = 'customer_phone'
) THEN
ALTER TABLE pos_sessions
ADD COLUMN customer_phone TEXT;
END IF;
-- customer_name
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_sessions'
        AND column_name = 'customer_name'
) THEN
ALTER TABLE pos_sessions
ADD COLUMN customer_name TEXT;
END IF;
END $$;
-- =====================================================
-- 2. POS_ORDERS - Ek Kolonlar
-- =====================================================
DO $$ BEGIN -- order_source (pos, whatsapp, qr_menu, phone)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_orders'
        AND column_name = 'order_source'
) THEN
ALTER TABLE pos_orders
ADD COLUMN order_source TEXT DEFAULT 'pos';
END IF;
-- customer_phone
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_orders'
        AND column_name = 'customer_phone'
) THEN
ALTER TABLE pos_orders
ADD COLUMN customer_phone TEXT;
END IF;
-- customer_name
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_orders'
        AND column_name = 'customer_name'
) THEN
ALTER TABLE pos_orders
ADD COLUMN customer_name TEXT;
END IF;
-- delivery_address
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_orders'
        AND column_name = 'delivery_address'
) THEN
ALTER TABLE pos_orders
ADD COLUMN delivery_address TEXT;
END IF;
-- payment_method (cash, credit_card, online)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_orders'
        AND column_name = 'payment_method'
) THEN
ALTER TABLE pos_orders
ADD COLUMN payment_method TEXT DEFAULT 'cash';
END IF;
-- total_amount (sipariş toplamı)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_orders'
        AND column_name = 'total_amount'
) THEN
ALTER TABLE pos_orders
ADD COLUMN total_amount DECIMAL(10, 2) DEFAULT 0;
END IF;
END $$;
-- =====================================================
-- 3. VIRTUAL TABLE FOR ONLINE ORDERS
-- WhatsApp/Online siparişleri için sanal masa
-- =====================================================
-- Her tenant için "Online Siparişler" sanal masası oluştur
-- Bu fonksiyon yeni tenant oluşturulduğunda çağrılabilir
CREATE OR REPLACE FUNCTION ensure_online_orders_table(p_tenant_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_table_id UUID;
BEGIN -- Check if online orders table exists for this tenant
SELECT id INTO v_table_id
FROM restaurant_tables
WHERE tenant_id = p_tenant_id
    AND name = 'Online Siparişler';
IF v_table_id IS NULL THEN -- Create virtual table for online orders (using 999 as table number)
INSERT INTO restaurant_tables (
        tenant_id,
        table_number,
        name,
        is_active,
        capacity
    )
VALUES (p_tenant_id, 999, 'Online Siparişler', true, 0)
RETURNING id INTO v_table_id;
END IF;
RETURN v_table_id;
END;
$$;
-- =====================================================
-- 4. HELPER: Create Online Order Session
-- WhatsApp siparişleri için session oluşturur
-- =====================================================
CREATE OR REPLACE FUNCTION create_online_order_session(
        p_tenant_id UUID,
        p_customer_phone TEXT,
        p_customer_name TEXT,
        p_session_type TEXT DEFAULT 'delivery'
    ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_table_id UUID;
v_session_id UUID;
BEGIN -- Get or create online orders table
v_table_id := ensure_online_orders_table(p_tenant_id);
-- Create new session
INSERT INTO pos_sessions (
        tenant_id,
        table_id,
        status,
        session_type,
        customer_phone,
        customer_name,
        opened_at
    )
VALUES (
        p_tenant_id,
        v_table_id,
        'open',
        p_session_type,
        p_customer_phone,
        p_customer_name,
        NOW()
    )
RETURNING id INTO v_session_id;
RETURN v_session_id;
END;
$$;
-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION ensure_online_orders_table TO authenticated;
GRANT EXECUTE ON FUNCTION create_online_order_session TO authenticated;
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN pos_sessions.session_type IS 'Session type: dine_in, takeaway, delivery';
COMMENT ON COLUMN pos_orders.order_source IS 'Order source: pos, whatsapp, qr_menu, phone';
COMMENT ON FUNCTION ensure_online_orders_table IS 'Ensures a virtual table exists for online orders';
COMMENT ON FUNCTION create_online_order_session IS 'Creates a session for WhatsApp/online orders';