-- =====================================================
-- AI Credits System Migration
-- Free: 5 images/month, Extra: Charged per image
-- =====================================================

-- AI Credits table for tenant credit balance
CREATE TABLE IF NOT EXISTS ai_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    
    -- Monthly free credits
    monthly_free_credits INTEGER DEFAULT 5,
    used_free_credits INTEGER DEFAULT 0,
    
    -- Paid credits (purchased or extra usage)
    paid_credits_balance DECIMAL(10,2) DEFAULT 0,
    
    -- Pricing
    price_per_image DECIMAL(10,2) DEFAULT 3.00, -- 3₺ per extra image
    
    -- Reset tracking
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage Logs for tracking each generation
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Generation details
    prompt TEXT NOT NULL,
    image_url TEXT,
    format VARCHAR(20), -- story, post
    campaign_type VARCHAR(50),
    product_name VARCHAR(255),
    
    -- Provider info
    provider VARCHAR(50), -- openai, replicate, fal
    model VARCHAR(100),
    
    -- Cost tracking
    credit_type VARCHAR(20) NOT NULL, -- free, paid
    cost DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly billing for AI usage
CREATE TABLE IF NOT EXISTS ai_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Usage summary
    free_images_used INTEGER DEFAULT 0,
    paid_images_used INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Billing status
    status VARCHAR(20) DEFAULT 'pending', -- pending, invoiced, paid
    invoice_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_credits_tenant ON ai_credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant ON ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_billing_tenant ON ai_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_billing_period ON ai_billing(billing_period_start, billing_period_end);

-- RLS
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own AI credits" ON ai_credits
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants view own AI usage" ON ai_usage_logs
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants view own AI billing" ON ai_billing
    FOR ALL USING (tenant_id = auth.uid());

-- Function to check and use credits
CREATE OR REPLACE FUNCTION use_ai_credit(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    v_credits ai_credits%ROWTYPE;
    v_result JSON;
    v_credit_type VARCHAR(20);
    v_cost DECIMAL(10,2);
BEGIN
    -- Get or create credits record
    SELECT * INTO v_credits FROM ai_credits WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        INSERT INTO ai_credits (tenant_id) VALUES (p_tenant_id)
        RETURNING * INTO v_credits;
    END IF;
    
    -- Reset monthly credits if new month
    IF DATE_TRUNC('month', v_credits.last_reset_at) < DATE_TRUNC('month', NOW()) THEN
        UPDATE ai_credits SET 
            used_free_credits = 0, 
            last_reset_at = NOW()
        WHERE tenant_id = p_tenant_id;
        v_credits.used_free_credits := 0;
    END IF;
    
    -- Check if free credits available
    IF v_credits.used_free_credits < v_credits.monthly_free_credits THEN
        -- Use free credit
        UPDATE ai_credits SET 
            used_free_credits = used_free_credits + 1,
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id;
        
        v_credit_type := 'free';
        v_cost := 0;
    ELSE
        -- Use paid credit
        v_cost := v_credits.price_per_image;
        
        UPDATE ai_credits SET 
            paid_credits_balance = paid_credits_balance + v_cost,
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id;
        
        v_credit_type := 'paid';
    END IF;
    
    v_result := json_build_object(
        'success', true,
        'credit_type', v_credit_type,
        'cost', v_cost,
        'remaining_free', v_credits.monthly_free_credits - v_credits.used_free_credits - 
            CASE WHEN v_credit_type = 'free' THEN 1 ELSE 0 END,
        'total_due', v_credits.paid_credits_balance + 
            CASE WHEN v_credit_type = 'paid' THEN v_cost ELSE 0 END
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get credit status
CREATE OR REPLACE FUNCTION get_ai_credit_status(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    v_credits ai_credits%ROWTYPE;
BEGIN
    SELECT * INTO v_credits FROM ai_credits WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        INSERT INTO ai_credits (tenant_id) VALUES (p_tenant_id)
        RETURNING * INTO v_credits;
    END IF;
    
    -- Reset if new month
    IF DATE_TRUNC('month', v_credits.last_reset_at) < DATE_TRUNC('month', NOW()) THEN
        UPDATE ai_credits SET 
            used_free_credits = 0, 
            last_reset_at = NOW()
        WHERE tenant_id = p_tenant_id
        RETURNING * INTO v_credits;
    END IF;
    
    RETURN json_build_object(
        'monthly_free', v_credits.monthly_free_credits,
        'used_free', v_credits.used_free_credits,
        'remaining_free', v_credits.monthly_free_credits - v_credits.used_free_credits,
        'price_per_image', v_credits.price_per_image,
        'total_due', v_credits.paid_credits_balance,
        'last_reset', v_credits.last_reset_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update billing monthly
CREATE OR REPLACE FUNCTION update_ai_billing()
RETURNS TRIGGER AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    v_period_start := DATE_TRUNC('month', NEW.created_at)::DATE;
    v_period_end := (DATE_TRUNC('month', NEW.created_at) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    INSERT INTO ai_billing (tenant_id, billing_period_start, billing_period_end, free_images_used, paid_images_used, total_cost)
    VALUES (NEW.tenant_id, v_period_start, v_period_end, 
            CASE WHEN NEW.credit_type = 'free' THEN 1 ELSE 0 END,
            CASE WHEN NEW.credit_type = 'paid' THEN 1 ELSE 0 END,
            NEW.cost)
    ON CONFLICT (tenant_id, billing_period_start, billing_period_end)
    DO UPDATE SET
        free_images_used = ai_billing.free_images_used + CASE WHEN NEW.credit_type = 'free' THEN 1 ELSE 0 END,
        paid_images_used = ai_billing.paid_images_used + CASE WHEN NEW.credit_type = 'paid' THEN 1 ELSE 0 END,
        total_cost = ai_billing.total_cost + NEW.cost;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for billing periods
ALTER TABLE ai_billing ADD CONSTRAINT ai_billing_unique_period 
    UNIQUE (tenant_id, billing_period_start, billing_period_end);

-- Trigger to execute update_ai_billing on new usage log
DROP TRIGGER IF EXISTS trigger_update_ai_billing ON ai_usage_logs;
CREATE TRIGGER trigger_update_ai_billing
    AFTER INSERT ON ai_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_billing();
