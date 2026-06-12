-- ===========================================
-- MUHASEBE SİSTEMİ MIGRATION
-- Couriers, Ledger, Kurye Hesapları, Kasa Hareketleri
-- ===========================================

-- 0. COURIERS (Kurye Tablosu) - Önce bu oluşturulmalı
CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    vehicle_type TEXT CHECK (vehicle_type IN ('motorcycle', 'bicycle', 'car', 'walking')),
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'break')),
    current_location JSONB, -- {lat, lng}
    delivery_fee DECIMAL(10,2) DEFAULT 10.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courier indexes
CREATE INDEX IF NOT EXISTS idx_couriers_tenant ON couriers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON couriers(status);

-- 1. LEDGER (Ana Muhasebe Defteri)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Tarih ve Tür
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense', 'transfer')),
    
    -- Kategori
    category TEXT NOT NULL CHECK (category IN (
        'pos_sale',           -- POS satışı
        'delivery_sale',      -- Paket satışı
        'courier_payment',    -- Kurye ödemesi
        'courier_collection', -- Kuryeden tahsilat
        'supplier',           -- Tedarikçi ödemesi
        'salary',             -- Maaş
        'rent',               -- Kira
        'utility',            -- Fatura (elektrik, su, gaz)
        'tax',                -- Vergi
        'refund',             -- İade
        'commission',         -- Komisyon
        'other'               -- Diğer
    )),
    
    -- Tutar Bilgileri
    amount DECIMAL(12,2) NOT NULL,
    vat_amount DECIMAL(12,2) DEFAULT 0,
    vat_rate INTEGER DEFAULT 0, -- %8, %18, etc.
    net_amount DECIMAL(12,2) GENERATED ALWAYS AS (amount - vat_amount) STORED,
    
    -- Açıklama ve Referans
    description TEXT,
    reference_type TEXT CHECK (reference_type IN ('order', 'session', 'courier', 'manual', 'system')),
    reference_id UUID,
    
    -- Ödeme Bilgisi
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'check', 'other')),
    
    -- Durum
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_category ON ledger_entries(category);

-- 2. KURYE HESAPLARI
CREATE TABLE IF NOT EXISTS courier_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    
    -- Bakiye Bilgileri
    balance DECIMAL(12,2) DEFAULT 0, -- Cari bakiye (+ restoran alacaklı, - kurye alacaklı)
    total_earned DECIMAL(12,2) DEFAULT 0, -- Toplam kazanç (teslimat ücretleri)
    total_collected DECIMAL(12,2) DEFAULT 0, -- Toplam tahsil edilen nakit
    total_settled DECIMAL(12,2) DEFAULT 0, -- Toplam hesaplaşılan tutar
    
    -- Son Hesaplaşma
    last_settlement_date DATE,
    last_settlement_amount DECIMAL(12,2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, courier_id)
);

-- 3. KURYE İŞLEMLERİ
CREATE TABLE IF NOT EXISTS courier_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    courier_id UUID NOT NULL REFERENCES couriers(id),
    
    -- İşlem Tipi
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'delivery_fee',      -- Teslimat ücreti (kuryeye ödeme)
        'cash_collection',   -- Nakit tahsilat (kuryeden alacak)
        'settlement',        -- Hesaplaşma
        'bonus',             -- Bonus/Prim
        'deduction',         -- Kesinti/Ceza
        'advance'            -- Avans
    )),
    
    -- Sipariş Referansı
    order_id UUID, -- İlgili sipariş
    
    -- Tutar
    amount DECIMAL(12,2) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')), -- credit: kuryeye, debit: kuryeden
    
    -- Açıklama
    description TEXT,
    
    -- Durum
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Courier Transaction Indexes
CREATE INDEX IF NOT EXISTS idx_courier_tx_tenant ON courier_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courier_tx_courier ON courier_transactions(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_tx_date ON courier_transactions(created_at);

-- 4. KASA HAREKETLERİ
CREATE TABLE IF NOT EXISTS cash_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Gün
    register_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Bakiyeler
    opening_balance DECIMAL(12,2) DEFAULT 0,
    closing_balance DECIMAL(12,2),
    
    -- Hareketler
    total_cash_in DECIMAL(12,2) DEFAULT 0,      -- Toplam nakit giriş
    total_cash_out DECIMAL(12,2) DEFAULT 0,     -- Toplam nakit çıkış
    total_card DECIMAL(12,2) DEFAULT 0,         -- Toplam kart
    courier_collections DECIMAL(12,2) DEFAULT 0, -- Kuryelerden alınan
    courier_payments DECIMAL(12,2) DEFAULT 0,    -- Kuryelere ödenen
    
    -- Sayım
    counted_amount DECIMAL(12,2),               -- Sayılan tutar
    difference DECIMAL(12,2),                   -- Fark (sayılan - beklenen)
    
    -- Durum
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_by UUID REFERENCES auth.users(id),
    closed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    
    UNIQUE(tenant_id, register_date)
);

