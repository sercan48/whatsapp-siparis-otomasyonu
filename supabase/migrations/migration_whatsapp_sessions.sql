-- =====================================================
-- MIGRATION: WhatsApp Conversation Sessions
-- Veritabanı tabanlı session yönetimi
-- =====================================================
-- WhatsApp konuşma durumlarını saklar
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_phone TEXT NOT NULL,
    -- Konuşma durumu
    state TEXT DEFAULT 'idle' CHECK (
        state IN (
            'idle',
            'awaiting_address',
            'awaiting_payment',
            'awaiting_confirmation'
        )
    ),
    -- Bekleyen sipariş (JSONB)
    pending_order JSONB,
    -- Format: {"items": [{"name": "Pizza", "quantity": 2, "price": 120}], "total": 240}
    -- Müşteri bilgileri
    customer_address TEXT,
    customer_name TEXT,
    -- Zaman bilgileri
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
    -- Unique: Her müşteri için tek session
    UNIQUE(tenant_id, customer_phone)
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_tenant ON whatsapp_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_expires ON whatsapp_sessions(expires_at);
-- RLS
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service can manage sessions" ON whatsapp_sessions;
CREATE POLICY "Service can manage sessions" ON whatsapp_sessions FOR ALL WITH CHECK (true);
-- =====================================================
-- HELPER: Get or Create Session
-- =====================================================
CREATE OR REPLACE FUNCTION get_whatsapp_session(
        p_tenant_id UUID,
        p_customer_phone TEXT
    ) RETURNS whatsapp_sessions LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_session whatsapp_sessions;
BEGIN -- Try to get existing non-expired session
SELECT * INTO v_session
FROM whatsapp_sessions
WHERE tenant_id = p_tenant_id
    AND customer_phone = p_customer_phone
    AND expires_at > NOW();
IF v_session.id IS NULL THEN -- Create new session
INSERT INTO whatsapp_sessions (tenant_id, customer_phone, state)
VALUES (p_tenant_id, p_customer_phone, 'idle') ON CONFLICT (tenant_id, customer_phone) DO
UPDATE
SET state = 'idle',
    pending_order = NULL,
    updated_at = NOW(),
    expires_at = NOW() + INTERVAL '2 hours'
RETURNING * INTO v_session;
END IF;
RETURN v_session;
END;
$$;
-- =====================================================
-- HELPER: Update Session
-- =====================================================
CREATE OR REPLACE FUNCTION update_whatsapp_session(
        p_session_id UUID,
        p_state TEXT DEFAULT NULL,
        p_pending_order JSONB DEFAULT NULL,
        p_customer_address TEXT DEFAULT NULL,
        p_customer_name TEXT DEFAULT NULL
    ) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN
UPDATE whatsapp_sessions
SET state = COALESCE(p_state, state),
    pending_order = COALESCE(p_pending_order, pending_order),
    customer_address = COALESCE(p_customer_address, customer_address),
    customer_name = COALESCE(p_customer_name, customer_name),
    updated_at = NOW(),
    expires_at = NOW() + INTERVAL '2 hours'
WHERE id = p_session_id;
END;
$$;
-- =====================================================
-- CLEANUP: Expired sessions (çalıştırılabilir pg_cron ile)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_whatsapp_sessions() RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM whatsapp_sessions
WHERE expires_at < NOW();
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$;
-- GRANTS
GRANT ALL ON whatsapp_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION get_whatsapp_session TO authenticated;
GRANT EXECUTE ON FUNCTION update_whatsapp_session TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_whatsapp_sessions TO authenticated;
COMMENT ON TABLE whatsapp_sessions IS 'Stores WhatsApp conversation state for multi-step order flows';