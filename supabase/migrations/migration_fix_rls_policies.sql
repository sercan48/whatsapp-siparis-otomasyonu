-- ===========================================
-- GÜVENLİK MİGRATION - RLS POLİTİKALARINI DÜZELTME
-- Açık "FOR ALL USING (true)" politikalarını tenant-based izolasyona günceller
-- 
-- DİKKAT: Bu migration'ı production'a uygulamadan önce staging'de test edin!
-- ===========================================
-- ============================================
-- ADIM 1: TENANTS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.tenants;
-- Tenant sadece kendi kaydını görebilir
CREATE POLICY "Tenant can view own record" ON public.tenants FOR
SELECT USING (id = auth.uid());
-- Tenant kendi kaydını güncelleyebilir
CREATE POLICY "Tenant can update own record" ON public.tenants FOR
UPDATE USING (id = auth.uid());
-- Admin herşeyi görebilir (super_admins tablosunda kayıtlı ise)
CREATE POLICY "Admin full access to tenants" ON public.tenants FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM super_admins
        WHERE email = auth.jwt()->>'email'
            AND is_active = true
    )
);
-- ============================================
-- ADIM 2: USERS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.users;
CREATE POLICY "Users can view own tenant users" ON public.users FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Users can manage own tenant users" ON public.users FOR ALL USING (tenant_id = auth.uid());
-- ============================================
-- ADIM 3: MENU TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.menu;
-- Herkes menüyü görebilir (QR sipariş için gerekli)
CREATE POLICY "Public can view menu" ON public.menu FOR
SELECT USING (true);
-- Sadece tenant sahibi menüyü düzenleyebilir
CREATE POLICY "Tenant can manage own menu" ON public.menu FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- ============================================
-- ADIM 4: CAMPAIGNS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.campaigns;
-- Herkes kampanyaları görebilir
CREATE POLICY "Public can view campaigns" ON public.campaigns FOR
SELECT USING (true);
-- Sadece tenant sahibi kampanya yönetebilir
CREATE POLICY "Tenant can manage own campaigns" ON public.campaigns FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- ============================================
-- ADIM 5: ORDERS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.orders;
-- Herkes sipariş oluşturabilir (WhatsApp üzerinden)
CREATE POLICY "Public can create orders" ON public.orders FOR
INSERT WITH CHECK (true);
-- Tenant kendi siparişlerini görebilir ve yönetebilir
CREATE POLICY "Tenant can view own orders" ON public.orders FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenant can update own orders" ON public.orders FOR
UPDATE USING (tenant_id = auth.uid());
-- ============================================
-- ADIM 6: CUSTOMERS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Public Access" ON public.customers;
CREATE POLICY "Tenant can manage own customers" ON public.customers FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
-- ============================================
-- ADIM 7: RESELLERS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.resellers;
-- Reseller kendi kaydını görebilir
CREATE POLICY "Reseller can view own record" ON public.resellers FOR
SELECT USING (id = auth.uid());
-- Reseller kendi kaydını güncelleyebilir
CREATE POLICY "Reseller can update own record" ON public.resellers FOR
UPDATE USING (id = auth.uid());
-- Admin tüm bayileri yönetebilir
CREATE POLICY "Admin full access to resellers" ON public.resellers FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM super_admins
        WHERE email = auth.jwt()->>'email'
            AND is_active = true
    )
);
-- ============================================
-- ADIM 8: LEDGER (FİNANS) TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.ledger;
-- Tenant kendi finansal kayıtlarını görebilir
CREATE POLICY "Tenant can view own ledger" ON public.ledger FOR
SELECT USING (tenant_id = auth.uid());
-- Reseller kendi komisyon kayıtlarını görebilir
CREATE POLICY "Reseller can view own commissions" ON public.ledger FOR
SELECT USING (reseller_id = auth.uid());
-- Admin tüm finansal kayıtları görebilir
CREATE POLICY "Admin full access to ledger" ON public.ledger FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM super_admins
        WHERE email = auth.jwt()->>'email'
            AND is_active = true
    )
);
-- ============================================
-- ADIM 9: RESELLER_APPLICATIONS TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.reseller_applications;
-- Herkes başvuru yapabilir
CREATE POLICY "Public can create applications" ON public.reseller_applications FOR
INSERT WITH CHECK (true);
-- Sadece admin başvuruları görebilir/yönetebilir
CREATE POLICY "Admin can manage applications" ON public.reseller_applications FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM super_admins
        WHERE email = auth.jwt()->>'email'
            AND is_active = true
    )
);
-- ============================================
-- ADIM 10: PROMPT_TEMPLATES TABLOSU
-- ============================================
DROP POLICY IF EXISTS "Enable read/write for all" ON public.prompt_templates;
-- Herkes şablonları görebilir
CREATE POLICY "Public can view templates" ON public.prompt_templates FOR
SELECT USING (true);
-- Sadece admin şablon yönetebilir
CREATE POLICY "Admin can manage templates" ON public.prompt_templates FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM super_admins
        WHERE email = auth.jwt()->>'email'
            AND is_active = true
    )
);
-- ============================================
-- LOG: Migration tamamlandı
-- ============================================
DO $$ BEGIN RAISE NOTICE 'RLS Policy Fix Migration completed successfully at %',
NOW();
END $$;