-- Sections (Bölgeler) Tablosu ve Güncellemeleri
-- 1. Tablo yoksa oluştur (Temel yapı)
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Eksik kolonları güvenli şekilde ekle (Eğer tablo önceden varsa ve kolonlar eksikse)
DO $$ BEGIN -- sort_order kolonu kontrolü
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sections'
        AND column_name = 'sort_order'
) THEN
ALTER TABLE sections
ADD COLUMN sort_order INT DEFAULT 0;
END IF;
-- is_active kolonu kontrolü
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sections'
        AND column_name = 'is_active'
) THEN
ALTER TABLE sections
ADD COLUMN is_active BOOLEAN DEFAULT true;
END IF;
END $$;
-- 3. İndeksler
CREATE INDEX IF NOT EXISTS idx_sections_tenant ON sections(tenant_id);
-- 4. RLS Politikaları
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenants can manage sections" ON sections;
CREATE POLICY "Tenants can manage sections" ON sections FOR ALL USING (auth.uid() = tenant_id);
DROP POLICY IF EXISTS "Service can manage sections" ON sections;
CREATE POLICY "Service can manage sections" ON sections FOR ALL USING (true) WITH CHECK (true);
-- 5. Varsayılan Veriler (Mevcut kullanıcılarda yoksa ekle)
INSERT INTO sections (tenant_id, name, sort_order)
SELECT id,
    'Salon',
    1
FROM profiles
WHERE NOT EXISTS (
        SELECT 1
        FROM sections
        WHERE name = 'Salon'
            AND tenant_id = profiles.id
    );
INSERT INTO sections (tenant_id, name, sort_order)
SELECT id,
    'Bahçe',
    2
FROM profiles
WHERE NOT EXISTS (
        SELECT 1
        FROM sections
        WHERE name = 'Bahçe'
            AND tenant_id = profiles.id
    );