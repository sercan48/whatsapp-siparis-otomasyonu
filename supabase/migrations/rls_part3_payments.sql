-- =====================================================
-- RLS HARDENING - Part 3: PAYMENT_TRANSACTIONS TABLE
-- =====================================================
-- ⚠️ Bu script'i Supabase SQL Editor'da çalıştırın
-- 1. Mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Enable read/write for all" ON public.payment_transactions;
DROP POLICY IF EXISTS "service_role_all" ON public.payment_transactions;
DROP POLICY IF EXISTS "tenant_read" ON public.payment_transactions;
-- 2. Service role her şeyi yapabilir (Edge Functions için)
CREATE POLICY "service_role_all" ON public.payment_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 3. Tenant sadece kendi ödeme kayıtlarını okuyabilir
CREATE POLICY "tenant_read" ON public.payment_transactions FOR
SELECT TO authenticated USING (tenant_id = auth.uid());
-- ❌ Authenticated users için INSERT/UPDATE/DELETE YOK
-- Tüm ödeme işlemleri Edge Functions üzerinden yapılmalı
-- =====================================================
-- Doğrulama
-- =====================================================
-- SELECT policyname, cmd, roles, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'payment_transactions';