-- ===========================================
-- REZERVASYON SİSTEMİ MIGRATION
-- ===========================================

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Müşteri Bilgileri
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    
    -- Rezervasyon Detayları
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INTEGER NOT NULL DEFAULT 2,
    table_id UUID REFERENCES tables(id),
    
    -- Durum
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
    
    -- Notlar
    note TEXT,
    special_occasion TEXT, -- birthday, anniversary, etc.
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    reminded_at TIMESTAMPTZ -- SMS hatırlatma gönderildi mi
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_phone ON reservations(customer_phone);

-- RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for reservations" ON reservations
    FOR ALL USING (tenant_id = auth.uid());

-- Grant
GRANT ALL ON reservations TO authenticated;

-- Comment
COMMENT ON TABLE reservations IS 'Masa rezervasyonları - tarih, saat, müşteri bilgisi ve durum takibi';
