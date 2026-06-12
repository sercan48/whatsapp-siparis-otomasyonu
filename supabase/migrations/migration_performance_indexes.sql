-- PERFORMANCE INDEXES MIGRATION
-- Goal: Optimize query speed for high-traffic tables (Orders, Sessions)
-- UPDATED: Added safety checks for table existence
-- 1. POS ORDERS
DO $$ BEGIN IF EXISTS (
    SELECT
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename = 'pos_orders'
) THEN CREATE INDEX IF NOT EXISTS idx_pos_orders_tenant_status ON public.pos_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_created_at ON public.pos_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_orders_session_id ON public.pos_orders(pos_session_id);
END IF;
END $$;
-- 2. POS ORDER ITEMS
DO $$ BEGIN IF EXISTS (
    SELECT
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename = 'pos_order_items'
) THEN CREATE INDEX IF NOT EXISTS idx_pos_items_order_id ON public.pos_order_items(pos_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_product_id ON public.pos_order_items(product_id);
END IF;
END $$;
-- 3. POS SESSIONS
DO $$ BEGIN IF EXISTS (
    SELECT
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename = 'pos_sessions'
) THEN CREATE INDEX IF NOT EXISTS idx_pos_sessions_table_status ON public.pos_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_tenant_active ON public.pos_sessions(tenant_id)
WHERE status = 'active';
END IF;
END $$;
-- 4. INVENTORY TRANSACTIONS
DO $$ BEGIN IF EXISTS (
    SELECT
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename = 'inventory_transactions'
) THEN CREATE INDEX IF NOT EXISTS idx_inv_trans_tenant_date ON public.inventory_transactions(tenant_id, created_at DESC);
END IF;
END $$;
-- 5. COURIER LOGS (Deliveries)
DO $$ BEGIN IF EXISTS (
    SELECT
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename = 'deliveries'
) THEN CREATE INDEX IF NOT EXISTS idx_deliveries_courier_status ON public.deliveries(courier_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_status ON public.deliveries(tenant_id, status);
END IF;
END $$;