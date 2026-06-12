-- =====================================================
-- FIX: Restaurant Name Sync
-- Date: 2026-01-21
-- Purpose: Ensure profiles table has restaurant name and it is synced
-- =====================================================
-- 1. Add company_name to profiles if not exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
        AND column_name = 'company_name'
) THEN
ALTER TABLE public.profiles
ADD COLUMN company_name TEXT;
END IF;
END $$;
-- 2. Sync name from tenants table to profiles
UPDATE public.profiles p
SET company_name = t.name
FROM public.tenants t
WHERE p.id = t.id
    AND (
        p.company_name IS NULL
        OR p.company_name = 'Restoran'
    );
-- 3. Trigger to keep them in sync (Optional but recommended)
CREATE OR REPLACE FUNCTION sync_tenant_name_to_profile() RETURNS TRIGGER AS $$ BEGIN
UPDATE public.profiles
SET company_name = NEW.name
WHERE id = NEW.id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_tenant_name ON public.tenants;
CREATE TRIGGER trg_sync_tenant_name
AFTER
UPDATE OF name ON public.tenants FOR EACH ROW EXECUTE FUNCTION sync_tenant_name_to_profile();