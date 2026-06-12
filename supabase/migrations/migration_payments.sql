-- =====================================================
-- Payment Gateway Integration Migration
-- Supports: Iyzico, PayTR, Shopier
-- =====================================================

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES pos_orders(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY',
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, success, failed, refunded, cancelled
    provider VARCHAR(20) NOT NULL, -- iyzico, paytr, shopier
    provider_transaction_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    payment_method VARCHAR(30), -- credit_card, debit_card, bkm_express, bank_transfer
    card_brand VARCHAR(20), -- visa, mastercard, amex, troy
    card_last_four VARCHAR(4),
    card_holder_name VARCHAR(255),
    installment INTEGER DEFAULT 1,
    error_code VARCHAR(50),
    error_message TEXT,
    callback_url TEXT,
    return_url TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Settings Table (per tenant)
CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Iyzico Configuration
    iyzico_enabled BOOLEAN DEFAULT false,
    iyzico_api_key VARCHAR(255),
    iyzico_secret_key VARCHAR(255),
    iyzico_sandbox BOOLEAN DEFAULT true,
    
    -- PayTR Configuration
    paytr_enabled BOOLEAN DEFAULT false,
    paytr_merchant_id VARCHAR(255),
    paytr_merchant_key VARCHAR(255),
    paytr_merchant_salt VARCHAR(255),
    paytr_sandbox BOOLEAN DEFAULT true,
    
    -- Shopier Configuration
    shopier_enabled BOOLEAN DEFAULT false,
    shopier_api_key VARCHAR(255),
    shopier_api_secret VARCHAR(255),
    shopier_sandbox BOOLEAN DEFAULT true,
    
    -- General Settings
    default_provider VARCHAR(20) DEFAULT 'iyzico',
    allow_installments BOOLEAN DEFAULT true,
    max_installments INTEGER DEFAULT 12,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refunds Table
CREATE TABLE IF NOT EXISTS payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed
    provider_refund_id VARCHAR(255),
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_transaction ON payment_refunds(transaction_id);

-- RLS Policies
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

-- Tenant can see their own transactions
CREATE POLICY "Tenant can view own transactions" ON payment_transactions
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can insert transactions" ON payment_transactions
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenant can update own transactions" ON payment_transactions
    FOR UPDATE USING (tenant_id = auth.uid());

-- Tenant payment settings
CREATE POLICY "Tenant can view own payment settings" ON payment_settings
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenant can manage own payment settings" ON payment_settings
    FOR ALL USING (tenant_id = auth.uid());

-- Refunds access
CREATE POLICY "Tenant can view own refunds" ON payment_refunds
    FOR SELECT USING (
        transaction_id IN (
            SELECT id FROM payment_transactions WHERE tenant_id = auth.uid()
        )
    );

CREATE POLICY "Tenant can create refunds" ON payment_refunds
    FOR INSERT WITH CHECK (
        transaction_id IN (
            SELECT id FROM payment_transactions WHERE tenant_id = auth.uid()
        )
    );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

CREATE TRIGGER payment_settings_updated_at
    BEFORE UPDATE ON payment_settings
    FOR EACH ROW EXECUTE FUNCTION update_payment_updated_at();

-- Add online_payment column to pos_orders if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pos_orders' AND column_name = 'payment_transaction_id'
    ) THEN
        ALTER TABLE pos_orders ADD COLUMN payment_transaction_id UUID REFERENCES payment_transactions(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pos_orders' AND column_name = 'is_paid_online'
    ) THEN
        ALTER TABLE pos_orders ADD COLUMN is_paid_online BOOLEAN DEFAULT false;
    END IF;
END $$;
