-- ========================================
-- SAAS CORE SCHEMA VERIFICATION SCRIPT
-- ========================================
-- Bu scripti Supabase SQL Editor'de çalıştırarak yeni multi-tenant,
-- dynamic-config ve JSONB altyapısını doğrulayabilirsiniz.

-- 1. TABLO MEVCUDİYETİ VE ROW-LEVEL SECURITY KONTROLÜ
SELECT 
    schemaname as schema,
    tablename as table,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'tenant_configs', 'customers', 'products', 'campaigns', 'orders', 'payment_receipts', 'bank_transactions')
ORDER BY tablename;

-- 2. DİNAMİK VE JSONB KOLONLARIN VERİ TİPİ DOĞRULAMASI
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('tenant_configs', 'orders', 'products', 'customers', 'bank_transactions')
AND (data_type = 'USER-DEFINED' OR column_name IN ('meta_data', 'ai_config', 'commerce_config', 'order_states', 'items', 'status'))
ORDER BY table_name, column_name;

-- 3. UNIQUE CONSTRAINT KONTROLLERİ (Müşterilerin tenant bazlı tekilliği)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
AND conname IN ('unique_customer_per_tenant');

-- 4. PL/PGSQL FONKSİYON KONTROLLERİ
SELECT 
    routine_name as function_name,
    data_type as return_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('cancel_order', 'reconcile_bank_transactions');
