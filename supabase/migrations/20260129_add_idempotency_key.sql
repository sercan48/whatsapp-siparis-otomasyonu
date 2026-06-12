-- =====================================================
-- SECURITY HARDENING - Idempotency Key Support
-- Migration: 20260129_add_idempotency_key.sql
-- Purpose: Prevent double payments and duplicate orders
-- =====================================================
-- 1. Add idempotency_key column to payment_transactions
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
-- Create unique index (allows NULL values, enforces uniqueness for non-NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_idempotency ON payment_transactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;
-- Add comment for documentation
COMMENT ON COLUMN payment_transactions.idempotency_key IS 'Unique key to prevent duplicate payment transactions. Format: {timestamp}-{random}';
-- 2. Add idempotency_key column to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;
COMMENT ON COLUMN orders.idempotency_key IS 'Unique key to prevent duplicate order submissions. Format: {timestamp}-{random}';
-- 3. Add idempotency_key column to pos_orders
ALTER TABLE pos_orders
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_orders_idempotency ON pos_orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;
COMMENT ON COLUMN pos_orders.idempotency_key IS 'Unique key to prevent duplicate POS order submissions. Format: {timestamp}-{random}';
-- =====================================================
-- VALIDATION
-- =====================================================
-- Run after migration to verify:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'payment_transactions' AND column_name = 'idempotency_key';