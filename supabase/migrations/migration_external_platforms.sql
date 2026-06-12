-- =====================================================
-- External Platform Integration Migration
-- Supports: Yemeksepeti, Getir, Hepsiburada Yemek, Trendyol Yemek
-- =====================================================

-- Platform Configurations
CREATE TABLE IF NOT EXISTS external_platform_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    platform_code VARCHAR(30) NOT NULL, -- yemeksepeti, getir, hepsiburada, trendyol
    platform_name VARCHAR(100) NOT NULL,
    
    -- Status
    is_enabled BOOLEAN DEFAULT false,
    is_sandbox BOOLEAN DEFAULT true,
    
    -- API Configuration
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    merchant_id VARCHAR(100),
    restaurant_id VARCHAR(100), -- Platform-specific restaurant ID
    
    -- Webhook URLs
    webhook_url TEXT,
    webhook_secret VARCHAR(255),
    
    -- Sync Settings
    auto_accept_orders BOOLEAN DEFAULT false,
    auto_sync_menu BOOLEAN DEFAULT false,
    sync_inventory BOOLEAN DEFAULT false,
    
    -- Commission & Fees
    commission_rate DECIMAL(5,2) DEFAULT 0, -- Platform commission %
    
    -- Stats
    total_orders INTEGER DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, platform_code)
);

-- External Platform Orders (synchronized from platforms)
CREATE TABLE IF NOT EXISTS external_platform_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    platform_config_id UUID REFERENCES external_platform_configs(id) ON DELETE SET NULL,
    
    -- Platform Reference
    platform_code VARCHAR(30) NOT NULL,
    platform_order_id VARCHAR(255) NOT NULL, -- Order ID from platform
    platform_order_number VARCHAR(100), -- Human-readable order number
    
    -- Internal Reference
    internal_order_id UUID, -- Link to pos_orders if created
    
    -- Order Status
    status VARCHAR(30) DEFAULT 'new',
    -- new, confirmed, preparing, ready, picked_up, delivered, cancelled, rejected
    
    platform_status VARCHAR(50), -- Original status from platform
    
    -- Customer Info
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    customer_note TEXT,
    
    -- Delivery Info
    delivery_type VARCHAR(20) DEFAULT 'delivery', -- delivery, pickup
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    
    -- Courier Info (if platform provides)
    courier_name VARCHAR(255),
    courier_phone VARCHAR(20),
    
    -- Financial
    subtotal DECIMAL(10,2),
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2),
    payment_method VARCHAR(30), -- cash, credit_card, online
    is_paid BOOLEAN DEFAULT false,
    commission_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Order Items
    items JSONB NOT NULL DEFAULT '[]',
    -- [{name, quantity, price, options: [], note}]
    
    -- Raw Data
    raw_order JSONB,
    
    -- Timestamps
    ordered_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    prepared_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Sync Table (for platform menu mapping)
CREATE TABLE IF NOT EXISTS external_menu_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    platform_code VARCHAR(30) NOT NULL,
    
    -- Internal menu item
    menu_item_id UUID NOT NULL,
    
    -- Platform mapping
    platform_item_id VARCHAR(255),
    platform_item_name VARCHAR(255),
    platform_price DECIMAL(10,2),
    
    -- Sync status
    is_synced BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    sync_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Webhook Logs
CREATE TABLE IF NOT EXISTS external_platform_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    platform_code VARCHAR(30),
    
    event_type VARCHAR(50),
    payload JSONB,
    signature VARCHAR(255),
    
    processed BOOLEAN DEFAULT false,
    process_result TEXT,
    
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ext_platform_configs_tenant ON external_platform_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ext_platform_orders_tenant ON external_platform_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ext_platform_orders_platform ON external_platform_orders(platform_code);
CREATE INDEX IF NOT EXISTS idx_ext_platform_orders_status ON external_platform_orders(status);
CREATE INDEX IF NOT EXISTS idx_ext_platform_orders_date ON external_platform_orders(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ext_menu_mappings_item ON external_menu_mappings(menu_item_id);

-- RLS Policies
ALTER TABLE external_platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_platform_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_menu_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_platform_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own platform configs" ON external_platform_configs
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants manage own platform orders" ON external_platform_orders
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants manage own menu mappings" ON external_menu_mappings
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants view own webhooks" ON external_platform_webhooks
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Anyone can insert webhooks" ON external_platform_webhooks
    FOR INSERT WITH CHECK (true);

-- Function to update platform order stats
CREATE OR REPLACE FUNCTION update_platform_order_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE external_platform_configs
        SET 
            total_orders = total_orders + 1,
            updated_at = NOW()
        WHERE id = NEW.platform_config_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_order_stats ON external_platform_orders;
CREATE TRIGGER trigger_platform_order_stats
    AFTER UPDATE ON external_platform_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_platform_order_stats();

-- Insert default platform templates
INSERT INTO external_platform_configs (tenant_id, platform_code, platform_name, is_enabled)
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'yemeksepeti', 'Yemeksepeti', false),
    ('00000000-0000-0000-0000-000000000000', 'getir', 'Getir Yemek', false),
    ('00000000-0000-0000-0000-000000000000', 'hepsiburada', 'Hepsiburada Yemek', false),
    ('00000000-0000-0000-0000-000000000000', 'trendyol', 'Trendyol Yemek', false)
ON CONFLICT DO NOTHING;
