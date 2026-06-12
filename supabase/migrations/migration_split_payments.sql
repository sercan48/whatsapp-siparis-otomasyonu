-- Split Payment System Migration
-- Tracks partial payments for split bill functionality

-- Table for recording partial/split payments
CREATE TABLE IF NOT EXISTS partial_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES pos_sessions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'credit_card', 'meal_voucher')),
    items JSONB DEFAULT '[]', -- Array of item objects included in this payment
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups by session
CREATE INDEX IF NOT EXISTS idx_partial_payments_session ON partial_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_partial_payments_tenant ON partial_payments(tenant_id);

-- Add paid_amount column to pos_sessions to track running total
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0;

-- Enable RLS
ALTER TABLE partial_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tenant's partial payments
CREATE POLICY "Tenant isolation for partial_payments" ON partial_payments
    FOR ALL USING (tenant_id = auth.uid());

-- Grant permissions
GRANT ALL ON partial_payments TO authenticated;

COMMENT ON TABLE partial_payments IS 'Stores individual partial payments for split bill transactions';
COMMENT ON COLUMN partial_payments.items IS 'JSON array of items covered by this payment: [{id, name, price, quantity}]';
