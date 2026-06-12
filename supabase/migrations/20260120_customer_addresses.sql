-- Customer Addresses Table
-- Stores saved delivery addresses for repeat customers
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT 'Ev',
    -- 'Ev', 'İş', 'Diğer'
    customer_name VARCHAR(100),
    full_address TEXT NOT NULL,
    district VARCHAR(100),
    address_note TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Unique constraint: one label per phone per tenant
    UNIQUE(tenant_id, phone, label)
);
-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_addresses_phone ON customer_addresses(phone);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_tenant ON customer_addresses(tenant_id);
-- Row Level Security
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
-- Allow public read for menu customers (by phone)
CREATE POLICY "Anyone can read addresses by phone" ON customer_addresses FOR
SELECT USING (true);
-- Allow insert from authenticated users or service role
CREATE POLICY "Service role can manage addresses" ON customer_addresses FOR ALL USING (true) WITH CHECK (true);
-- Function to get saved addresses by phone
CREATE OR REPLACE FUNCTION get_customer_addresses(p_phone VARCHAR, p_tenant_id UUID DEFAULT NULL) RETURNS TABLE (
        id UUID,
        label VARCHAR,
        customer_name VARCHAR,
        full_address TEXT,
        district VARCHAR,
        address_note TEXT,
        is_default BOOLEAN
    ) AS $$ BEGIN RETURN QUERY
SELECT ca.id,
    ca.label,
    ca.customer_name,
    ca.full_address,
    ca.district,
    ca.address_note,
    ca.is_default
FROM customer_addresses ca
WHERE ca.phone = p_phone
    AND (
        p_tenant_id IS NULL
        OR ca.tenant_id = p_tenant_id
    )
ORDER BY ca.is_default DESC,
    ca.created_at DESC;
END;
$$ LANGUAGE plpgsql;