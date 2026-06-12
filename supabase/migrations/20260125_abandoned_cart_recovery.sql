-- Migration: Abandoned Cart Recovery (Phase 2)
-- Purpose: Find checkouts that started > 30 mins ago but are not paid, and trigger reminders.
-- 1. Create a function to find abandoned carts
CREATE OR REPLACE FUNCTION public.get_abandoned_carts(
        p_minutes_threshold INT DEFAULT 30,
        p_hours_limit INT DEFAULT 24
    ) RETURNS TABLE (
        session_id UUID,
        customer_phone TEXT,
        tenant_id UUID,
        updated_at TIMESTAMPTZ,
        pending_order JSONB
    ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT ws.id,
    ws.customer_phone,
    ws.tenant_id,
    ws.updated_at,
    ws.pending_order
FROM whatsapp_sessions ws
WHERE ws.updated_at < NOW() - (p_minutes_threshold || ' minutes')::INTERVAL
    AND ws.updated_at > NOW() - (p_hours_limit || ' hours')::INTERVAL
    AND ws.state IN ('awaiting_address', 'awaiting_payment') -- Stuck in flow
    AND ws.pending_order IS NOT NULL
    AND (ws.pending_order->>'items')::JSONB IS NOT NULL
    AND jsonb_array_length((ws.pending_order->>'items')::JSONB) > 0;
END;
$$;
-- 2. Grant access
GRANT EXECUTE ON FUNCTION public.get_abandoned_carts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_abandoned_carts TO service_role;
-- 3. (Optional) If pg_cron is enabled, schedule the job
-- This part is commented out as pg_cron might not be enabled. User needs to run this manually if they have pg_cron.
/*
 SELECT cron.schedule(
 'abandoned-cart-job',
 '*/
15 * * * * ', -- Every 15 minutes
    $$
    SELECT net.http_post(
        url := ' https: // YOUR_PROJECT_ID.supabase.co / functions / v1 / abandoned - cart - recovery ',
        headers := ' { "Content-Type": "application/json",
"Authorization": "Bearer YOUR_SERVICE_KEY" } '::jsonb,
        body := ' { } '::jsonb
    );
    $$
);
*/