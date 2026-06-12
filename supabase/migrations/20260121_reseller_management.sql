-- =====================================================
-- RESELLER TENANT MANAGEMENT
-- Allow resellers to update their tenants' branding/settings
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_tenant_branding_by_reseller(
        p_reseller_id UUID,
        p_tenant_id UUID,
        p_branding JSONB,
        p_menu_settings JSONB,
        p_store_settings JSONB,
        p_slug TEXT
    ) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN -- 1. Verify that the tenant belongs to the reseller
    IF NOT EXISTS (
        SELECT 1
        FROM public.tenants
        WHERE id = p_tenant_id
            AND reseller_id = p_reseller_id
    ) THEN RAISE EXCEPTION 'Unauthorized: Tenant does not belong to this reseller';
END IF;
-- 2. Update the profile linked to the tenant
-- We assume 1:1 relationship where profiles.tenant_id = p_tenant_id
-- OR profiles.id = p_tenant_id (depending on schema, looking at code seems profiles.tenant_id is used or mixed)
-- SlugMenuPage says: .eq('id', profile.tenant_id || profile.id)
-- BrandingSettings updates profiles eq('id', tenantId). 
-- Let's try to update profiles where id = p_tenant_id OR tenant_id = p_tenant_id
UPDATE public.profiles
SET branding = p_branding,
    menu_settings = p_menu_settings,
    store_settings = p_store_settings,
    slug = p_slug
WHERE id = p_tenant_id
    OR tenant_id = p_tenant_id;
-- Also update tenant slug if it exists there
UPDATE public.tenants
SET slug = p_slug
WHERE id = p_tenant_id;
END;
$$;