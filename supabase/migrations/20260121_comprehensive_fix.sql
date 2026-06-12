-- =====================================================
-- COMPREHENSIVE FIX MIGRATION (V2)
-- Fixes: customer_addresses 404, orders 400, logo upload failure
-- =====================================================
-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 2. Create customer_addresses table (Fixed 404)
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT 'Ev',
    customer_name VARCHAR(100),
    full_address TEXT NOT NULL,
    district VARCHAR(100),
    address_note TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, phone, label)
);
-- RLS for customer_addresses
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can manage own addresses" ON public.customer_addresses;
CREATE POLICY "Public can manage own addresses" ON public.customer_addresses FOR ALL USING (true) WITH CHECK (true);
-- 3. Fix orders table columns (Fixed 400)
DO $$ BEGIN -- final_amount
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'final_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN final_amount DECIMAL(10, 2);
END IF;
-- total_amount
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'total_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN total_amount DECIMAL(10, 2);
END IF;
-- customer_name
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'customer_name'
) THEN
ALTER TABLE public.orders
ADD COLUMN customer_name TEXT;
END IF;
-- customer_phone
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'customer_phone'
) THEN
ALTER TABLE public.orders
ADD COLUMN customer_phone TEXT;
END IF;
-- delivery_address
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'delivery_address'
) THEN
ALTER TABLE public.orders
ADD COLUMN delivery_address TEXT;
END IF;
-- source
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'source'
) THEN
ALTER TABLE public.orders
ADD COLUMN source TEXT DEFAULT 'digital_menu';
END IF;
-- order_source
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'order_source'
) THEN
ALTER TABLE public.orders
ADD COLUMN order_source TEXT DEFAULT 'digital_menu';
END IF;
END $$;
-- 4. Storage configuration (Fix Logo Upload)
-- Create logos bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
-- Storage policies for logos (REALLY permissive for debugging/demo)
DROP POLICY IF EXISTS "Public access to logos" ON storage.objects;
CREATE POLICY "Public access to logos" ON storage.objects FOR
SELECT USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Anyone can upload logos" ON storage.objects;
CREATE POLICY "Anyone can upload logos" ON storage.objects FOR
INSERT WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "Anyone can update logos" ON storage.objects;
CREATE POLICY "Anyone can update logos" ON storage.objects FOR
UPDATE USING (bucket_id = 'logos');
-- 5. Profiles logic (Sync with Tenants)
-- Ensure profiles table exists if code expects it
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'profiles'
) THEN CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    branding JSONB DEFAULT '{}'::jsonb,
    menu_settings JSONB DEFAULT '{}'::jsonb,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Copy initial data from tenants if any
INSERT INTO public.profiles (id, slug, branding)
SELECT id,
    slug,
    theme_config
FROM public.tenants;
END IF;
END $$;
-- Ensure profiles is RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR
SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage profiles" ON public.profiles;
CREATE POLICY "Anyone can manage profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);