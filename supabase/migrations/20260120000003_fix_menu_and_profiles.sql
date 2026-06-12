-- Migration: Add missing columns to menu table + Fix profiles RLS
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================
-- PART 1: Add missing columns to menu table
-- ============================================
-- Add extras column (JSONB array for extra options with quantity)
ALTER TABLE public.menu
ADD COLUMN IF NOT EXISTS extras jsonb DEFAULT '[]'::jsonb;
-- Add ingredients column (JSONB array for toggleable ingredients)
ALTER TABLE public.menu
ADD COLUMN IF NOT EXISTS ingredients jsonb DEFAULT '[]'::jsonb;
-- Add required_options column (JSONB array for mandatory selections)
ALTER TABLE public.menu
ADD COLUMN IF NOT EXISTS required_options jsonb DEFAULT '[]'::jsonb;
-- Add recommendations column (array of product IDs that pair well)
ALTER TABLE public.menu
ADD COLUMN IF NOT EXISTS recommendations uuid [] DEFAULT '{}';
-- Add allow_coupon column (whether coupons can be applied to this item)
ALTER TABLE public.menu
ADD COLUMN IF NOT EXISTS allow_coupon boolean DEFAULT true;
-- ============================================
-- PART 2: Fix profiles RLS for branding save
-- ============================================
-- Drop ALL existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public read profiles by slug" ON public.profiles;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Generic public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
-- Create simple, working policies
-- 1. Authenticated users can SELECT their own profile
CREATE POLICY "auth_select_own_profile" ON public.profiles FOR
SELECT TO authenticated USING (id = auth.uid());
-- 2. Authenticated users can UPDATE their own profile
CREATE POLICY "auth_update_own_profile" ON public.profiles FOR
UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- 3. Anon users can SELECT profiles (for public menu by slug)
CREATE POLICY "anon_select_profiles" ON public.profiles FOR
SELECT TO anon USING (true);
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ============================================
-- PART 3: Verify changes
-- ============================================
-- Run these to verify:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'menu';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';