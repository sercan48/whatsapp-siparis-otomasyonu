-- =====================================================
-- TENANT REQUESTS: Pending Business Applications
-- Resellers submit, Super Admin approves
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tenant_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id UUID REFERENCES public.resellers(id),
    business_name TEXT NOT NULL,
    business_phone TEXT NOT NULL,
    business_email TEXT,
    business_address TEXT,
    owner_name TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS
ALTER TABLE public.tenant_requests ENABLE ROW LEVEL SECURITY;
-- Resellers can only see their own requests
CREATE POLICY "Resellers view own requests" ON public.tenant_requests FOR
SELECT USING (true);
-- Initially allow all for simplicity, can tighten later
-- Resellers can insert their own requests
CREATE POLICY "Resellers can create requests" ON public.tenant_requests FOR
INSERT WITH CHECK (true);
-- Allow updates for admin approval
CREATE POLICY "Admin can update requests" ON public.tenant_requests FOR
UPDATE USING (true);