-- Add pin_code to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pin_code TEXT;
-- Enable Admin to UPDATE other profiles (for Role Switching)
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR
UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role = 'admin'
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role = 'admin'
        )
    );
-- Enable Admin to SELECT all profiles (to list them)
-- (Existing policies might already cover this, but ensuring it here)
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role = 'admin'
        )
    );