-- Platform Customer Conversion System
-- Tracks customers from external platforms and conversion attempts
-- 1. Conversion tracking table
CREATE TABLE IF NOT EXISTS platform_customer_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100),
    platform_code VARCHAR(20) NOT NULL,
    -- yemeksepeti, getir, etc.
    first_order_id UUID,
    total_platform_orders INT DEFAULT 1,
    message_sent_at TIMESTAMPTZ,
    message_template VARCHAR(50) DEFAULT 'post_delivery',
    converted_at TIMESTAMPTZ,
    -- when they ordered directly
    direct_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, customer_phone)
);
-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pcc_tenant_phone ON platform_customer_conversions(tenant_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_pcc_message_sent ON platform_customer_conversions(message_sent_at);
-- 3. Conversion settings per tenant
CREATE TABLE IF NOT EXISTS conversion_settings (
    tenant_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    discount_percentage INT DEFAULT 15,
    message_template TEXT DEFAULT 'Siparişiniz teslim edildi! 🎉

%{discount} İNDİRİM kodunuz: HOSGELDIN

👉 {menu_url}

{restaurant_name}',
    resend_after_days INT DEFAULT 0,
    -- 0 = never resend
    daily_message_limit INT DEFAULT 50,
    messages_sent_today INT DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. Enable RLS
ALTER TABLE platform_customer_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_settings ENABLE ROW LEVEL SECURITY;
-- 5. RLS Policies
DROP POLICY IF EXISTS "Tenants can view own conversions" ON platform_customer_conversions;
CREATE POLICY "Tenants can view own conversions" ON platform_customer_conversions FOR ALL USING (auth.uid() = tenant_id);
DROP POLICY IF EXISTS "Tenants can manage own conversion settings" ON conversion_settings;
CREATE POLICY "Tenants can manage own conversion settings" ON conversion_settings FOR ALL USING (auth.uid() = tenant_id);
-- 6. Service role policies for Edge Functions
DROP POLICY IF EXISTS "Service can manage conversions" ON platform_customer_conversions;
CREATE POLICY "Service can manage conversions" ON platform_customer_conversions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service can manage conversion settings" ON conversion_settings;
CREATE POLICY "Service can manage conversion settings" ON conversion_settings FOR ALL USING (true) WITH CHECK (true);
-- 7. Function to reset daily message count
CREATE OR REPLACE FUNCTION reset_daily_message_count() RETURNS TRIGGER AS $$ BEGIN IF NEW.last_reset_date < CURRENT_DATE THEN NEW.messages_sent_today := 0;
NEW.last_reset_date := CURRENT_DATE;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 8. Trigger for daily reset
DROP TRIGGER IF EXISTS trg_reset_message_count ON conversion_settings;
CREATE TRIGGER trg_reset_message_count BEFORE
UPDATE ON conversion_settings FOR EACH ROW EXECUTE FUNCTION reset_daily_message_count();