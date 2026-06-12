-- Create a table for potential reseller leads/applications
CREATE TABLE IF NOT EXISTS public.reseller_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT,
    status TEXT DEFAULT 'pending' -- pending, approved, rejected
);

-- Enable RLS
ALTER TABLE public.reseller_applications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for public landing page)
CREATE POLICY "Allow anonymous inserts" ON public.reseller_applications FOR INSERT WITH CHECK (true);

-- Allow admins to read/update
CREATE POLICY "Allow full access for authenticated" ON public.reseller_applications FOR ALL USING (true) WITH CHECK (true);
