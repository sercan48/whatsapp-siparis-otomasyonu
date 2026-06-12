-- =====================================================
-- MIGRATION: n8n Workflow Replacements
-- Date: 2026-01-11
-- Replaces: 4 n8n workflows with native Supabase triggers
-- =====================================================
-- =====================================================
-- 1. ORDER STATUS NOTIFIER
-- Replaces: 4_Status_Updater.json
-- Trigger: When order status changes, call Edge Function
-- =====================================================
-- Create the trigger function
CREATE OR REPLACE FUNCTION public.notify_order_status_change() RETURNS TRIGGER SECURITY DEFINER
SET search_path = public LANGUAGE plpgsql AS $$
DECLARE payload JSONB;
BEGIN -- Only trigger if status actually changed
IF OLD.status IS DISTINCT
FROM NEW.status THEN payload := jsonb_build_object(
        'order_id',
        NEW.id,
        'old_status',
        OLD.status,
        'new_status',
        NEW.status,
        'customer_phone',
        NEW.customer_phone,
        'customer_name',
        NEW.customer_name,
        'tenant_id',
        NEW.tenant_id,
        'total',
        NEW.total,
        'updated_at',
        NEW.updated_at
    );
-- Call Edge Function via pg_net (async HTTP)
PERFORM net.http_post(
    url := 'https://czzpxkgkphqdjwpvmpob.supabase.co/functions/v1/order-status-notify',
    headers := jsonb_build_object(
        'Content-Type',
        'application/json',
        'Authorization',
        'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := payload
);
END IF;
RETURN NEW;
END;
$$;
-- Create the trigger
DROP TRIGGER IF EXISTS order_status_changed_trigger ON public.orders;
CREATE TRIGGER order_status_changed_trigger
AFTER
UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();
-- =====================================================
-- 2. NEW RESELLER ALERT
-- Replaces: 5_New_Reseller_Alert.json
-- Trigger: When new reseller application is created
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_new_reseller_application() RETURNS TRIGGER SECURITY DEFINER
SET search_path = public LANGUAGE plpgsql AS $$
DECLARE payload JSONB;
BEGIN payload := jsonb_build_object(
    'application_id',
    NEW.id,
    'first_name',
    NEW.first_name,
    'last_name',
    NEW.last_name,
    'phone',
    NEW.phone,
    'email',
    NEW.email,
    'company_name',
    NEW.company_name,
    'created_at',
    NEW.created_at
);
-- Call Edge Function
PERFORM net.http_post(
    url := 'https://czzpxkgkphqdjwpvmpob.supabase.co/functions/v1/reseller-alert',
    headers := jsonb_build_object(
        'Content-Type',
        'application/json',
        'Authorization',
        'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := payload
);
RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS new_reseller_application_trigger ON public.reseller_applications;
CREATE TRIGGER new_reseller_application_trigger
AFTER
INSERT ON public.reseller_applications FOR EACH ROW EXECUTE FUNCTION public.notify_new_reseller_application();
-- =====================================================
-- 3. BIRTHDAY COUPON CRON JOB
-- Replaces: 6_Customer_Retention.json
-- Cron: Daily at 10:00 AM
-- =====================================================
-- NOTE: pg_cron is NOT enabled by default on Supabase.
-- To enable it:
-- 1. Go to Supabase Dashboard → Database → Extensions
-- 2. Search for "pg_cron"
-- 3. Click Enable
-- 4. Then run the following SQL manually:
-- SELECT cron.schedule(
--     'birthday-coupon-job',
--     '0 10 * * *',
--     $$
--     SELECT net.http_post(
--         url := 'https://czzpxkgkphqdjwpvmpob.supabase.co/functions/v1/birthday-coupon',
--         headers := '{"Content-Type": "application/json"}'::jsonb,
--         body := '{}'::jsonb
--     );
--     $$
-- );
-- ALTERNATIVE: Use Supabase Dashboard → Database → Cron Jobs
-- to schedule the job visually without SQL.
-- =====================================================
-- 4. AI DISPUTE RESOLVER
-- Note: This is integrated into whatsapp-webhook Edge Function
-- No separate trigger needed - handled in message processing
-- =====================================================
-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check triggers are created
-- SELECT tgname, tgrelid::regclass, tgfoid::regprocedure 
-- FROM pg_trigger 
-- WHERE tgname LIKE '%order_status%' OR tgname LIKE '%reseller%';
-- Check cron jobs
-- SELECT * FROM cron.job;
-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================
-- DROP TRIGGER IF EXISTS order_status_changed_trigger ON public.orders;
-- DROP TRIGGER IF EXISTS new_reseller_application_trigger ON public.reseller_applications;
-- DROP FUNCTION IF EXISTS public.notify_order_status_change();
-- DROP FUNCTION IF EXISTS public.notify_new_reseller_application();
-- SELECT cron.unschedule('birthday-coupon-job');