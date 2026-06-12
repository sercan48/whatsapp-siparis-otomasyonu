-- =====================================================
-- Invitation System Migration
-- Handles Staff and Courier Invitations securely
-- =====================================================
-- 1. Create Invitations Table
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    -- 'admin', 'waiter', 'kitchen', 'courier'
    status VARCHAR(20) DEFAULT 'pending',
    -- 'pending', 'accepted', 'expired'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    -- Prevent duplicate pending invites for same email+tenant
    UNIQUE(tenant_id, email)
);
-- 2. RLS for Invitations
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can manage their own invitations" ON tenant_invitations FOR ALL USING (
    tenant_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.tenant_id = tenant_invitations.tenant_id
    )
);
-- 3. Secure Function to Add/Invite User
-- This function runs with SECURITY DEFINER privileges to look up users by email
-- regardless of RLS policies on the profiles/users table.
CREATE OR REPLACE FUNCTION add_staff_or_courier(
        p_email VARCHAR(255),
        p_role VARCHAR(50),
        p_tenant_id UUID
    ) RETURNS JSONB AS $$
DECLARE v_user_id UUID;
v_profile_exists BOOLEAN;
v_current_role VARCHAR;
v_result JSONB;
BEGIN -- 1. Check if user exists in profiles (linked to auth.users)
SELECT id,
    role INTO v_user_id,
    v_current_role
FROM profiles
WHERE email = p_email
LIMIT 1;
IF v_user_id IS NOT NULL THEN -- User EXISTS in the system
IF p_role = 'courier' THEN -- Link as Courier (Many-to-Many)
INSERT INTO courier_store_links (courier_id, tenant_id, is_active)
VALUES (v_user_id, p_tenant_id, true) ON CONFLICT (courier_id, tenant_id) DO NOTHING;
-- Ensure they have a courier profile entry if not exists (auto-create empty)
INSERT INTO courier_profiles (id, status)
VALUES (v_user_id, 'offline') ON CONFLICT (id) DO NOTHING;
v_result := jsonb_build_object(
    'status',
    'linked',
    'message',
    'Kullanıcı kurye olarak mağazaya bağlandı.'
);
ELSE -- Link as Staff (One-to-One / Primary Tenant)
-- WARNING: This overwrites their existing tenant! 
-- Ideal logic might prompt confirmation, but for MVP we overwrite if they are mostly single-tenant employees.
UPDATE profiles
SET tenant_id = p_tenant_id,
    role = p_role
WHERE id = v_user_id;
v_result := jsonb_build_object(
    'status',
    'linked',
    'message',
    'Kullanıcı personel olarak eklendi.'
);
END IF;
ELSE -- User does NOT exist -> Create Invitation
INSERT INTO tenant_invitations (tenant_id, email, role, status)
VALUES (p_tenant_id, p_email, p_role, 'pending') ON CONFLICT (tenant_id, email) DO
UPDATE
SET role = EXCLUDED.role,
    status = 'pending',
    created_at = NOW();
v_result := jsonb_build_object(
    'status',
    'invited',
    'message',
    'Kullanıcı bulunamadı, davet gönderildi.'
);
END IF;
RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;