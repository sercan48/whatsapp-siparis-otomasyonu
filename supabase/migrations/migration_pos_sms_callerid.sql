-- =====================================================
-- Migration: POS Devices, Caller ID & SMS Integration
-- Date: 2026-01-14
-- =====================================================
-- =====================================================
-- PART 1: YAZARKASA POS DEVICES
-- =====================================================
CREATE TABLE IF NOT EXISTS pos_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- Device Info
    brand VARCHAR(50) NOT NULL,
    -- 'beko', 'ingenico', 'hugin', 'pax', 'pavo'
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    firmware_version VARCHAR(50),
    -- Connection Settings
    connection_type VARCHAR(20) NOT NULL DEFAULT 'usb',
    -- 'usb', 'ethernet', 'wifi', 'cloud'
    ip_address INET,
    port INTEGER DEFAULT 9100,
    -- API Credentials (encrypted in production)
    api_key TEXT,
    api_secret TEXT,
    gmp3_license TEXT,
    -- GMP3 entegrasyon lisansı
    gmp3_terminal_id VARCHAR(50),
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    -- Ana cihaz mı
    last_sync_at TIMESTAMPTZ,
    last_z_report_at TIMESTAMPTZ,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_tenant_serial UNIQUE (tenant_id, serial_number)
);
-- Indexes
CREATE INDEX idx_pos_devices_tenant ON pos_devices(tenant_id);
CREATE INDEX idx_pos_devices_active ON pos_devices(tenant_id, is_active);
-- =====================================================
-- PART 2: CALLER ID SETTINGS & INCOMING CALLS
-- =====================================================
CREATE TABLE IF NOT EXISTS caller_id_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    -- Provider Settings
    provider VARCHAR(50) NOT NULL DEFAULT 'telsam',
    -- 'telsam', 'netgsm', 'mobile_app'
    -- API Credentials
    api_username TEXT,
    api_password TEXT,
    api_key TEXT,
    webhook_secret TEXT DEFAULT gen_random_uuid()::TEXT,
    -- Phone Lines (JSONB array of connected lines)
    phone_lines JSONB DEFAULT '[]'::JSONB,
    -- Example: [{"number": "+905551234567", "name": "Ana Hat", "type": "voip"}]
    -- Settings
    is_active BOOLEAN DEFAULT true,
    auto_popup BOOLEAN DEFAULT true,
    auto_create_customer BOOLEAN DEFAULT true,
    popup_duration_seconds INTEGER DEFAULT 30,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS incoming_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- Call Info
    caller_phone VARCHAR(20) NOT NULL,
    line_number VARCHAR(20),
    -- Hangi hattan geldi
    call_time TIMESTAMPTZ DEFAULT now(),
    call_duration INTEGER,
    -- Saniye
    call_status VARCHAR(20) DEFAULT 'ringing',
    -- 'ringing', 'answered', 'missed', 'rejected'
    -- Customer Match
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(255),
    customer_address TEXT,
    is_new_customer BOOLEAN DEFAULT false,
    -- Action Taken
    handled BOOLEAN DEFAULT false,
    handled_by UUID,
    -- Hangi kullanıcı cevapladı
    handled_at TIMESTAMPTZ,
    created_order_id UUID,
    -- Oluşturulan sipariş
    notes TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Indexes
CREATE INDEX idx_incoming_calls_tenant ON incoming_calls(tenant_id);
CREATE INDEX idx_incoming_calls_phone ON incoming_calls(caller_phone);
CREATE INDEX idx_incoming_calls_time ON incoming_calls(tenant_id, call_time DESC);
CREATE INDEX idx_incoming_calls_unhandled ON incoming_calls(tenant_id, handled)
WHERE handled = false;
-- =====================================================
-- PART 3: SMS SETTINGS, TEMPLATES & LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    -- Provider
    provider VARCHAR(50) DEFAULT 'netgsm',
    -- 'netgsm', 'iletimerkezi', 'twilio'
    -- Netgsm Credentials
    api_username TEXT NOT NULL,
    api_password TEXT NOT NULL,
    sender_title VARCHAR(11),
    -- SMS başlığı (max 11 karakter)
    -- Balance Tracking
    sms_balance INTEGER DEFAULT 0,
    last_balance_check TIMESTAMPTZ,
    -- Auto SMS Settings
    is_active BOOLEAN DEFAULT true,
    auto_order_received BOOLEAN DEFAULT true,
    auto_order_preparing BOOLEAN DEFAULT false,
    auto_order_on_way BOOLEAN DEFAULT true,
    auto_order_delivered BOOLEAN DEFAULT true,
    auto_order_cancelled BOOLEAN DEFAULT false,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- Template Info
    name VARCHAR(100) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    -- Triggers: 'order_received', 'order_preparing', 'order_on_way', 
    -- 'order_delivered', 'order_cancelled', 'campaign', 'custom'
    -- Template Content (supports variables: {name}, {order_no}, {eta}, {total}, {address})
    template_text TEXT NOT NULL,
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_tenant_trigger UNIQUE (tenant_id, trigger_type, is_default)
);
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- Recipient
    phone VARCHAR(20) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    order_id UUID,
    -- İlişkili sipariş
    -- Message
    message TEXT NOT NULL,
    template_id UUID REFERENCES sms_templates(id),
    trigger_type VARCHAR(50),
    -- Provider Response
    status VARCHAR(20) DEFAULT 'pending',
    -- 'pending', 'sent', 'delivered', 'failed'
    provider_message_id TEXT,
    provider_response TEXT,
    error_message TEXT,
    -- Cost Tracking
    sms_count INTEGER DEFAULT 1,
    -- Kaç SMS harcandı (uzun mesajlar için)
    -- Metadata
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Indexes
CREATE INDEX idx_sms_logs_tenant ON sms_logs(tenant_id);
CREATE INDEX idx_sms_logs_phone ON sms_logs(phone);
CREATE INDEX idx_sms_logs_status ON sms_logs(tenant_id, status);
CREATE INDEX idx_sms_logs_created ON sms_logs(tenant_id, created_at DESC);
-- =====================================================
-- PART 4: DEFAULT SMS TEMPLATES
-- =====================================================
-- Function to create default templates for new tenants
CREATE OR REPLACE FUNCTION create_default_sms_templates() RETURNS TRIGGER AS $$ BEGIN -- Sipariş Alındı
INSERT INTO sms_templates (
        tenant_id,
        name,
        trigger_type,
        template_text,
        is_default
    )
