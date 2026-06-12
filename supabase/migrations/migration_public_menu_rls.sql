-- Fix RLS for Public Menu Access
-- Allow anyone to read restaurant_tables for QR menu functionality
-- Drop existing restrictive policy if needed
DROP POLICY IF EXISTS "Public can view tables for menu" ON restaurant_tables;
-- Create public read policy for menu
CREATE POLICY "Public can view tables for menu" ON restaurant_tables FOR
SELECT USING (true);
-- Also ensure menu table is publicly readable
DROP POLICY IF EXISTS "Public can view menu" ON menu;
CREATE POLICY "Public can view menu" ON menu FOR
SELECT USING (available = true);
-- Ensure profiles branding is readable for menu theming
DROP POLICY IF EXISTS "Public can view tenant branding" ON profiles;
CREATE POLICY "Public can view tenant branding" ON profiles FOR
SELECT USING (true);