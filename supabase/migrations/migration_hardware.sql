-- =====================================================
-- Hardware Devices Migration
-- Printers & POS Terminals
-- =====================================================

-- Devices table (Printers, POS Terminals, KDS Screens, etc.)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Device Info
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- printer, pos_terminal, kds_screen
    connection_type VARCHAR(50) DEFAULT 'network', -- usb, network, bluetooth
    
    -- Connection Details
    ip_address VARCHAR(50),
    port INTEGER,
    api_key TEXT, -- For POS terminals
    
    -- Settings (JSONB for flexibility)
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);

-- RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own devices" ON devices
    FOR ALL USING (tenant_id = auth.uid());
