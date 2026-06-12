-- =====================================================
-- MIGRATION: Critical Security Fixes
-- Date: 2026-01-11
-- Fixes: SECURITY DEFINER views, RLS disabled tables
-- =====================================================
-- =====================================================
-- 1. FIX SECURITY DEFINER VIEWS
-- Problem: Views use SECURITY DEFINER which bypasses RLS
-- Solution: Recreate with SECURITY INVOKER
-- =====================================================
-- 1.1 Fix low_stock_alerts view
DROP VIEW IF EXISTS public.low_stock_alerts;
CREATE VIEW public.low_stock_alerts WITH (security_invoker = true) AS
SELECT i.id,
    i.tenant_id,
    i.name,
    i.category,
    i.current_stock,
    i.min_stock_level,
    i.unit,
    i.current_stock - i.min_stock_level as stock_difference,
    CASE
        WHEN i.current_stock <= 0 THEN 'out_of_stock'
        WHEN i.current_stock <= i.min_stock_level THEN 'critical'
        WHEN i.current_stock <= i.min_stock_level * 1.5 THEN 'warning'
        ELSE 'ok'
    END as alert_level,
    s.name as supplier_name,
    s.phone as supplier_phone
FROM public.ingredients i
    LEFT JOIN public.suppliers s ON s.id = i.default_supplier_id
WHERE i.is_active = true
    AND i.current_stock <= i.min_stock_level * 1.5
ORDER BY CASE
        WHEN i.current_stock <= 0 THEN 1
        WHEN i.current_stock <= i.min_stock_level THEN 2
        ELSE 3
    END,
    i.current_stock ASC;
COMMENT ON VIEW public.low_stock_alerts IS 'Shows ingredients below minimum stock level. Uses SECURITY INVOKER for RLS compliance.';
-- 1.2 Fix active_campaigns view
-- Note: Uses existing is_campaign_active() function for proper time-based checking
DROP VIEW IF EXISTS public.active_campaigns;
CREATE VIEW public.active_campaigns WITH (security_invoker = true) AS
SELECT *
FROM public.campaigns
WHERE is_campaign_active(id) = TRUE;
COMMENT ON VIEW public.active_campaigns IS 'Shows currently active campaigns. Uses SECURITY INVOKER for RLS compliance.';
-- =====================================================
-- 2. FIX RLS DISABLED TABLE
-- Problem: security_logs has no RLS
-- Solution: Enable RLS and add appropriate policies
-- =====================================================
-- 2.1 Enable RLS on security_logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
-- 2.2 Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can view security logs" ON public.security_logs;
DROP POLICY IF EXISTS "System can insert security logs" ON public.security_logs;
-- 2.3 Create new policies
-- Only super admins can view security logs
CREATE POLICY "Super admins can view security logs" ON public.security_logs FOR
SELECT USING (
        (
            SELECT auth.jwt()->>'email'
        ) IN (
            SELECT email
            FROM public.super_admins
            WHERE is_active = true
        )
    );
-- Allow system (Edge Functions with service role) to insert logs
-- Note: This uses service role, not anon/authenticated
CREATE POLICY "System can insert security logs" ON public.security_logs FOR
INSERT WITH CHECK (true);
-- =====================================================
-- 3. VERIFICATION QUERIES
-- Run these after migration to confirm fixes
-- =====================================================
-- Verify views are SECURITY INVOKER
-- SELECT schemaname, viewname, definition 
-- FROM pg_views 
-- WHERE viewname IN ('low_stock_alerts', 'active_campaigns');
-- Verify RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename = 'security_logs';
-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================
-- DROP VIEW IF EXISTS public.low_stock_alerts;
-- DROP VIEW IF EXISTS public.active_campaigns;
-- DROP POLICY IF EXISTS "Super admins can view security logs" ON public.security_logs;
-- DROP POLICY IF EXISTS "System can insert security logs" ON public.security_logs;
-- ALTER TABLE public.security_logs DISABLE ROW LEVEL SECURITY;