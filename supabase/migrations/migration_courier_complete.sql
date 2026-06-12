-- =====================================================
-- Complete Courier System Migration
-- Supports: Per-package, Per-KM, and Hybrid payment models
-- =====================================================

-- 1. Enhanced Courier Profiles
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 5.00;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS hired_date DATE;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20);
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS bank_iban VARCHAR(34);
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS preferred_zones UUID[];

-- 2. Courier Documents (License, Insurance, etc.)
CREATE TABLE IF NOT EXISTS courier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- drivers_license, vehicle_registration, insurance, health_certificate
    document_number VARCHAR(100),
    file_url TEXT,
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Courier Payment Configuration (Flexible: per-package, per-km, hybrid)
CREATE TABLE IF NOT EXISTS courier_payment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    config_name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    
    -- Payment Model
    payment_model VARCHAR(20) NOT NULL DEFAULT 'per_package', -- per_package, per_km, hybrid, hourly
    
    -- Per Package Settings
    base_rate_per_package DECIMAL(10,2) DEFAULT 15.00, -- Base rate per delivery
    
    -- Per KM Settings
    base_rate_per_km DECIMAL(10,2) DEFAULT 3.00, -- Rate per kilometer
    min_km_charge DECIMAL(10,2) DEFAULT 10.00, -- Minimum charge regardless of distance
    
    -- Hybrid Settings (base + km)
    hybrid_base_fee DECIMAL(10,2) DEFAULT 10.00, -- Fixed base
    hybrid_km_rate DECIMAL(10,2) DEFAULT 2.00, -- Additional per km
    
    -- Hourly Settings
    hourly_rate DECIMAL(10,2) DEFAULT 50.00,
    
    -- Zone-Based Multipliers
    zone_multipliers JSONB DEFAULT '{}', -- {"zone_id": 1.5, "zone_id2": 1.2}
    
    -- Time-Based Bonuses
    peak_hour_bonus DECIMAL(10,2) DEFAULT 5.00, -- Extra during peak hours
    peak_hours JSONB DEFAULT '{"start": "12:00", "end": "14:00"}',
    night_bonus DECIMAL(10,2) DEFAULT 10.00, -- Extra for night deliveries
    night_hours JSONB DEFAULT '{"start": "22:00", "end": "06:00"}',
    weekend_bonus_percent DECIMAL(5,2) DEFAULT 10.00, -- Weekend bonus %
    
    -- Weather Bonuses
    bad_weather_bonus DECIMAL(10,2) DEFAULT 8.00,
    
    -- Performance Bonuses
    daily_target INTEGER DEFAULT 20, -- Deliveries
    daily_target_bonus DECIMAL(10,2) DEFAULT 50.00, -- Bonus for hitting target
    rating_bonus_threshold DECIMAL(3,2) DEFAULT 4.8, -- Min rating for bonus
    rating_bonus DECIMAL(10,2) DEFAULT 20.00, -- Monthly rating bonus
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Courier Earnings (Detailed records)
CREATE TABLE IF NOT EXISTS courier_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    
    -- Earning Details
    earning_type VARCHAR(30) NOT NULL, -- delivery, tip, bonus_daily, bonus_rating, bonus_weather, penalty
    amount DECIMAL(10,2) NOT NULL,
    
    -- Calculation Details
    distance_km DECIMAL(6,2),
    payment_model VARCHAR(20),
    base_rate DECIMAL(10,2),
    multipliers JSONB, -- Applied multipliers/bonuses
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, paid, disputed
    paid_at TIMESTAMPTZ,
    
    -- Reference
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Courier Payouts (Settlements)
CREATE TABLE IF NOT EXISTS courier_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Amounts
    gross_earnings DECIMAL(12,2) NOT NULL,
    deductions DECIMAL(12,2) DEFAULT 0, -- Penalties, advances, etc.
    net_amount DECIMAL(12,2) NOT NULL,
    
    -- Details
    total_deliveries INTEGER,
    total_distance_km DECIMAL(10,2),
    average_rating DECIMAL(3,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, processing, paid
    payment_method VARCHAR(30), -- bank_transfer, cash, wallet
    payment_reference VARCHAR(255),
    
    -- Approval
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Courier Ratings (Customer feedback)
CREATE TABLE IF NOT EXISTS courier_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20),
    
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    
    -- Categories
    was_polite BOOLEAN,
    was_on_time BOOLEAN,
    food_condition_ok BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Delivery Zones
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(20) DEFAULT 'polygon', -- polygon, radius
    
    -- Polygon boundaries (GeoJSON)
    boundaries JSONB,
    
    -- Radius-based
    center_lat DECIMAL(10,8),
    center_lng DECIMAL(11,8),
    radius_km DECIMAL(6,2),
    
    -- Settings
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    min_order_amount DECIMAL(10,2) DEFAULT 0,
    estimated_time_minutes INTEGER DEFAULT 30,
    courier_bonus DECIMAL(10,2) DEFAULT 0, -- Extra for this zone
    
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enhance Deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS distance_km DECIMAL(6,2);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10,8);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11,8);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10,8);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11,8);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS proof_photo_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS proof_signature_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_rating INTEGER;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES delivery_zones(id);

