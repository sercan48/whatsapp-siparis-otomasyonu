-- FIX: RLS Policies for pos_sessions to allow updates
-- Date: 2026-01-16
-- Description: Ensures pos_sessions has RLS enabled and allows authenticated users (tenants) to update their sessions.
-- 1. Enable RLS on pos_sessions (if not already)
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;
-- 2. Create permissive policies for pos_sessions
-- Drop existing policies to avoid conflicts or duplication (safest approach for fixes)
DROP POLICY IF EXISTS "Tenants can view their own sessions" ON pos_sessions;
DROP POLICY IF EXISTS "Tenants can insert their own sessions" ON pos_sessions;
DROP POLICY IF EXISTS "Tenants can update their own sessions" ON pos_sessions;
-- Create policies
CREATE POLICY "Tenants can view their own sessions" ON pos_sessions FOR
SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Tenants can insert their own sessions" ON pos_sessions FOR
INSERT WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Tenants can update their own sessions" ON pos_sessions FOR
UPDATE USING (tenant_id = auth.uid());
-- Optional: Delete policy if needed? Usually we don't delete sessions, we cancel them.
-- But for completeness:
CREATE POLICY "Tenants can delete their own sessions" ON pos_sessions FOR DELETE USING (tenant_id = auth.uid());