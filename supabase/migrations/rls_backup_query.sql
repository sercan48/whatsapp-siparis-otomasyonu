-- =====================================================
-- RLS POLICIES BACKUP SCRIPT
-- Oluşturma: 2026-01-29 10:28
-- =====================================================
-- Bu script'i Supabase SQL Editor'da çalıştırarak
-- mevcut policy'leri görüntüleyin ve kopyalayın.
-- =====================================================
-- 1. TÜM MEVCUT POLİCY'LERİ LİSTELE
SELECT schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename,
    policyname;
-- =====================================================
-- 2. HER TABLO İÇİN DETAYLI BACKUP
-- =====================================================
-- CUSTOMERS tablosu policy'leri
SELECT 'CUSTOMERS:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'customers';
-- ORDERS tablosu policy'leri
SELECT 'ORDERS:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'orders';
-- PAYMENT_TRANSACTIONS tablosu policy'leri
SELECT 'PAYMENT_TRANSACTIONS:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'payment_transactions';
-- PROFILES tablosu policy'leri
SELECT 'PROFILES:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'profiles';
-- MENU tablosu policy'leri
SELECT 'MENU:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'menu';
-- POS_ORDERS tablosu policy'leri
SELECT 'POS_ORDERS:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'pos_orders';
-- TENANT_CONFIGS tablosu policy'leri
SELECT 'TENANT_CONFIGS:' as table_info;
SELECT policyname,
    cmd,
    roles::text,
    qual::text,
    with_check::text
FROM pg_policies
WHERE tablename = 'tenant_configs';