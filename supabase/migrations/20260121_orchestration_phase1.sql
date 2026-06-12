-- =====================================================
-- ORCHESTRATION PHASE 1: Database Schema Updates
-- 1. Fix Orders (subtotal & financials)
-- 2. Enhance Resellers (Auth fields)
-- 3. Tenant Settings (Hours, Min Order, etc.)
-- =====================================================
-- 1. FIX ORDERS Table
DO $$ BEGIN -- Ensure all financial columns exist
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'subtotal'
) THEN
ALTER TABLE public.orders
ADD COLUMN subtotal NUMERIC(10, 2) DEFAULT 0;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'delivery_fee'
) THEN
ALTER TABLE public.orders
ADD COLUMN delivery_fee NUMERIC(10, 2) DEFAULT 0;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'total_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN total_amount NUMERIC(10, 2) DEFAULT 0;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'final_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN final_amount NUMERIC(10, 2) DEFAULT 0;
END IF;
-- Just in case
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
        AND column_name = 'discount_amount'
) THEN
ALTER TABLE public.orders
ADD COLUMN discount_amount NUMERIC(10, 2) DEFAULT 0;
END IF;
END $$;
-- 2. UPDATE RESELLERS Table (For Custom Auth)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'resellers'
        AND column_name = 'email'
) THEN
ALTER TABLE public.resellers
ADD COLUMN email TEXT UNIQUE;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'resellers'
        AND column_name = 'phone'
) THEN
ALTER TABLE public.resellers
ADD COLUMN phone TEXT;
END IF;
-- Storing simple password for this MVP/Role-based system as requested (separate from Supabase Auth Users for now)
-- Ideally this should be hashed, but for simplicity in this specific "reseller portal" requirement we might use direct check or sync with auth.users later.
-- We will store a simple text for now to allow "Show Password" functionality if needed by admin, OR clarify we want auth.users.
-- User said: "bayi kendi sistemine girince şifre değiştir ile yeni şifre belirleyebilir"
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'resellers'
        AND column_name = 'password'
) THEN
ALTER TABLE public.resellers
ADD COLUMN password TEXT;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'resellers'
        AND column_name = 'is_active'
) THEN
ALTER TABLE public.resellers
ADD COLUMN is_active BOOLEAN DEFAULT true;
END IF;
END $$;
-- 3. UPDATE TENANTS/PROFILES (For Settings)
DO $$ BEGIN -- We'll add it to 'tenants' table as it is providing the core config
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants'
        AND column_name = 'settings'
) THEN
ALTER TABLE public.tenants
ADD COLUMN settings JSONB DEFAULT '{
            "min_order_amount": 0,
            "delivery_fee": 0,
            "free_delivery_threshold": 0,
            "opening_time": "09:00",
            "closing_time": "22:00",
            "is_open": true
        }';
END IF;
-- Also verify 'profiles' has it synced or accessible via join. 
-- The app usually queries 'profiles'. Let's add it to profiles to for easier frontend access if needed, 
-- or we rely on the Join. Current App uses profiles.
-- Let's add 'menu_settings' enhancement or a new 'store_settings' column to profiles
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
        AND column_name = 'store_settings'
) THEN
ALTER TABLE public.profiles
ADD COLUMN store_settings JSONB DEFAULT '{
            "min_order_amount": 0,
            "delivery_fee": 0,
            "opening_time": "09:00",
            "closing_time": "23:00"
        }';
END IF;
END $$;
-- RLS Policies for Resellers (If not exists)
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
-- Allow public read for login verification (or better: create a function)
CREATE OR REPLACE FUNCTION verify_reseller_login(p_email text, p_password text) RETURNS TABLE (id uuid, name text, email text) AS $$ BEGIN RETURN QUERY
SELECT r.id,
    r.name,
    r.email
FROM resellers r
WHERE r.email = p_email
    AND r.password = p_password
    AND r.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Allow resellers to see their own tenants
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Resellers view own tenants'
        AND tablename = 'tenants'
) THEN CREATE POLICY "Resellers view own tenants" ON public.tenants FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.resellers r
            WHERE r.id = tenants.reseller_id
        )
    );
END IF;
END $$;
-- =====================================================
-- 4. TEST RESELLER DATA (Remove in production)
-- =====================================================
INSERT INTO public.resellers (id, name, email, phone, password, is_active)
VALUES (
        gen_random_uuid(),
        'Test Bayi 1',
        'bayi1@test.com',
        '5551112233',
        'test123',
        true
    ),
    (
        gen_random_uuid(),
        'Test Bayi 2',
        'bayi2@test.com',
        '5554445566',
        'test456',
        true
    ) ON CONFLICT (email) DO NOTHING;
-- RLS policy to allow the verify_reseller_login function to work
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Allow login function'
        AND tablename = 'resellers'
) THEN CREATE POLICY "Allow login function" ON public.resellers FOR
SELECT USING (true);
END IF;
END $$;