VALUES (
        NEW.tenant_id,
        'Sipariş Alındı',
        'order_received',
        'Sayın {name}, siparişiniz alındı. Sipariş No: #{order_no}. Toplam: {total} TL. Afiyet olsun!',
        true
    );
-- Hazırlanıyor
INSERT INTO sms_templates (
        tenant_id,
        name,
        trigger_type,
        template_text,
        is_default
    )
VALUES (
        NEW.tenant_id,
        'Hazırlanıyor',
        'order_preparing',
        'Siparişiniz hazırlanmaya başlandı 🍳 Tahmini süre: {eta} dakika.',
        true
    );
-- Kuryede
INSERT INTO sms_templates (
        tenant_id,
        name,
        trigger_type,
        template_text,
        is_default
    )
VALUES (
        NEW.tenant_id,
        'Kuryede',
        'order_on_way',
        'Siparişiniz yola çıktı! 🛵 Kuryemiz yaklaşık {eta} dakika içinde kapınızda olacak.',
        true
    );
-- Teslim Edildi
INSERT INTO sms_templates (
        tenant_id,
        name,
        trigger_type,
        template_text,
        is_default
    )
VALUES (
        NEW.tenant_id,
        'Teslim Edildi',
        'order_delivered',
        'Siparişiniz teslim edildi. Afiyet olsun! ⭐ Bizi değerlendirmeyi unutmayın.',
        true
    );
-- İptal
INSERT INTO sms_templates (
        tenant_id,
        name,
        trigger_type,
        template_text,
        is_default
    )
VALUES (
        NEW.tenant_id,
        'İptal Edildi',
        'order_cancelled',
        'Siparişiniz iptal edildi. Detaylı bilgi için bizi arayabilirsiniz.',
        true
    );
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger: When sms_settings is created, create default templates
CREATE TRIGGER trigger_create_default_sms_templates
AFTER
INSERT ON sms_settings FOR EACH ROW EXECUTE FUNCTION create_default_sms_templates();
-- =====================================================
-- PART 5: MENU IMAGE SUPPORT (for visual POS menu)
-- =====================================================
-- Add image_url column to menu table if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'menu'
        AND column_name = 'image_url'
) THEN
ALTER TABLE menu
ADD COLUMN image_url TEXT;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'menu'
        AND column_name = 'thumbnail_url'
) THEN
ALTER TABLE menu
ADD COLUMN thumbnail_url TEXT;
END IF;
END $$;
-- =====================================================
-- PART 6: RLS POLICIES
-- =====================================================
-- Enable RLS
ALTER TABLE pos_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE caller_id_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
-- POS Devices Policies
CREATE POLICY "Tenants can view own devices" ON pos_devices FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage own devices" ON pos_devices FOR ALL USING (tenant_id = auth.uid());
-- Caller ID Policies
CREATE POLICY "Tenants can view own caller settings" ON caller_id_settings FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage own caller settings" ON caller_id_settings FOR ALL USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can view own calls" ON incoming_calls FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage own calls" ON incoming_calls FOR ALL USING (tenant_id = auth.uid());
-- SMS Policies
CREATE POLICY "Tenants can view own sms settings" ON sms_settings FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage own sms settings" ON sms_settings FOR ALL USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can view own templates" ON sms_templates FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can manage own templates" ON sms_templates FOR ALL USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can view own sms logs" ON sms_logs FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can insert sms logs" ON sms_logs FOR
INSERT WITH CHECK (tenant_id = auth.uid());
-- =====================================================
-- PART 7: REALTIME SUBSCRIPTIONS
-- =====================================================
-- Enable realtime for incoming calls (for popup notifications)
ALTER PUBLICATION supabase_realtime
ADD TABLE incoming_calls;
-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================