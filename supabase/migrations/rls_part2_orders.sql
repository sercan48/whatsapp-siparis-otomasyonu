-- =====================================================
-- RLS HARDENING - Part 2: ORDERS TABLE
-- =====================================================
-- ⚠️ Bu script'i Supabase SQL Editor'da çalıştırın
-- 1. Mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Enable read/write for all" ON public.orders;
DROP POLICY IF EXISTS "service_role_all" ON public.orders;
DROP POLICY IF EXISTS "tenant_read" ON public.orders;
DROP POLICY IF EXISTS "tenant_update" ON public.orders;
DROP POLICY IF EXISTS "tenant_insert" ON public.orders;
-- 2. Service role her şeyi yapabilir
CREATE POLICY "service_role_all" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 3. Tenant okuma
CREATE POLICY "tenant_read" ON public.orders FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
-- 4. Tenant güncelleme
CREATE POLICY "tenant_update" ON public.orders FOR
UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- 5. Anonymous insert (RPC üzerinden)
-- pos_orders tablosu yerine orders'a da insert gerekebilir
CREATE POLICY "anon_insert" ON public.orders FOR
INSERT TO anon WITH CHECK (true);
-- =====================================================
-- Doğrulama
-- =====================================================
-- SELECT policyname, cmd, roles, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'orders';