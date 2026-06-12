-- 1. Reseller Tiers & Iyzico
DO $$ BEGIN
    CREATE TYPE reseller_tier AS ENUM ('bronze', 'silver', 'gold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.resellers 
ADD COLUMN IF NOT EXISTS tier reseller_tier DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS sub_merchant_key TEXT, -- Iyzico Sub-merchant ID
ADD COLUMN IF NOT EXISTS tenant_count INT DEFAULT 0, -- For auto-promotion
ADD COLUMN IF NOT EXISTS approved_contract BOOLEAN DEFAULT FALSE; -- Digital Signature

-- 2. Customers Table (CRM & Security)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone TEXT NOT NULL, -- The main identifier
    name TEXT,
    
    -- Permission Marketing
    kvkk_consent BOOLEAN DEFAULT FALSE,
    kvkk_consent_date TIMESTAMP WITH TIME ZONE,
    birth_date DATE,
    
    -- Security (Anti-Troll)
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    
    UNIQUE(tenant_id, phone) -- A customer is unique PER restaurant
);

-- Enable RLS for Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.customers;
CREATE POLICY "Public Access" ON public.customers FOR ALL USING (true); -- Simplify for now

-- 3. Update Commission Logic to Respect Tiers
CREATE OR REPLACE FUNCTION public.handle_subscription_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_reseller_id UUID;
    v_tier reseller_tier;
    v_commission_rate NUMERIC;
    v_commission_amount NUMERIC;
BEGIN
    -- Proceed if it is Subscription OR One-Time Payment (Credit)
    IF (NEW.type = 'subscription_payment' OR NEW.type = 'one_time_payment') AND NEW.direction = 'credit' AND NEW.tenant_id IS NOT NULL THEN
        
        -- Check if tenant has a reseller
        SELECT reseller_id INTO v_reseller_id FROM public.tenants WHERE id = NEW.tenant_id;
        
        IF v_reseller_id IS NOT NULL THEN
            -- Get Reseller Tier & Commission Rate
            SELECT tier, commission_rate INTO v_tier, v_commission_rate FROM public.resellers WHERE id = v_reseller_id;
            
            -- TIER LOGIC OVERRIDE
            -- Bronze: 100% One-time, 10% Recurring
            -- Silver: 30% Recurring
            -- Gold: Manual (Uses commission_rate set in DB)
            
            IF v_tier = 'bronze' THEN
                IF NEW.type = 'one_time_payment' THEN
                    v_commission_rate := 100.0; -- Full Setup Fee
                ELSE
                    v_commission_rate := 10.0; -- Low Recurring
                END IF;
            ELSIF v_tier = 'silver' THEN
                 IF NEW.type = 'one_time_payment' THEN
                    v_commission_rate := 0.0; -- Usually free/low setup
                ELSE
                    v_commission_rate := 30.0; -- High Recurring
                END IF;
            END IF;
            -- Gold uses the default 'v_commission_rate' already in the DB columns
            
            -- Calculate Amount
            v_commission_amount := (NEW.amount * v_commission_rate) / 100;
            
            -- Insert Commission
            IF v_commission_amount > 0 THEN
                INSERT INTO public.ledger (
                    tenant_id,
                    reseller_id,
                    type,
                    amount,
                    direction,
                    description,
                    status
                ) VALUES (
                    NEW.tenant_id,
                    v_reseller_id,
                    'reseller_commission',
                    v_commission_amount,
                    'credit', 
                    'Komisyon (' || v_tier || ' - ' || (CASE WHEN NEW.type='one_time_payment' THEN 'Satış' ELSE 'Abonelik' END) || '): ' || NEW.description,
                    'paid'
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
