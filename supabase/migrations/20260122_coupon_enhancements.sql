-- =====================================================
-- Enhancement: Coupon System Improvements
-- Date: 2026-01-22
-- =====================================================
-- 1. Add single_use_per_session to coupons
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS single_use_per_session boolean DEFAULT true;
-- 2. Add allow_coupon to menu items (if not exists)
ALTER TABLE public.menu
ADD COLUMN IF NOT EXISTS allow_coupon boolean DEFAULT true;
-- 3. Comment: Frontend should check product.allow_coupon before applying discount
-- TODO: Update validate_coupon RPC to accept product IDs and check allow_coupon