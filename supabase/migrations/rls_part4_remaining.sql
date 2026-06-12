-- =====================================================
-- RLS HARDENING - Part 4: PROFILES, MENU, POS_ORDERS, TENANT_CONFIGS
-- =====================================================
-- ⚠️ Bu script'i Supabase SQL Editor'da çalıştırın
-- =====================================================
-- PROFILES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Anyone can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.profiles;
DROP POLICY IF EXISTS "public_read" ON public.profiles;
DROP POLICY IF EXISTS "owner_write" ON public.profiles;
-- Public read (digital menu için gerekli)
CREATE POLICY "public_read" ON public.profiles FOR
SELECT TO anon,
    authenticated USING (true);
-- Sadece profil sahibi güncelleyebilir
CREATE POLICY "owner_write" ON public.profiles FOR
UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- =====================================================
-- MENU TABLE
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.menu;
DROP POLICY IF EXISTS "public_read" ON public.menu;
DROP POLICY IF EXISTS "tenant_write" ON public.menu;
DROP POLICY IF EXISTS "tenant_insert" ON public.menu;
DROP POLICY IF EXISTS "tenant_update" ON public.menu;
DROP POLICY IF EXISTS "tenant_delete" ON public.menu;
-- Herkes menüyü okuyabilir
CREATE POLICY "public_read" ON public.menu FOR
SELECT USING (true);
-- Sadece tenant kendi menüsünü değiştirebilir
CREATE POLICY "tenant_insert" ON public.menu FOR
INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "tenant_update" ON public.menu FOR
UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "tenant_delete" ON public.menu FOR DELETE TO authenticated USING (tenant_id = auth.uid());
-- =====================================================
-- POS_ORDERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.pos_orders;
DROP POLICY IF EXISTS "service_role_all" ON public.pos_orders;
DROP POLICY IF EXISTS "anon_insert_via_rpc" ON public.pos_orders;
DROP POLICY IF EXISTS "tenant_all" ON public.pos_orders;
-- Service role her şeyi yapabilir
CREATE POLICY "service_role_all" ON public.pos_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Anonymous insert (QR menü siparişleri için)
CREATE POLICY "anon_insert" ON public.pos_orders FOR
INSERT TO anon WITH CHECK (true);
-- Tenant kendi siparişlerini yönetebilir
CREATE POLICY "tenant_select" ON public.pos_orders FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_update" ON public.pos_orders FOR
UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "tenant_delete" ON public.pos_orders FOR DELETE TO authenticated USING (tenant_id = auth.uid());
-- =====================================================
-- TENANT_CONFIGS TABLE (API Keys içerir!)
-- =====================================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.tenant_configs;
DROP POLICY IF EXISTS "owner_only" ON public.tenant_configs;
DROP POLICY IF EXISTS "service_role_all" ON public.tenant_configs;
-- Service role erişimi
CREATE POLICY "service_role_all" ON public.tenant_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Sadece tenant sahibi erişebilir
CREATE POLICY "owner_only" ON public.tenant_configs FOR ALL TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- =====================================================
-- Doğrulama - Tüm policy'leri kontrol et
-- =====================================================
-- SELECT tablename, policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;