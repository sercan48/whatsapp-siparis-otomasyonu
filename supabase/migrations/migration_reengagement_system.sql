-- Re-Engagement System Migration
-- Creates tables and columns for 25-day customer reminder system
-- 1. Reengagement logs table (track sent messages)
CREATE TABLE IF NOT EXISTS reengagement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL DEFAULT 'reengagement_25day',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reengagement_logs_customer ON reengagement_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_reengagement_logs_tenant ON reengagement_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reengagement_logs_sent_at ON reengagement_logs(sent_at);
-- RLS
ALTER TABLE reengagement_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service can manage reengagement_logs" ON reengagement_logs;
CREATE POLICY "Service can manage reengagement_logs" ON reengagement_logs FOR ALL USING (true);
-- 2. Add last_order_date to customers if not exists
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE;
-- 3. Add reengagement settings to tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS reengagement_template VARCHAR(100) DEFAULT 'customer_reengagement';
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS reengagement_discount VARCHAR(50) DEFAULT 'OZLEDIK10';
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS reengagement_enabled BOOLEAN DEFAULT true;
-- 4. Function to update last_order_date automatically
CREATE OR REPLACE FUNCTION update_customer_last_order() RETURNS TRIGGER AS $$ BEGIN
UPDATE customers
SET last_order_date = NOW()
WHERE phone = NEW.customer_phone
    AND tenant_id = NEW.tenant_id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger on pos_orders
DROP TRIGGER IF EXISTS trg_update_customer_last_order ON pos_orders;
CREATE TRIGGER trg_update_customer_last_order
AFTER
INSERT ON pos_orders FOR EACH ROW EXECUTE FUNCTION update_customer_last_order();
-- 5. Add language column to whatsapp_sessions for multi-language support
ALTER TABLE whatsapp_sessions
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'tr';
-- 6. Add slug column to profiles for clean menu URLs
-- Example: domain.com/m/arasta-kebap
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;
-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);
-- Function to generate slug from company name
CREATE OR REPLACE FUNCTION generate_slug(name TEXT) RETURNS TEXT AS $$ BEGIN RETURN lower(
        regexp_replace(
            regexp_replace(
                translate(name, 'çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu'),
                '[^a-zA-Z0-9]+',
                '-',
                'g'
            ),
            '^-|-$',
            '',
            'g'
        )
    );
END;
$$ LANGUAGE plpgsql;
-- Update existing profiles with generated slugs (using id as fallback)
-- You can manually set nice slugs later via: UPDATE profiles SET slug = 'arasta-kebap' WHERE id = 'xxx';
UPDATE profiles
SET slug = 'restoran-' || substr(id::text, 1, 8)
WHERE slug IS NULL;