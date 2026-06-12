-- Tenant Configuration Table for Multi-Tenant N8N Support
-- Stores WhatsApp API credentials and other tenant-specific settings

CREATE TABLE IF NOT EXISTS tenant_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    
    -- WhatsApp Business API Configuration
    whatsapp_api_token TEXT,
    whatsapp_phone_number_id TEXT,
    whatsapp_business_account_id TEXT,
    whatsapp_webhook_verify_token TEXT,
    
    -- Business Information
    business_name TEXT,
    business_phone TEXT,
    business_address TEXT,
    
    -- WhatsApp Bot Configuration
    welcome_message TEXT DEFAULT 'Merhaba! Siparişinizi almak için hazırım. Lütfen menüyü inceleyip seçiminizi yapın.',
    order_confirmation_message TEXT DEFAULT 'Siparişiniz alındı! Hazır olduğunda size haber vereceğiz.',
    delivery_message TEXT DEFAULT 'Siparişiniz yola çıktı! Afiyet olsun.',
    
    -- Integration Settings
    n8n_webhook_url TEXT, -- Tenant-specific webhook if needed
    pos_integration_enabled BOOLEAN DEFAULT false,
    delivery_integration_enabled BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_tenant_configs_tenant ON tenant_configs(tenant_id);

-- Enable RLS
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Only the tenant can access their own config
CREATE POLICY "Tenant access own config" ON tenant_configs
    FOR ALL USING (tenant_id = auth.uid());

-- Policy: Super admin can access all configs (for management)
CREATE POLICY "Super admin access all configs" ON tenant_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Grant permissions
GRANT ALL ON tenant_configs TO authenticated;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tenant_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_config_updated
    BEFORE UPDATE ON tenant_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_config_timestamp();

COMMENT ON TABLE tenant_configs IS 'Stores tenant-specific configuration for WhatsApp API and N8N workflows';
