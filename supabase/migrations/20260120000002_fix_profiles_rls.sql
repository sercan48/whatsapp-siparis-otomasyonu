-- Migration: Fix profiles RLS for branding updates
-- Run this in Supabase SQL Editor
-- Check existing policies on profiles
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';
-- Allow authenticated users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- Also ensure they can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR
SELECT TO authenticated USING (id = auth.uid());
-- Public can read profiles (for digital menu lookup by slug)
DROP POLICY IF EXISTS "Public read profiles by slug" ON public.profiles;
CREATE POLICY "Public read profiles by slug" ON public.profiles FOR
SELECT TO anon USING (true);
-- Make sure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;