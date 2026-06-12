-- =====================================================
-- External Courier Providers Migration
-- Supports: Paketaxi, Maxijet, Getir Kurye, Banabi
-- =====================================================

-- External Courier Providers Configuration
CREATE TABLE IF NOT EXISTS external_courier_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    provider_code VARCHAR(30) NOT NULL, -- paketaxi, maxijet, getir, banabi
    provider_name VARCHAR(100) NOT NULL,
    
    -- Status
    is_enabled BOOLEAN DEFAULT false,
    is_sandbox BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority = preferred
    
    -- API Configuration
    api_key VARCHAR(255),
    api_secret VARCHAR(255),
    merchant_id VARCHAR(100),
    webhook_secret VARCHAR(255),
    
    -- Webhook URLs (auto-generated)
    webhook_url TEXT,
    callback_url TEXT,
    
    -- Pricing
    base_fee DECIMAL(10,2) DEFAULT 0,
    per_km_rate DECIMAL(10,2) DEFAULT 0,
    min_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Service Area
    service_areas JSONB DEFAULT '[]', -- List of supported districts/areas
    max_distance_km DECIMAL(6,2) DEFAULT 10,
    
    -- Operating Hours
    operating_hours JSONB DEFAULT '{"start": "09:00", "end": "23:00"}',
    operating_days JSONB DEFAULT '[1,2,3,4,5,6,0]', -- 0=Sunday, 1=Monday...
    
    -- Stats
    total_orders INTEGER DEFAULT 0,
    average_delivery_time INTEGER, -- minutes
    average_rating DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, provider_code)
);

-- External Courier Orders
CREATE TABLE IF NOT EXISTS external_courier_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider_id UUID REFERENCES external_courier_providers(id) ON DELETE SET NULL,
    
    -- Internal Reference
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    order_id UUID, -- pos_orders reference
    
    -- Provider Reference
    provider_code VARCHAR(30) NOT NULL,
    provider_order_id VARCHAR(255), -- External order ID from provider
    provider_tracking_id VARCHAR(255),
    provider_tracking_url TEXT,
    
    -- Status
    status VARCHAR(30) DEFAULT 'pending', 
    -- pending, requested, accepted, courier_assigned, picked_up, in_transit, delivered, cancelled, failed
    
    -- Courier Info (from provider)
    courier_name VARCHAR(255),
    courier_phone VARCHAR(20),
    courier_photo_url TEXT,
    courier_vehicle VARCHAR(50),
    courier_plate VARCHAR(20),
    
    -- Location Tracking
    courier_lat DECIMAL(10,8),
    courier_lng DECIMAL(11,8),
    last_location_update TIMESTAMPTZ,
    
    -- Pricing
    estimated_fee DECIMAL(10,2),
    actual_fee DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'TRY',
    
    -- Timing
    estimated_pickup_time TIMESTAMPTZ,
    actual_pickup_time TIMESTAMPTZ,
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    
    -- Addresses
    pickup_address TEXT,
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    pickup_phone VARCHAR(20),
    pickup_notes TEXT,
    
    delivery_address TEXT,
    delivery_lat DECIMAL(10,8),
    delivery_lng DECIMAL(11,8),
    delivery_phone VARCHAR(20),
    delivery_notes TEXT,
    
    -- Order Details
    package_description TEXT,
    package_weight DECIMAL(6,2),
    package_size VARCHAR(20), -- small, medium, large
    is_fragile BOOLEAN DEFAULT false,
    is_food BOOLEAN DEFAULT true,
    
    -- Proof of Delivery
    delivery_proof_url TEXT,
    signature_url TEXT,
    recipient_name VARCHAR(255),
    
    -- Error Handling
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Metadata
    raw_request JSONB,
    raw_response JSONB,
    webhook_events JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider Webhook Events Log
CREATE TABLE IF NOT EXISTS external_courier_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    provider_code VARCHAR(30),
    external_order_id UUID REFERENCES external_courier_orders(id) ON DELETE SET NULL,
    
    event_type VARCHAR(50),
    payload JSONB,
    signature VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    
    processed BOOLEAN DEFAULT false,
    process_error TEXT,
    
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider Price Quotes (for comparison)
CREATE TABLE IF NOT EXISTS external_courier_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID, -- Reference to pos_orders
    
    -- Pickup/Delivery
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    delivery_lat DECIMAL(10,8),
    delivery_lng DECIMAL(11,8),
    distance_km DECIMAL(6,2),
    
    -- Quotes from each provider
    quotes JSONB NOT NULL, 
    -- [{"provider": "paketaxi", "fee": 25, "eta_minutes": 35, "available": true}, ...]
    
    -- Selected Provider
    selected_provider VARCHAR(30),
    selected_fee DECIMAL(10,2),
    
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ext_courier_providers_tenant ON external_courier_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ext_courier_orders_tenant ON external_courier_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ext_courier_orders_status ON external_courier_orders(status);
CREATE INDEX IF NOT EXISTS idx_ext_courier_orders_provider ON external_courier_orders(provider_code);
CREATE INDEX IF NOT EXISTS idx_ext_courier_webhook_provider ON external_courier_webhook_logs(provider_code);

-- RLS Policies
ALTER TABLE external_courier_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_courier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_courier_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_courier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own providers" ON external_courier_providers
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can manage own external orders" ON external_courier_orders
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can view own webhook logs" ON external_courier_webhook_logs
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Anyone can insert webhook logs" ON external_courier_webhook_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Tenants can manage own quotes" ON external_courier_quotes
    FOR ALL USING (tenant_id = auth.uid());

-- Trigger: Update provider stats on order completion
CREATE OR REPLACE FUNCTION update_external_provider_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE external_courier_providers
        SET 
            total_orders = total_orders + 1,
            average_delivery_time = (
                SELECT COALESCE(AVG(
                    EXTRACT(EPOCH FROM (actual_delivery_time - created_at)) / 60
                ), average_delivery_time)
                FROM external_courier_orders
                WHERE provider_id = NEW.provider_id AND status = 'delivered'
            ),
            updated_at = NOW()
        WHERE id = NEW.provider_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ext_provider_stats ON external_courier_orders;
CREATE TRIGGER trigger_update_ext_provider_stats
    AFTER UPDATE ON external_courier_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_external_provider_stats();

-- Insert default provider templates
INSERT INTO external_courier_providers (tenant_id, provider_code, provider_name, is_enabled, priority)
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'paketaxi', 'Paketaxi', false, 1),
    ('00000000-0000-0000-0000-000000000000', 'maxijet', 'Maxijet', false, 2),
    ('00000000-0000-0000-0000-000000000000', 'getir', 'Getir Kurye', false, 3)
ON CONFLICT DO NOTHING;
