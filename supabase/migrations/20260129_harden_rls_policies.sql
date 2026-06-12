-- =====================================================
-- RLS POLICY HARDENING
-- Migration: 20260129_harden_rls_policies.sql
-- Purpose: Replace overly permissive USING(true) policies
-- =====================================================
-- ⚠️ WARNING: Test thoroughly in staging before production!
-- These changes may break frontend functionality if not tested properly.
-- =====================================================
-- 1. CUSTOMERS TABLE (Contains PII - Most Critical)
-- =====================================================
DROP POLICY IF EXISTS "Public Access" ON public.customers;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.customers;
-- Service role (Edge Functions) can do everything
CREATE POLICY "service_role_all" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Authenticated users can only access their own tenant's customers
CREATE POLICY "tenant_read" ON public.customers FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_write" ON public.customers FOR
INSERT
UPDATE DELETE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- =====================================================
-- 2. ORDERS TABLE (Financial Data)
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.orders;
CREATE POLICY "service_role_all" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON public.orders FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
-- Orders should only be created via RPC (place_order_secure)
-- Direct inserts are blocked for authenticated users
CREATE POLICY "tenant_update" ON public.orders FOR
UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- =====================================================
-- 3. PAYMENT_TRANSACTIONS TABLE (Very Sensitive!)
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.payment_transactions;
CREATE POLICY "service_role_all" ON public.payment_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON public.payment_transactions FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
-- No direct insert/update/delete for authenticated users
-- All payment operations go through Edge Functions (service_role)
-- =====================================================
-- 4. PROFILES TABLE (Tenant Settings)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.profiles;
-- Public read (needed for digital menu display)
CREATE POLICY "public_read" ON public.profiles FOR
SELECT TO anon,
    authenticated USING (true);
-- Only owner can update their profile
CREATE POLICY "owner_write" ON public.profiles FOR
UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- =====================================================
-- 5. MENU TABLE (Public Read, Tenant Write)
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.menu;
-- Anyone can read menu (needed for digital menu)
CREATE POLICY "public_read" ON public.menu FOR
SELECT USING (true);
-- Only tenant can modify their menu
CREATE POLICY "tenant_write" ON public.menu FOR
INSERT
UPDATE DELETE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- =====================================================
-- 6. POS_ORDERS TABLE (QR Menu Orders)
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.pos_orders;
CREATE POLICY "service_role_all" ON public.pos_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Anonymous users can insert (via RPC - place_order_secure)
-- The RPC validates and creates the order
CREATE POLICY "anon_insert_via_rpc" ON public.pos_orders FOR
INSERT TO anon WITH CHECK (true);
-- Authenticated users (admins) can manage their tenant's orders
CREATE POLICY "tenant_all" ON public.pos_orders FOR ALL TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- =====================================================
-- 7. TENANT_CONFIGS TABLE (Contains API Keys!)
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.tenant_configs;
-- Only owner can access their config
CREATE POLICY "owner_only" ON public.tenant_configs FOR ALL TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- Service role access for Edge Functions
CREATE POLICY "service_role_all" ON public.tenant_configs FOR ALL TO service_role USING (true);
-- =====================================================
-- VERIFICATION QUERIES (Run after migration)
-- =====================================================
-- Check remaining permissive policies:
-- SELECT tablename, policyname, qual::text, with_check::text 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND (qual::text LIKE '%true%' OR with_check::text LIKE '%true%');