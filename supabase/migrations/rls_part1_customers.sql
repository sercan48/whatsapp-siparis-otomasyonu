-- =====================================================
-- RLS HARDENING - Part 1: CUSTOMERS TABLE
-- =====================================================
-- ⚠️ Bu script'i Supabase SQL Editor'da çalıştırın
-- 1. Mevcut izin verici policy'leri kaldır
DROP POLICY IF EXISTS "Public Access" ON public.customers;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.customers;
DROP POLICY IF EXISTS "service_role_all" ON public.customers;
DROP POLICY IF EXISTS "tenant_read" ON public.customers;
DROP POLICY IF EXISTS "tenant_write" ON public.customers;
-- 2. Service role (Edge Functions) her şeyi yapabilir
CREATE POLICY "service_role_all" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 3. Authenticated users sadece kendi tenant'larının müşterilerini okuyabilir
CREATE POLICY "tenant_read" ON public.customers FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
-- 4. Authenticated users sadece kendi tenant'ları için yazabilir
CREATE POLICY "tenant_insert" ON public.customers FOR
INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "tenant_update" ON public.customers FOR
UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "tenant_delete" ON public.customers FOR DELETE TO authenticated USING (tenant_id = auth.uid());
-- =====================================================
-- Doğrulama: Aşağıdaki sorguyu çalıştırarak kontrol edin
-- =====================================================
-- SELECT policyname, cmd, roles, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'customers';