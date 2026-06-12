-- ===========================================
-- ENVANTER VE REÇETE SİSTEMİ MIGRATION
-- Ingredients, Recipes, Inventory Transactions, Suppliers
-- ===========================================

-- 1. TEDARİKÇİLER
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Tedarikçi Bilgileri
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    
    -- Ödeme Bilgileri
    payment_terms TEXT, -- '30 gün vadeli', 'peşin', etc.
    bank_account TEXT,
    tax_number TEXT,
    
    -- Kategori
    category TEXT CHECK (category IN ('groceries', 'meat', 'dairy', 'beverages', 'packaging', 'other')),
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- 2. HAMMADDELER (İNGREDİENTS)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Hammadde Bilgileri
    name TEXT NOT NULL,
    sku TEXT, -- Stok Kodu
    category TEXT CHECK (category IN ('meat', 'dairy', 'vegetables', 'spices', 'grains', 'beverages', 'packaging', 'other')),
    
    -- Birim ve Stok
    unit TEXT NOT NULL DEFAULT 'adet' CHECK (unit IN ('kg', 'g', 'lt', 'ml', 'adet', 'porsiyon', 'kutu', 'paket')),
    current_stock DECIMAL(12,3) DEFAULT 0,
    min_stock_level DECIMAL(12,3) DEFAULT 0, -- Kritik stok seviyesi
    max_stock_level DECIMAL(12,3), -- Maksimum stok (isteğe bağlı)
    
    -- Maliyet
    cost_per_unit DECIMAL(12,4) DEFAULT 0, -- Birim maliyet
    last_purchase_price DECIMAL(12,4), -- Son alış fiyatı
    last_purchase_date DATE,
    
    -- Tedarikçi
    default_supplier_id UUID REFERENCES suppliers(id),
    
    -- Raf Ömrü
    shelf_life_days INTEGER, -- Raf ömrü (gün)
    storage_type TEXT CHECK (storage_type IN ('room', 'refrigerated', 'frozen')),
    
    -- Durum
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REÇETELER (Menu Item <-> Ingredient Mapping)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Bağlantılar
    menu_item_id UUID NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    
    -- Miktar
    quantity DECIMAL(12,4) NOT NULL, -- Bu üründe ne kadar kullanılıyor
    unit TEXT NOT NULL, -- Birimi (genelde ingredient ile aynı)
    
    -- Notlar
    notes TEXT, -- 'Sossa kullanılır', 'Garnitür', etc.
    is_optional BOOLEAN DEFAULT false, -- Opsiyonel mi (ekstra malzeme)
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, menu_item_id, ingredient_id)
);

-- 4. STOK HAREKETLERİ
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    
    -- İşlem Tipi
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'purchase',      -- Satın alma (giriş)
        'sale',          -- Satış (sipariş ile düşüm)
        'waste',         -- Fire/Hurda
        'adjustment',    -- Manuel düzeltme
        'transfer_in',   -- Transfer giriş
        'transfer_out',  -- Transfer çıkış
        'return'         -- Tedarikçiye iade
    )),
    
    -- Miktar (+ giriş, - çıkış)
    quantity DECIMAL(12,4) NOT NULL,
    unit TEXT NOT NULL,
    
    -- Maliyet
    unit_cost DECIMAL(12,4),
    total_cost DECIMAL(12,4),
    
    -- Referans
    reference_type TEXT CHECK (reference_type IN ('order', 'purchase_order', 'manual', 'system')),
    reference_id UUID, -- Sipariş ID veya Satın Alma ID
    supplier_id UUID REFERENCES suppliers(id),
    
    -- Stok Durumu
    stock_before DECIMAL(12,3),
    stock_after DECIMAL(12,3),
    
    -- Açıklama
    description TEXT,
    batch_number TEXT, -- Parti numarası
    expiry_date DATE, -- Son kullanma tarihi
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 5. SATIN ALMA SİPARİŞLERİ (Purchase Orders)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Tedarikçi
    supplier_id UUID REFERENCES suppliers(id),
    
    -- Sipariş Detayları
    order_number TEXT,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    
    -- Tutar
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Durum
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'delivered', 'cancelled')),
    
    -- Notlar
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 6. SATIN ALMA KALEMLERİ
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    
    quantity DECIMAL(12,4) NOT NULL,
    unit TEXT NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    total_price DECIMAL(12,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    
    received_quantity DECIMAL(12,4) DEFAULT 0,
    notes TEXT
);

-- ============================
-- INDEXES
-- ============================
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON ingredients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_stock ON ingredients(current_stock);

CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON recipes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient ON recipes(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_inv_tx_tenant ON inventory_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_ingredient ON inventory_transactions(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_date ON inventory_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- ============================
-- ROW LEVEL SECURITY
-- ============================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant isolation for suppliers" ON suppliers
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for ingredients" ON ingredients
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for recipes" ON recipes
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for inventory_transactions" ON inventory_transactions
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for purchase_orders" ON purchase_orders
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for purchase_order_items" ON purchase_order_items
    FOR ALL USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE tenant_id = auth.uid()));

-- Grant permissions
GRANT ALL ON suppliers TO authenticated;
GRANT ALL ON ingredients TO authenticated;
GRANT ALL ON recipes TO authenticated;
GRANT ALL ON inventory_transactions TO authenticated;
GRANT ALL ON purchase_orders TO authenticated;
GRANT ALL ON purchase_order_items TO authenticated;

-- ============================
-- TRIGGERS: Sipariş ile Stok Düşümü
-- ============================

-- Function: Sipariş tamamlandığında stok düş
CREATE OR REPLACE FUNCTION deduct_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
    recipe_row RECORD;
    current_ingredient_stock DECIMAL;
BEGIN
    -- Sadece 'completed' veya 'delivered' durumuna geçişte çalış
    IF NEW.status IN ('completed', 'delivered') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
        -- Bu siparişin ürünleri için reçeteleri bul
        FOR recipe_row IN 
            SELECT r.ingredient_id, r.quantity * oi.quantity as total_qty, r.unit, i.current_stock, i.name
            FROM pos_order_items oi
            JOIN recipes r ON r.menu_item_id = oi.product_id AND r.tenant_id = NEW.tenant_id
            JOIN ingredients i ON i.id = r.ingredient_id
            WHERE oi.pos_order_id = NEW.id
        LOOP
            -- Stok düş
            UPDATE ingredients 
            SET current_stock = current_stock - recipe_row.total_qty,
                updated_at = NOW()
            WHERE id = recipe_row.ingredient_id;

            -- Stok hareketi kaydet
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

-- Trigger on pos_orders
CREATE TRIGGER trigger_deduct_stock_on_order
    AFTER UPDATE ON pos_orders
    FOR EACH ROW
    EXECUTE FUNCTION deduct_stock_on_order();

-- ============================
-- VIEW: Kritik Stok Uyarıları
-- ============================
CREATE OR REPLACE VIEW low_stock_alerts AS
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

-- ============================
-- COMMENTS
-- ============================
COMMENT ON TABLE suppliers IS 'Tedarikçi bilgileri ve iletişim';
COMMENT ON TABLE ingredients IS 'Hammadde listesi ve stok seviyeleri';
COMMENT ON TABLE recipes IS 'Menü ürünleri ile hammadde ilişkisi';
COMMENT ON TABLE inventory_transactions IS 'Stok giriş/çıkış hareketleri';
COMMENT ON TABLE purchase_orders IS 'Tedarikçiye satın alma siparişleri';
COMMENT ON VIEW low_stock_alerts IS 'Kritik stok seviyesindeki hammaddeler';
