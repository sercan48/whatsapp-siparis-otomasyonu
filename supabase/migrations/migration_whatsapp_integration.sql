-- =====================================================
-- MIGRATION: WhatsApp Order Integration
-- Date: 2026-01-11
-- Creates: customers table, updates orders table
-- =====================================================
-- =====================================================
-- 1. CUSTOMERS TABLE (Müşteri Adres Kaydı)
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    address TEXT,
    district TEXT,
    -- Mahalle
    notes TEXT,
    -- Özel notlar (zil kodu vs)
    order_count INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Her tenant için benzersiz telefon
    UNIQUE(tenant_id, phone)
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- Drop existing policies first (for idempotent runs)
DROP POLICY IF EXISTS "Tenant can manage own customers" ON customers;
DROP POLICY IF EXISTS "Service can insert customers" ON customers;
CREATE POLICY "Tenant can manage own customers" ON customers FOR ALL USING (
    tenant_id = (
        SELECT auth.uid()
    )
) WITH CHECK (
    tenant_id = (
        SELECT auth.uid()
    )
);
-- Service role için insert policy (webhook için)
CREATE POLICY "Service can insert customers" ON customers FOR
INSERT WITH CHECK (true);
-- =====================================================
-- 2. ORDERS TABLE UPDATES
-- =====================================================
-- Add new columns if not exist
DO $$ BEGIN -- customer_id (link to customers table)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'customer_id'
) THEN
ALTER TABLE orders
ADD COLUMN customer_id UUID REFERENCES customers(id);
END IF;
-- delivery_address (sipariş anındaki adres)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'delivery_address'
) THEN
ALTER TABLE orders
ADD COLUMN delivery_address TEXT;
END IF;
-- payment_method (nakit, kart, online)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'payment_method'
) THEN
ALTER TABLE orders
ADD COLUMN payment_method TEXT DEFAULT 'cash';
END IF;
-- payment_status (pending, paid, failed)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'payment_status'
) THEN
ALTER TABLE orders
ADD COLUMN payment_status TEXT DEFAULT 'pending';
END IF;
-- items (JSONB - sipariş detayları)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'items'
) THEN
ALTER TABLE orders
ADD COLUMN items JSONB DEFAULT '[]';
END IF;
-- order_source (whatsapp, qr_table, phone, pos)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'order_source'
) THEN
ALTER TABLE orders
ADD COLUMN order_source TEXT DEFAULT 'pos';
END IF;
-- table_id (QR masa siparişleri için)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'table_id'
) THEN
ALTER TABLE orders
ADD COLUMN table_id UUID REFERENCES restaurant_tables(id);
END IF;
END $$;
-- =====================================================
-- 3. PAYMENT SETTINGS UPDATE (Kapıda ödeme ayarı)
-- =====================================================
DO $$ BEGIN -- cash_on_delivery_enabled
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payment_settings'
        AND column_name = 'cash_on_delivery_enabled'
) THEN
ALTER TABLE payment_settings
ADD COLUMN cash_on_delivery_enabled BOOLEAN DEFAULT true;
END IF;
-- card_on_delivery_enabled
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payment_settings'
        AND column_name = 'card_on_delivery_enabled'
) THEN
ALTER TABLE payment_settings
ADD COLUMN card_on_delivery_enabled BOOLEAN DEFAULT true;
END IF;
-- online_payment_required (teslimat siparişlerinde online ödeme zorunlu mu?)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payment_settings'
        AND column_name = 'online_payment_required'
) THEN
ALTER TABLE payment_settings
ADD COLUMN online_payment_required BOOLEAN DEFAULT false;
END IF;
END $$;
-- =====================================================
-- 4. HELPER FUNCTION: Upsert Customer
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_customer(
        p_tenant_id UUID,
        p_phone TEXT,
        p_name TEXT DEFAULT NULL,
        p_address TEXT DEFAULT NULL
    ) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_customer_id UUID;
BEGIN -- Try to find existing customer
SELECT id INTO v_customer_id
FROM customers
WHERE tenant_id = p_tenant_id
    AND phone = p_phone;
IF v_customer_id IS NULL THEN -- Create new customer
INSERT INTO customers (tenant_id, phone, name, address)
VALUES (p_tenant_id, p_phone, p_name, p_address)
RETURNING id INTO v_customer_id;
ELSE -- Update existing customer (only if new values provided)
UPDATE customers
SET name = COALESCE(p_name, name),
    address = COALESCE(p_address, address),
    updated_at = NOW()
WHERE id = v_customer_id;
END IF;
RETURN v_customer_id;
END;
$$;
-- =====================================================
-- 5. HELPER FUNCTION: Get Customer Address
-- =====================================================
CREATE OR REPLACE FUNCTION get_customer_address(p_tenant_id UUID, p_phone TEXT) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_address TEXT;
BEGIN
SELECT address INTO v_address
FROM customers
WHERE tenant_id = p_tenant_id
    AND phone = p_phone;
RETURN v_address;
END;
$$;
-- =====================================================
-- GRANTS
-- =====================================================
GRANT ALL ON customers TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_customer TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_address TO authenticated;
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE customers IS 'Stores customer contact and address info for quick order processing';
COMMENT ON FUNCTION upsert_customer IS 'Creates or updates customer record, returns customer_id';
COMMENT ON FUNCTION get_customer_address IS 'Returns saved address for a customer phone number';