-- =====================================================
-- Accounting Entries Migration
-- Supports: Income/Expense tracking, categorization
-- =====================================================

CREATE TABLE IF NOT EXISTS accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Entry Type
    entry_type VARCHAR(20) NOT NULL, -- income, expense
    category VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Amount
    amount DECIMAL(12,2) NOT NULL,
    
    -- Date
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Reference
    reference_type VARCHAR(50), -- order, invoice, manual
    reference_id UUID,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax Records Table
CREATE TABLE IF NOT EXISTS tax_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- KDV (VAT)
    gross_sales DECIMAL(12,2) DEFAULT 0,
    kdv_collected DECIMAL(12,2) DEFAULT 0, -- VAT collected from sales
    kdv_paid DECIMAL(12,2) DEFAULT 0, -- VAT paid on purchases
    kdv_payable DECIMAL(12,2) DEFAULT 0, -- Net VAT to pay
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, calculated, submitted, paid
    
    submitted_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Register (Kasa) Tracking
CREATE TABLE IF NOT EXISTS cash_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    transaction_type VARCHAR(20) NOT NULL, -- open, close, deposit, withdrawal, sale
    amount DECIMAL(12,2) NOT NULL,
    
    previous_balance DECIMAL(12,2),
    new_balance DECIMAL(12,2),
    
    description TEXT,
    performed_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_entries_tenant ON accounting_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON accounting_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_type ON accounting_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_tax_records_tenant ON tax_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_tenant ON cash_register(tenant_id);

-- RLS
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own accounting entries" ON accounting_entries
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants manage own tax records" ON tax_records
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Tenants manage own cash register" ON cash_register
    FOR ALL USING (tenant_id = auth.uid());

-- Auto-create accounting entries from orders
CREATE OR REPLACE FUNCTION create_order_accounting_entry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        INSERT INTO accounting_entries (tenant_id, entry_type, category, description, amount, entry_date, reference_type, reference_id)
        VALUES (NEW.tenant_id, 'income', 'Satış', 'Sipariş #' || NEW.order_number, NEW.total_amount, CURRENT_DATE, 'order', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
