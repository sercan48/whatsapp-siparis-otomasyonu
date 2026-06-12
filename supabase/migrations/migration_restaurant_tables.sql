-- Restaurant Tables Migration
-- Creates `restaurant_tables` table for QR code management

-- Create restaurant_tables table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    name VARCHAR(100),
    section VARCHAR(100), -- e.g., "Bahçe", "İç Mekan", "Teras"
    capacity INT DEFAULT 4,
    status VARCHAR(20) DEFAULT 'available', -- available, occupied, reserved, cleaning
    is_active BOOLEAN DEFAULT true,
    qr_generated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, table_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_tenant ON restaurant_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(tenant_id, status);

-- Enable RLS
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view their own tables"
    ON restaurant_tables FOR SELECT
    USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can insert their own tables"
    ON restaurant_tables FOR INSERT
    WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants can update their own tables"
    ON restaurant_tables FOR UPDATE
    USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can delete their own tables"
    ON restaurant_tables FOR DELETE
    USING (tenant_id = auth.uid());

-- Function to auto-generate tables
CREATE OR REPLACE FUNCTION generate_default_tables(p_tenant_id UUID, p_count INT DEFAULT 10)
RETURNS VOID AS $$
BEGIN
    FOR i IN 1..p_count LOOP
        INSERT INTO restaurant_tables (tenant_id, table_number, name)
        VALUES (p_tenant_id, i, 'Masa ' || i)
        ON CONFLICT (tenant_id, table_number) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_restaurant_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurant_tables_updated_at
    BEFORE UPDATE ON restaurant_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_restaurant_tables_timestamp();

-- Insert default tables for existing tenants (optional - run manually if needed)
-- SELECT generate_default_tables(id) FROM tenants;
