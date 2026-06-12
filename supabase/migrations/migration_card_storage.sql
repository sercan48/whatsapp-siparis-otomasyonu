-- =====================================================
-- Card Storage (Tokenization) Migration
-- Supports: Masterpass, BKM Express, Iyzico card storage
-- =====================================================

-- Stored Cards Table
CREATE TABLE IF NOT EXISTS stored_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL, -- Reference to customers table
    
    -- Card Information (tokenized)
    card_token VARCHAR(255) NOT NULL, -- Provider-specific token
    card_alias VARCHAR(100), -- User-friendly name like "İş Bankası ****1234"
    
    -- Card Display Info (safe to store)
    card_type VARCHAR(20), -- VISA, MASTERCARD, TROY, etc.
    last_four VARCHAR(4),
    expiry_month VARCHAR(2),
    expiry_year VARCHAR(4),
    card_holder_name VARCHAR(255),
    
    -- Provider Info
    provider VARCHAR(30) NOT NULL, -- iyzico, masterpass, bkm_express
    provider_card_id VARCHAR(255), -- External card ID from provider
    
    -- Status
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, customer_id, card_token)
);

-- Card Storage Consent Log
CREATE TABLE IF NOT EXISTS card_storage_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    
    -- Consent Details
    consent_given BOOLEAN NOT NULL,
    consent_text TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One-Click Payment Transactions
CREATE TABLE IF NOT EXISTS one_click_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    stored_card_id UUID REFERENCES stored_cards(id) ON DELETE SET NULL,
    transaction_id UUID, -- Reference to payment_transactions
    order_id UUID,
    
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY',
    
    status VARCHAR(30) DEFAULT 'pending', -- pending, success, failed
    
    -- Provider Response
    provider_transaction_id VARCHAR(255),
    error_code VARCHAR(50),
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update payment_settings table to include new providers
DO $$
BEGIN
    -- Add Masterpass columns if not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'masterpass_enabled') THEN
        ALTER TABLE payment_settings ADD COLUMN masterpass_enabled BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'masterpass_merchant_id') THEN
        ALTER TABLE payment_settings ADD COLUMN masterpass_merchant_id VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'masterpass_token') THEN
        ALTER TABLE payment_settings ADD COLUMN masterpass_token VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'masterpass_sandbox') THEN
        ALTER TABLE payment_settings ADD COLUMN masterpass_sandbox BOOLEAN DEFAULT true;
    END IF;

    -- Add BKM Express columns if not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bkm_express_enabled') THEN
        ALTER TABLE payment_settings ADD COLUMN bkm_express_enabled BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bkm_express_merchant_id') THEN
        ALTER TABLE payment_settings ADD COLUMN bkm_express_merchant_id VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bkm_express_private_key') THEN
        ALTER TABLE payment_settings ADD COLUMN bkm_express_private_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bkm_express_sandbox') THEN
        ALTER TABLE payment_settings ADD COLUMN bkm_express_sandbox BOOLEAN DEFAULT true;
    END IF;

    -- Add card storage settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'card_storage_enabled') THEN
        ALTER TABLE payment_settings ADD COLUMN card_storage_enabled BOOLEAN DEFAULT true;
    END IF;

    -- Remove Shopier columns if exist (optional, commented out for safety)
    -- ALTER TABLE payment_settings DROP COLUMN IF EXISTS shopier_enabled;
    -- ALTER TABLE payment_settings DROP COLUMN IF EXISTS shopier_api_key;
    -- ALTER TABLE payment_settings DROP COLUMN IF EXISTS shopier_api_secret;
    -- ALTER TABLE payment_settings DROP COLUMN IF EXISTS shopier_sandbox;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stored_cards_customer ON stored_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_stored_cards_tenant ON stored_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_one_click_payments_card ON one_click_payments(stored_card_id);

-- RLS Policies
ALTER TABLE stored_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_storage_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_click_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own stored cards" ON stored_cards
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can view own consents" ON card_storage_consents
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Anyone can insert consent" ON card_storage_consents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Tenants can manage own one-click payments" ON one_click_payments
    FOR ALL USING (tenant_id = auth.uid());

-- Function to delete old/expired cards
CREATE OR REPLACE FUNCTION cleanup_expired_cards()
RETURNS void AS $$
BEGIN
    UPDATE stored_cards
    SET is_active = false
    WHERE is_active = true
    AND (
        (expiry_year::integer < EXTRACT(YEAR FROM NOW())) OR
        (expiry_year::integer = EXTRACT(YEAR FROM NOW()) AND expiry_month::integer < EXTRACT(MONTH FROM NOW()))
    );
END;
$$ LANGUAGE plpgsql;
