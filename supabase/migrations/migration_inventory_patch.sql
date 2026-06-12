-- ===========================================
-- ENVANTER MIGRATION PATCH
-- Adds missing columns to existing tables
-- Run this if you get "column does not exist" errors
-- ===========================================

-- Add category column to ingredients if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'category') THEN
        ALTER TABLE ingredients ADD COLUMN category TEXT 
            CHECK (category IN ('meat', 'dairy', 'vegetables', 'spices', 'grains', 'beverages', 'packaging', 'other'));
    END IF;
END $$;

-- Add category column to suppliers if missing  
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'suppliers' AND column_name = 'category') THEN
        ALTER TABLE suppliers ADD COLUMN category TEXT
            CHECK (category IN ('groceries', 'meat', 'dairy', 'beverages', 'packaging', 'other'));
    END IF;
END $$;

-- Add other potentially missing columns to ingredients
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'sku') THEN
        ALTER TABLE ingredients ADD COLUMN sku TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'unit') THEN
        ALTER TABLE ingredients ADD COLUMN unit TEXT NOT NULL DEFAULT 'adet';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'current_stock') THEN
        ALTER TABLE ingredients ADD COLUMN current_stock DECIMAL(12,3) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'min_stock_level') THEN
        ALTER TABLE ingredients ADD COLUMN min_stock_level DECIMAL(12,3) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'cost_per_unit') THEN
        ALTER TABLE ingredients ADD COLUMN cost_per_unit DECIMAL(12,4) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'is_active') THEN
        ALTER TABLE ingredients ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'storage_type') THEN
        ALTER TABLE ingredients ADD COLUMN storage_type TEXT 
            CHECK (storage_type IN ('room', 'refrigerated', 'frozen'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'shelf_life_days') THEN
        ALTER TABLE ingredients ADD COLUMN shelf_life_days INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'max_stock_level') THEN
        ALTER TABLE ingredients ADD COLUMN max_stock_level DECIMAL(12,3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'last_purchase_price') THEN
        ALTER TABLE ingredients ADD COLUMN last_purchase_price DECIMAL(12,4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'last_purchase_date') THEN
        ALTER TABLE ingredients ADD COLUMN last_purchase_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ingredients' AND column_name = 'default_supplier_id') THEN
        ALTER TABLE ingredients ADD COLUMN default_supplier_id UUID REFERENCES suppliers(id);
    END IF;
END $$;

-- Now recreate the view (DROP if exists first)
DROP VIEW IF EXISTS low_stock_alerts;

CREATE VIEW low_stock_alerts AS
SELECT 
    i.id,
    i.tenant_id,
    i.name,
    i.category,
    i.current_stock,
    i.min_stock_level,
    i.unit,
    i.current_stock - i.min_stock_level as stock_difference,
    CASE 
        WHEN i.current_stock <= 0 THEN 'out_of_stock'
        WHEN i.current_stock <= i.min_stock_level THEN 'critical'
        WHEN i.current_stock <= i.min_stock_level * 1.5 THEN 'warning'
        ELSE 'ok'
    END as alert_level,
    s.name as supplier_name,
    s.phone as supplier_phone
FROM ingredients i
LEFT JOIN suppliers s ON s.id = i.default_supplier_id
WHERE i.is_active = true
  AND i.current_stock <= i.min_stock_level * 1.5
ORDER BY 
    CASE 
        WHEN i.current_stock <= 0 THEN 1
        WHEN i.current_stock <= i.min_stock_level THEN 2
        ELSE 3
    END,
    i.current_stock ASC;

-- Grant access to view
GRANT SELECT ON low_stock_alerts TO authenticated;

-- Recreate trigger if not exists
DROP TRIGGER IF EXISTS trigger_deduct_stock_on_order ON pos_orders;

CREATE OR REPLACE FUNCTION deduct_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
    recipe_row RECORD;
BEGIN
    IF NEW.status IN ('completed', 'delivered') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
        FOR recipe_row IN 
            SELECT r.ingredient_id, r.quantity * oi.quantity as total_qty, r.unit, i.current_stock, i.name
            FROM pos_order_items oi
            JOIN recipes r ON r.menu_item_id = oi.product_id AND r.tenant_id = NEW.tenant_id
            JOIN ingredients i ON i.id = r.ingredient_id
            WHERE oi.pos_order_id = NEW.id
        LOOP
            UPDATE ingredients 
            SET current_stock = current_stock - recipe_row.total_qty,
                updated_at = NOW()
            WHERE id = recipe_row.ingredient_id;

            INSERT INTO inventory_transactions (
                tenant_id, ingredient_id, transaction_type, quantity, unit,
                reference_type, reference_id, stock_before, stock_after, description
            ) VALUES (
                NEW.tenant_id,
                recipe_row.ingredient_id,
                'sale',
                -recipe_row.total_qty,
                recipe_row.unit,
                'order',
                NEW.id,
                recipe_row.current_stock,
                recipe_row.current_stock - recipe_row.total_qty,
                'Otomatik stok düşümü - Sipariş #' || NEW.id::text
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deduct_stock_on_order
    AFTER UPDATE ON pos_orders
    FOR EACH ROW
    EXECUTE FUNCTION deduct_stock_on_order();