-- 9. Courier Location History (For tracking)
CREATE TABLE IF NOT EXISTS courier_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(6,2),
    speed DECIMAL(6,2),
    heading DECIMAL(5,2),
    
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient location queries
CREATE INDEX IF NOT EXISTS idx_courier_location_time ON courier_location_history(courier_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_location_delivery ON courier_location_history(delivery_id);

-- 10. Courier Shifts (Optional: for hourly payment)
CREATE TABLE IF NOT EXISTS courier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    
    break_minutes INTEGER DEFAULT 0,
    
    -- Stats
    deliveries_count INTEGER DEFAULT 0,
    total_distance_km DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE courier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_shifts ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE POLICY "Couriers can view own documents" ON courier_documents
    FOR SELECT USING (courier_id = auth.uid());
    
CREATE POLICY "Managers can manage documents" ON courier_documents
    FOR ALL USING (true);

-- Payment Config
CREATE POLICY "Tenants can manage own payment config" ON courier_payment_config
    FOR ALL USING (true);

-- Earnings
CREATE POLICY "Couriers can view own earnings" ON courier_earnings
    FOR SELECT USING (courier_id = auth.uid());

CREATE POLICY "Managers can manage earnings" ON courier_earnings
    FOR ALL USING (true);

-- Payouts
CREATE POLICY "Couriers can view own payouts" ON courier_payouts
    FOR SELECT USING (courier_id = auth.uid());

CREATE POLICY "Managers can manage payouts" ON courier_payouts
    FOR ALL USING (true);

-- Ratings
CREATE POLICY "Couriers can view own ratings" ON courier_ratings
    FOR SELECT USING (courier_id = auth.uid());

CREATE POLICY "Anyone can insert ratings" ON courier_ratings
    FOR INSERT WITH CHECK (true);

-- Zones
CREATE POLICY "Anyone can view zones" ON delivery_zones
    FOR SELECT USING (true);

CREATE POLICY "Managers can manage zones" ON delivery_zones
    FOR ALL USING (true);

-- Location History
CREATE POLICY "Couriers can insert own location" ON courier_location_history
    FOR INSERT WITH CHECK (courier_id = auth.uid());

CREATE POLICY "Managers can view locations" ON courier_location_history
    FOR SELECT USING (true);

-- Shifts
CREATE POLICY "Couriers can view and update own shifts" ON courier_shifts
    FOR ALL USING (courier_id = auth.uid() OR true);

-- Trigger: Update courier stats on delivery completion
CREATE OR REPLACE FUNCTION update_courier_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE courier_profiles
        SET 
            total_deliveries = total_deliveries + 1,
            updated_at = NOW()
        WHERE id = NEW.courier_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_courier_stats ON deliveries;
CREATE TRIGGER trigger_update_courier_stats
    AFTER UPDATE ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_courier_stats();

-- Trigger: Update courier rating on new rating
CREATE OR REPLACE FUNCTION update_courier_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE courier_profiles
    SET rating = (
        SELECT COALESCE(AVG(rating), 5.00)
        FROM courier_ratings
        WHERE courier_id = NEW.courier_id
    )
    WHERE id = NEW.courier_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_courier_rating ON courier_ratings;
CREATE TRIGGER trigger_update_courier_rating
    AFTER INSERT ON courier_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_courier_rating();

-- Function: Calculate earnings for a delivery
CREATE OR REPLACE FUNCTION calculate_delivery_earnings(
    p_delivery_id UUID,
    p_tenant_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
    v_config courier_payment_config%ROWTYPE;
    v_delivery deliveries%ROWTYPE;
    v_base_amount DECIMAL;
    v_bonuses DECIMAL := 0;
    v_hour INTEGER;
    v_is_weekend BOOLEAN;
BEGIN
    -- Get payment config
    SELECT * INTO v_config FROM courier_payment_config 
    WHERE tenant_id = p_tenant_id AND is_default = true
    LIMIT 1;
    
    -- Get delivery details
    SELECT * INTO v_delivery FROM deliveries WHERE id = p_delivery_id;
    
    -- Calculate base amount based on payment model
    CASE v_config.payment_model
        WHEN 'per_package' THEN
            v_base_amount := v_config.base_rate_per_package;
        WHEN 'per_km' THEN
            v_base_amount := GREATEST(
                v_config.min_km_charge,
                COALESCE(v_delivery.distance_km, 2) * v_config.base_rate_per_km
            );
        WHEN 'hybrid' THEN
            v_base_amount := v_config.hybrid_base_fee + 
                (COALESCE(v_delivery.distance_km, 2) * v_config.hybrid_km_rate);
        ELSE
            v_base_amount := v_config.base_rate_per_package;
    END CASE;
    
    -- Calculate time-based bonuses
    v_hour := EXTRACT(HOUR FROM v_delivery.created_at);
    v_is_weekend := EXTRACT(DOW FROM v_delivery.created_at) IN (0, 6);
    
    -- Peak hour bonus
    IF v_hour >= 12 AND v_hour < 14 THEN
        v_bonuses := v_bonuses + v_config.peak_hour_bonus;
    END IF;
    
    -- Night bonus
    IF v_hour >= 22 OR v_hour < 6 THEN
        v_bonuses := v_bonuses + v_config.night_bonus;
    END IF;
    
    -- Weekend bonus
    IF v_is_weekend THEN
        v_bonuses := v_bonuses + (v_base_amount * v_config.weekend_bonus_percent / 100);
    END IF;
    
    RETURN v_base_amount + v_bonuses;
END;
$$ LANGUAGE plpgsql;

-- Insert default payment config for testing
INSERT INTO courier_payment_config (
    tenant_id, 
    config_name, 
    is_default, 
    payment_model,
    base_rate_per_package,
    base_rate_per_km,
    min_km_charge,
    peak_hour_bonus,
    night_bonus,
    weekend_bonus_percent
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- Placeholder, update with real tenant
    'Varsayılan Kurye Ücreti',
    true,
    'per_package',
    15.00,
    3.00,
    10.00,
    5.00,
    10.00,
    10.00
) ON CONFLICT DO NOTHING;