-- 5. KDV ORANLARI TABLOSU
CREATE TABLE IF NOT EXISTS vat_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL, -- 'Yiyecek', 'İçecek', 'Alkol', vb.
    rate INTEGER NOT NULL, -- 1, 8, 18, etc.
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: Default VAT rates will be inserted by the app when tenant first uses accounting

-- 6. E-FATURA HAZIRLIK TABLOSU
CREATE TABLE IF NOT EXISTS invoice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    
    -- Şirket Bilgileri
    company_name TEXT,
    tax_office TEXT,           -- Vergi dairesi
    tax_number TEXT,           -- Vergi numarası
    trade_registry_number TEXT, -- Ticaret sicil no
    mersis_number TEXT,        -- MERSİS no
    
    -- Adres
    address TEXT,
    city TEXT,
    district TEXT,
    postal_code TEXT,
    
    -- İletişim
    phone TEXT,
    email TEXT,
    
    -- E-Fatura Entegrasyon
    einvoice_provider TEXT CHECK (einvoice_provider IN ('parasut', 'logo', 'luca', 'uyumsoft', 'none')),
    einvoice_api_key TEXT,
    einvoice_username TEXT,
    einvoice_password_encrypted TEXT,
    einvoice_enabled BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- ROW LEVEL SECURITY
-- ============================

ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant isolation for couriers" ON couriers
    FOR ALL USING (tenant_id = auth.uid());
CREATE POLICY "Tenant isolation for ledger_entries" ON ledger_entries
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for courier_accounts" ON courier_accounts
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for courier_transactions" ON courier_transactions
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for cash_register" ON cash_register
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for vat_rates" ON vat_rates
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenant isolation for invoice_settings" ON invoice_settings
    FOR ALL USING (tenant_id = auth.uid());

-- Grant permissions
GRANT ALL ON couriers TO authenticated;
GRANT ALL ON ledger_entries TO authenticated;
GRANT ALL ON courier_accounts TO authenticated;
GRANT ALL ON courier_transactions TO authenticated;
GRANT ALL ON cash_register TO authenticated;
GRANT ALL ON vat_rates TO authenticated;
GRANT ALL ON invoice_settings TO authenticated;

-- ============================
-- TRIGGERs
-- ============================

-- Kurye bakiyesini otomatik güncelle
CREATE OR REPLACE FUNCTION update_courier_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Courier account yoksa oluştur
    INSERT INTO courier_accounts (tenant_id, courier_id, balance)
    VALUES (NEW.tenant_id, NEW.courier_id, 0)
    ON CONFLICT (tenant_id, courier_id) DO NOTHING;

    -- Bakiyeyi güncelle
    IF NEW.direction = 'credit' THEN
        -- Kuryeye ödeme (teslimat ücreti, bonus)
        UPDATE courier_accounts 
        SET balance = balance - NEW.amount,
            total_earned = total_earned + NEW.amount,
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND courier_id = NEW.courier_id;
    ELSE
        -- Kuryeden tahsilat (nakit)
        UPDATE courier_accounts 
        SET balance = balance + NEW.amount,
            total_collected = total_collected + NEW.amount,
            updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND courier_id = NEW.courier_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_courier_balance
    AFTER INSERT ON courier_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_courier_balance();

-- Updated_at trigger for ledger
CREATE OR REPLACE FUNCTION update_ledger_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ledger_updated
    BEFORE UPDATE ON ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_timestamp();

COMMENT ON TABLE ledger_entries IS 'Ana muhasebe defteri - tüm gelir/gider kayıtları';
COMMENT ON TABLE courier_accounts IS 'Kurye cari hesapları';
COMMENT ON TABLE courier_transactions IS 'Kurye işlem detayları';
COMMENT ON TABLE cash_register IS 'Günlük kasa hareketleri';
COMMENT ON TABLE invoice_settings IS 'E-Fatura ayarları ve şirket bilgileri';
