-- 1. Create Resellers Table
CREATE TABLE IF NOT EXISTS public.resellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE, -- e.g. IST-AHMET
    commission_rate NUMERIC(5, 2) DEFAULT 20.00, -- Percentage (e.g. 20%)
    contact_info TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS for Resellers
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for all" ON public.resellers FOR ALL USING (true) WITH CHECK (true);


-- 2. Update Tenants Table to link with Resellers
DO $$
BEGIN
    -- Add reseller_id FK
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'reseller_id') THEN
        ALTER TABLE public.tenants ADD COLUMN reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;
    END IF;

    -- Add Subscription Fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'subscription_fee') THEN
        ALTER TABLE public.tenants ADD COLUMN subscription_fee NUMERIC(10, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'next_billing_date') THEN
        ALTER TABLE public.tenants ADD COLUMN next_billing_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
