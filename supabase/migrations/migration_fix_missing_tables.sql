-- =====================================================
-- FIX MIGRATION: Ensure Courier Tables Exist
-- =====================================================
-- 1. Create Courier-Store Links Table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS courier_store_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    can_auto_assign BOOLEAN DEFAULT false,
    can_view_pool BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(courier_id, tenant_id)
);
-- 2. Enable RLS
ALTER TABLE courier_store_links ENABLE ROW LEVEL SECURITY;
-- 3. RLS Policies
DROP POLICY IF EXISTS "Couriers can view own store links" ON courier_store_links;
CREATE POLICY "Couriers can view own store links" ON courier_store_links FOR
SELECT USING (courier_id = auth.uid());
DROP POLICY IF EXISTS "Tenants can manage their courier links" ON courier_store_links;
CREATE POLICY "Tenants can manage their courier links" ON courier_store_links FOR ALL USING (
    tenant_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.tenant_id = courier_store_links.tenant_id
    )
);
-- 4. Helper Function
CREATE OR REPLACE FUNCTION is_linked_courier(fees_tenant_id UUID) RETURNS BOOLEAN AS $$ BEGIN RETURN EXISTS (
        SELECT 1
        FROM courier_store_links
        WHERE courier_id = auth.uid()
            AND tenant_id = fees_tenant_id
            AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 5. Update RLS for Orders (Safety check)
DROP POLICY IF EXISTS "Linked couriers can view tenant deliveries" ON deliveries;
CREATE POLICY "Linked couriers can view tenant deliveries" ON deliveries FOR
SELECT USING (is_linked_courier(tenant_id));
-- 6. Indices
CREATE INDEX IF NOT EXISTS idx_courier_links_courier ON courier_store_links(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_links_tenant ON courier_store_links(tenant_id);