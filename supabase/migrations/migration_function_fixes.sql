-- =====================================================
-- MIGRATION: Function Search Path Fixes
-- Date: 2026-01-11
-- Fixes: Functions with mutable search_path
-- Only includes functions that actually exist in the database
-- =====================================================
-- Problem: Functions without explicit search_path can be exploited
-- by attackers who prepend malicious schemas to the search path.
-- Solution: Set search_path = public for all functions.
-- =====================================================
-- Core Business Functions
-- =====================================================
-- Note: Using DO block to safely alter functions only if they exist
DO $$ BEGIN -- is_campaign_active
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'is_campaign_active'
) THEN ALTER FUNCTION public.is_campaign_active(UUID)
SET search_path = public;
END IF;
-- handle_subscription_payment
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'handle_subscription_payment'
) THEN ALTER FUNCTION public.handle_subscription_payment()
SET search_path = public;
END IF;
-- update_tenant_config_timestamp
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_tenant_config_timestamp'
) THEN ALTER FUNCTION public.update_tenant_config_timestamp()
SET search_path = public;
END IF;
-- check_login_rate_limit
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'check_login_rate_limit'
) THEN ALTER FUNCTION public.check_login_rate_limit(TEXT, INTEGER, INTEGER)
SET search_path = public;
END IF;
-- cleanup_expired_sessions
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'cleanup_expired_sessions'
) THEN ALTER FUNCTION public.cleanup_expired_sessions()
SET search_path = public;
END IF;
-- generate_default_tables
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'generate_default_tables'
) THEN ALTER FUNCTION public.generate_default_tables(UUID, INT)
SET search_path = public;
END IF;
-- update_restaurant_tables_timestamp
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_restaurant_tables_timestamp'
) THEN ALTER FUNCTION public.update_restaurant_tables_timestamp()
SET search_path = public;
END IF;
-- update_payment_updated_at
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_payment_updated_at'
) THEN ALTER FUNCTION public.update_payment_updated_at()
SET search_path = public;
END IF;
-- deduct_stock_on_order
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'deduct_stock_on_order'
) THEN ALTER FUNCTION public.deduct_stock_on_order()
SET search_path = public;
END IF;
-- update_platform_order_stats
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_platform_order_stats'
) THEN ALTER FUNCTION public.update_platform_order_stats()
SET search_path = public;
END IF;
-- update_external_provider_stats
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_external_provider_stats'
) THEN ALTER FUNCTION public.update_external_provider_stats()
SET search_path = public;
END IF;
-- update_courier_stats
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_courier_stats'
) THEN ALTER FUNCTION public.update_courier_stats()
SET search_path = public;
END IF;
-- update_courier_rating
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_courier_rating'
) THEN ALTER FUNCTION public.update_courier_rating()
SET search_path = public;
END IF;
-- calculate_delivery_earnings (check for different signatures)
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'calculate_delivery_earnings'
) THEN -- May have parameters, try without first
BEGIN ALTER FUNCTION public.calculate_delivery_earnings()
SET search_path = public;
EXCEPTION
WHEN undefined_function THEN NULL;
-- Skip if signature doesn't match
END;
END IF;
-- cleanup_expired_cards
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'cleanup_expired_cards'
) THEN ALTER FUNCTION public.cleanup_expired_cards()
SET search_path = public;
END IF;
-- handle_new_tenant_promotion
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'handle_new_tenant_promotion'
) THEN ALTER FUNCTION public.handle_new_tenant_promotion()
SET search_path = public;
END IF;
-- use_ai_credit
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'use_ai_credit'
) THEN ALTER FUNCTION public.use_ai_credit(UUID)
SET search_path = public;
END IF;
-- get_ai_credit_status
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'get_ai_credit_status'
) THEN ALTER FUNCTION public.get_ai_credit_status(UUID)
SET search_path = public;
END IF;
-- update_ai_billing
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_ai_billing'
) THEN ALTER FUNCTION public.update_ai_billing()
SET search_path = public;
END IF;
-- create_order_accounting_entry
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'create_order_accounting_entry'
) THEN ALTER FUNCTION public.create_order_accounting_entry()
SET search_path = public;
END IF;
-- update_courier_balance
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_courier_balance'
) THEN ALTER FUNCTION public.update_courier_balance()
SET search_path = public;
END IF;
-- update_ledger_timestamp
IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_ledger_timestamp'
) THEN ALTER FUNCTION public.update_ledger_timestamp()
SET search_path = public;
END IF;
RAISE NOTICE 'Function search_path fixes completed successfully';
END $$;
-- =====================================================
-- VERIFICATION QUERY
-- Run this after migration to verify functions are fixed
-- =====================================================
-- SELECT 
--     n.nspname as schema,
--     p.proname as function_name,
--     CASE 
--         WHEN p.proconfig IS NULL THEN 'NOT SET'
--         ELSE array_to_string(p.proconfig, ', ')
--     END as config
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.proconfig IS NOT NULL
-- AND 'search_path=public' = ANY(p.proconfig);