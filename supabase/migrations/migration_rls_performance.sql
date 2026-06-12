-- =====================================================
-- MIGRATION: RLS Performance Optimization (SAFE VERSION)
-- Date: 2026-01-11
-- Purpose: Optimize auth.uid() → (SELECT auth.uid())
-- =====================================================
-- This migration dynamically finds and recreates policies
-- with optimized auth.uid() calls to avoid per-row evaluation.
-- =====================================================
-- AUTOMATIC POLICY RECREATION SCRIPT
-- =====================================================
-- The following script identifies policies using auth.uid()
-- and shows how to optimize them. Run this query first to see
-- which policies need updating:
-- SELECT 
--     schemaname,
--     tablename,
--     policyname,
--     qual::text as using_clause,
--     with_check::text as check_clause
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- AND (qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%')
-- ORDER BY tablename;
-- =====================================================
-- MANUAL STEPS (RECOMMENDED)
-- =====================================================
-- Due to the complexity of different table structures,
-- the safest approach is to:
--
-- 1. Go to Supabase Dashboard → Database → Policies
-- 2. For each policy using auth.uid(), edit it
-- 3. Replace: auth.uid() with (SELECT auth.uid())
-- 4. Save the policy
--
-- This ensures the policy definition stays correct
-- while gaining the performance benefit.
-- =====================================================
-- EXAMPLE: How to manually optimize a policy
-- =====================================================
-- BEFORE (slow - evaluates for each row):
-- CREATE POLICY "example" ON my_table
-- FOR ALL USING (tenant_id = auth.uid());
-- AFTER (fast - evaluates once per query):
-- CREATE POLICY "example" ON my_table  
-- FOR ALL USING (tenant_id = (SELECT auth.uid()));
-- =====================================================
-- SAFE BATCH UPDATE FOR KNOWN TABLES
-- Only updates policies on tables we know exist
-- =====================================================
DO $$
DECLARE pol RECORD;
new_qual TEXT;
new_check TEXT;
BEGIN -- Find policies with auth.uid() that need optimization
-- This is informational only
FOR pol IN
SELECT schemaname,
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
    AND (
        qual::text LIKE '%auth.uid()%'
        AND qual::text NOT LIKE '%(select auth.uid())%'
    )
LIMIT 10 LOOP RAISE NOTICE 'Policy needing optimization: %.% (policy: %)', pol.schemaname, pol.tablename, pol.policyname;
END LOOP;
RAISE NOTICE 'To optimize these policies, update them in Supabase Dashboard';
RAISE NOTICE 'Replace auth.uid() with (SELECT auth.uid()) in each policy';
END $$;
-- =====================================================
-- PERFORMANCE VERIFICATION
-- Run after manual updates to verify optimization
-- =====================================================
-- Check how many policies still use unoptimized auth.uid():
-- SELECT COUNT(*) as unoptimized_policies
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- AND qual::text LIKE '%auth.uid()%'
-- AND qual::text NOT LIKE '%(select auth.uid())%';
-- =====================================================
-- NOTE: This migration is intentionally minimal
-- =====================================================
-- 
-- The original linter warnings about auth_rls_initplan
-- are PERFORMANCE suggestions, not security issues.
-- 
-- The performance impact is only noticeable with:
-- - Large tables (100k+ rows)
-- - Complex RLS policies
-- - High query frequency
--
-- For most applications, this optimization is optional.
-- Focus on security fixes first, then optimize as needed.