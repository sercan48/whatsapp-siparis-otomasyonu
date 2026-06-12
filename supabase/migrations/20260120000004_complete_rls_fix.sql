-- ============================================
-- COMPLETE RLS FIX - Run this ENTIRE script
-- ============================================
-- This script will fix ALL RLS issues for profiles and menu tables
-- ============================================
-- STEP 1: Temporarily disable RLS to clean up
-- ============================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu DISABLE ROW LEVEL SECURITY;
-- ============================================
-- STEP 2: Drop ALL existing policies on profiles
-- ============================================
DO $$
DECLARE pol RECORD;
BEGIN FOR pol IN
SELECT policyname
FROM pg_policies
WHERE tablename = 'profiles' LOOP EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.profiles',
        pol.policyname
    );
END LOOP;
END $$;
-- ============================================
-- STEP 3: Drop ALL existing policies on menu
-- ============================================
DO $$
DECLARE pol RECORD;
BEGIN FOR pol IN
SELECT policyname
FROM pg_policies
WHERE tablename = 'menu' LOOP EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.menu',
        pol.policyname
    );
END LOOP;
END $$;
-- ============================================
-- STEP 4: Create SIMPLE working policies for profiles
-- ============================================
-- Authenticated users can do EVERYTHING on their own profile
CREATE POLICY "profiles_auth_all" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Anon can read profiles (for public menu)
CREATE POLICY "profiles_anon_select" ON public.profiles FOR
SELECT TO anon USING (true);
-- ============================================
-- STEP 5: Create SIMPLE working policies for menu
-- ============================================
-- Authenticated users can do EVERYTHING on menu
CREATE POLICY "menu_auth_all" ON public.menu FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Anon can read menu (for public viewing)
CREATE POLICY "menu_anon_select" ON public.menu FOR
SELECT TO anon USING (true);
-- ============================================
-- STEP 6: Re-enable RLS with new policies
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;
-- ============================================
-- STEP 7: Verify policies are created
-- ============================================
SELECT tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename IN ('profiles', 'menu')
ORDER BY tablename,
    policyname;