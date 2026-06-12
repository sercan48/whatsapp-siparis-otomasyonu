-- ===========================================
-- GÜVENLİK MİGRATION
-- Super Admins, Login Audit, Rate Limiting
-- ===========================================

-- 1. SUPER ADMINS WHITELIST
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    last_login TIMESTAMPTZ
);

-- Insert initial super admin (YOU MUST CHANGE THIS!)
-- IMPORTANT: Use a real Supabase Auth user email
INSERT INTO super_admins (email, name, role, is_active) VALUES
('admin@yourdomain.com', 'System Admin', 'super_admin', true)
ON CONFLICT (email) DO NOTHING;

-- 2. ADMIN LOGIN AUDIT
CREATE TABLE IF NOT EXISTS admin_login_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    admin_id UUID REFERENCES super_admins(id),
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit
CREATE INDEX IF NOT EXISTS idx_audit_email ON admin_login_audit(email);
CREATE INDEX IF NOT EXISTS idx_audit_date ON admin_login_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_success ON admin_login_audit(success);

-- 3. LOGIN RATE LIMITING (IP-based tracking)
CREATE TABLE IF NOT EXISTS login_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- email or IP
    attempt_count INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    last_attempt TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    UNIQUE(identifier)
);

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION check_login_rate_limit(p_identifier TEXT, p_max_attempts INTEGER DEFAULT 5, p_block_minutes INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
DECLARE
    v_record login_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Get or create rate limit record
    SELECT * INTO v_record FROM login_rate_limits WHERE identifier = p_identifier;
    
    IF v_record IS NULL THEN
        -- First attempt
        INSERT INTO login_rate_limits (identifier, attempt_count, first_attempt, last_attempt)
        VALUES (p_identifier, 1, v_now, v_now);
        RETURN TRUE;
    END IF;
    
    -- Check if blocked
    IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
        RETURN FALSE;
    END IF;
    
    -- Reset if last attempt was more than block_minutes ago
    IF v_record.last_attempt < v_now - (p_block_minutes || ' minutes')::interval THEN
        UPDATE login_rate_limits 
        SET attempt_count = 1, first_attempt = v_now, last_attempt = v_now, blocked_until = NULL
        WHERE identifier = p_identifier;
        RETURN TRUE;
    END IF;
    
    -- Increment attempt
    IF v_record.attempt_count >= p_max_attempts THEN
        UPDATE login_rate_limits 
        SET blocked_until = v_now + (p_block_minutes || ' minutes')::interval, last_attempt = v_now
        WHERE identifier = p_identifier;
        RETURN FALSE;
    END IF;
    
    UPDATE login_rate_limits 
    SET attempt_count = attempt_count + 1, last_attempt = v_now
    WHERE identifier = p_identifier;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SESSION SECURITY (Optional - for tracking active sessions)
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type TEXT CHECK (user_type IN ('tenant', 'reseller', 'admin', 'courier')),
    session_token TEXT,
    ip_address TEXT,
    user_agent TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '24 hours')
);

-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM active_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================
-- ROW LEVEL SECURITY
-- ============================

-- Super admins should not have RLS - they need to be checked before login
-- But we protect the table from public access
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read super_admins (for whitelist check)
CREATE POLICY "Authenticated can check super_admins" ON super_admins
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only super_admins themselves can modify
CREATE POLICY "Super admins can modify" ON super_admins
    FOR ALL USING (email = auth.jwt()->>'email');

-- Audit logs - insert only for authenticated
CREATE POLICY "Insert audit logs" ON admin_login_audit
    FOR INSERT WITH CHECK (true);

-- Rate limits - anyone can check/update their own
CREATE POLICY "Rate limit access" ON login_rate_limits
    FOR ALL USING (true);

-- Active sessions - users can only see their own
CREATE POLICY "Own sessions only" ON active_sessions
    FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT ON super_admins TO authenticated;
GRANT INSERT ON admin_login_audit TO authenticated;
GRANT ALL ON login_rate_limits TO authenticated;
GRANT ALL ON active_sessions TO authenticated;

-- ============================
-- COMMENTS
-- ============================
COMMENT ON TABLE super_admins IS 'Whitelist of users allowed to access admin panel';
COMMENT ON TABLE admin_login_audit IS 'Audit log of all admin login attempts';
COMMENT ON TABLE login_rate_limits IS 'Rate limiting for login attempts';
COMMENT ON TABLE active_sessions IS 'Active user sessions for security tracking';
