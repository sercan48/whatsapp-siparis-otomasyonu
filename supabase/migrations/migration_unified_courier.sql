-- =====================================================
-- Unified Courier App Migration (Multi-Tenant Support)
-- =====================================================
-- 1. Create Courier-Store Links Table
-- This table allows a single courier profile to be associated with multiple tenants (restaurants)
CREATE TABLE IF NOT EXISTS courier_store_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID REFERENCES courier_profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- Permissions / Settings for this specific link
    is_active BOOLEAN DEFAULT true,
    can_auto_assign BOOLEAN DEFAULT false,
    can_view_pool BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent duplicate links
    UNIQUE(courier_id, tenant_id)
);
-- 2. Enable RLS
ALTER TABLE courier_store_links ENABLE ROW LEVEL SECURITY;
-- 3. RLS Policies for courier_store_links
-- Couriers can view their own links
CREATE POLICY "Couriers can view own store links" ON courier_store_links FOR
SELECT USING (courier_id = auth.uid());
-- Tenants can manage their own links
CREATE POLICY "Tenants can manage their courier links" ON courier_store_links FOR ALL USING (
    tenant_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.tenant_id = courier_store_links.tenant_id
    )
);
-- 4. Update RLS Policies for Orders/Deliveries to allow Multi-Tenant Access
-- Helper function to check if user is a linked courier for the tenant
CREATE OR REPLACE FUNCTION is_linked_courier(fees_tenant_id UUID) RETURNS BOOLEAN AS $$ BEGIN RETURN EXISTS (
        SELECT 1
        FROM courier_store_links
        WHERE courier_id = auth.uid()
            AND tenant_id = fees_tenant_id
            AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Policy for Deliveries: Linked couriers can view deliveries for their linked tenants
CREATE POLICY "Linked couriers can view tenant deliveries" ON deliveries FOR
SELECT USING (is_linked_courier(tenant_id));
-- Policy for POS Orders: Linked couriers can view active orders (for pool logic)
-- Assuming 'pos_orders' or 'pos_order_items' needs to be visible
CREATE POLICY "Linked couriers can view tenant pos orders" ON pos_orders FOR
SELECT USING (
        is_linked_courier(tenant_id)
        AND status IN ('ready', 'preparing') -- Only show relevant orders
    );
-- Policy for External Platform Orders
CREATE POLICY "Linked couriers can view tenant platform orders" ON external_platform_orders FOR
SELECT USING (
        is_linked_courier(tenant_id)
        AND status IN ('ready', 'preparing', 'awaiting_courier')
    );
-- 5. Add Indices for Performance
CREATE INDEX IF NOT EXISTS idx_courier_links_courier ON courier_store_links(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_links_tenant ON courier_store_links(tenant_id);