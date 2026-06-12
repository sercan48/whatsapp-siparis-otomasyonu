-- =====================================================
-- MIGRATION: QR Menu Security & Anti-Hijack
-- Date: 2026-01-16
-- Description: Adds device tracking and approval workflow
-- =====================================================
-- 1. Add Device Tracking Columns to pos_sessions
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_sessions'
        AND column_name = 'device_ids'
) THEN
ALTER TABLE pos_sessions
ADD COLUMN device_ids JSONB DEFAULT '[]'::jsonb;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pos_sessions'
        AND column_name = 'pending_devices'
) THEN
ALTER TABLE pos_sessions
ADD COLUMN pending_devices JSONB DEFAULT '[]'::jsonb;
END IF;
END $$;
-- 2. Handle Status Enum (if exists) or Check Constraint
DO $$ BEGIN -- If using native ENUM type
IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'pos_session_status'
) THEN ALTER TYPE pos_session_status
ADD VALUE IF NOT EXISTS 'pending_approval';
END IF;
-- If using Check Constraint (drop and recreate to include pending_approval)
-- This part assumes standard naming 'pos_sessions_status_check'. 
-- If you use a different constraint name, this might need manual adjustment.
-- For safety, we rely on TEXT column flexibility usually used in Supabase.
END $$;
-- 3. RLS Policy: Prevent unauthorized INSERTs on orders
-- Only allow orders if session is 'active' OR device is authorized
-- (This requires row-level security to be enabled on pos_orders)
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow orders for active sessions or authorized devices" ON pos_orders FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM pos_sessions s
            WHERE s.id = pos_session_id
                AND (
                    s.status = 'active'
                    OR (
                        s.status = 'pending_approval'
                        AND (
                            s.device_ids @> to_jsonb(
                                current_setting('request.headers')::json->>'x-device-id'
                            )
                        )
                    )
                )
        )
    );