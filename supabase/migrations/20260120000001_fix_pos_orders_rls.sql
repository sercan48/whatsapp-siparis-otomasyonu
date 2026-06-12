-- Migration: Fix pos_orders RLS for QR Menu Orders
-- Run this in Supabase SQL Editor
-- 1. Check existing policies
-- SELECT policyname FROM pg_policies WHERE tablename = 'pos_orders';
-- 2. Drop potentially problematic policies
DROP POLICY IF EXISTS "Anon can create orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Public can create orders" ON public.pos_orders;
-- 3. Create policy for QR menu orders (anon users can insert)
CREATE POLICY "Anon can insert QR orders" ON public.pos_orders FOR
INSERT TO anon WITH CHECK (order_source = 'qr_menu');
-- 4. Create policy for authenticated users (full access to their tenant)
CREATE POLICY "Users can manage tenant orders" ON public.pos_orders FOR ALL TO authenticated USING (
    tenant_id IN (
        SELECT tenant_id
        FROM public.profiles
        WHERE id = auth.uid()
    )
);
-- 5. Anon can read their own orders (for order confirmation)
CREATE POLICY "Anon can read qr orders" ON public.pos_orders FOR
SELECT TO anon USING (order_source = 'qr_menu');
-- 6. Same for pos_order_items
DROP POLICY IF EXISTS "Anon can insert order items" ON public.pos_order_items;
CREATE POLICY "Anon can insert qr order items" ON public.pos_order_items FOR
INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can read qr order items" ON public.pos_order_items FOR
SELECT TO anon USING (true);
-- 7. Ensure RLS is enabled
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;