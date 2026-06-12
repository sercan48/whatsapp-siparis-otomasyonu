-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RESET / CLEANUP (Development only)
DROP TABLE IF EXISTS public.payment_receipts CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.terminals CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.tenant_configs CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.prompt_templates CASCADE;

-------------------------------------------------------------------------
-- 1. TENANTS TABLE (SaaS Customers)
-------------------------------------------------------------------------
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    whatsapp_phone_number_id TEXT UNIQUE, -- WhatsApp Cloud API Phone ID for routing
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 2. TENANT CONFIGS TABLE (Dynamic Rules and Configurations)
-------------------------------------------------------------------------
CREATE TABLE public.tenant_configs (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL, -- e.g., 'restaurant', 'florist', 'water_dealer', 'retail'
    
    -- AI Persona & Custom Prompts configuration
    ai_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- Commerce configuration (payment methods, delivery types, checkout questions, cargo configuration)
    -- e.g., { "currency": "TRY", "delivery_types": ["delivery"], "payment_methods": ["credit_card", "bank_transfer"] }
    commerce_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- Dynamic order states flow mapping
    order_states JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- Third party API keys (PayTR, iyzico, Cargo API credentials)
    -- e.g., { "paytr_merchant_id": "...", "iyzico_api_key": "...", "cargo_provider": "yurtici", "cargo_api_key": "..." }
    api_keys JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 3. CUSTOMERS TABLE (End Customers per Tenant)
-------------------------------------------------------------------------
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    iyzico_card_user_key TEXT,
    meta_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- Custom tags, addresses, last_order_snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT unique_customer_per_tenant UNIQUE (tenant_id, phone)
);

CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 4. PRODUCTS TABLE (Universal Inventory / Menu)
-------------------------------------------------------------------------
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    sku TEXT,
    is_active BOOLEAN DEFAULT true,
    meta_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- variants, modifiers, category
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_products_tenant ON public.products(tenant_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 5. TERMINALS TABLE (Su/Tüp bayileri vb. için dağıtım araçları / terminaller)
-------------------------------------------------------------------------
CREATE TABLE public.terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- Örn: "Araç 34 ABC 123 - Ahmet Sürücü"
    device_token TEXT, -- Push bildirimleri veya API bağlantısı için token
    status TEXT NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'on_delivery'
    meta_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- plaka, sürücü tel, lokasyon bilgileri
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_terminals_tenant ON public.terminals(tenant_id);
ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 6. CAMPAIGNS TABLE (Universal Rules engine)
-------------------------------------------------------------------------
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    rules JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_campaigns_tenant ON public.campaigns(tenant_id);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 7. ORDERS TABLE (Core Commerce Order Registry)
-------------------------------------------------------------------------
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
    terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL, -- Dağıtımdaki araç/terminal eşleşmesi
    
    status TEXT NOT NULL DEFAULT 'received',
    items JSONB NOT NULL,
    
    subtotal_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    final_amount NUMERIC(10, 2) NOT NULL,
    
    payment_method TEXT NOT NULL, -- 'credit_card', 'cash', 'bank_transfer', etc.
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    
    -- Cargo / Courier routing & Tracking data
    -- e.g., { "cargo_tracking_number": "KP034...", "cargo_provider": "yurtici", "courier_status": "assigned" }
    meta_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_terminal ON public.orders(terminal_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 8. PAYMENT RECEIPTS TABLE (Bank Transfers / Payment Verification)
-------------------------------------------------------------------------
CREATE TABLE public.payment_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    receipt_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    ocr_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- Holds parsed OCR results (amount, sender, date, confidence)
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_receipts_tenant ON public.payment_receipts(tenant_id);
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 9. BANK TRANSACTIONS TABLE (Bulk statements / Automatic reconciliation)
-- Keeps track of incoming bank transactions for automatic statement matching
-------------------------------------------------------------------------
CREATE TABLE public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    sender_name TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT, -- Havale açıklaması (Örn: "ord-101 ödemesi")
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    matched_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'unmatched', -- 'unmatched', 'matched', 'ignored'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_bank_tx_tenant ON public.bank_transactions(tenant_id);
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 10. PROMPT TEMPLATES (Global System Wide)
-------------------------------------------------------------------------
CREATE TABLE public.prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL UNIQUE,
    template_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 11. TENANT USERS TABLE (RBAC & Granular View Permissions)
-------------------------------------------------------------------------
CREATE TABLE public.tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff', -- 'admin', 'staff', 'courier'
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL, -- list of features allowed (e.g., ['view_orders'])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_per_tenant UNIQUE (tenant_id, email)
);

CREATE INDEX idx_tenant_users_tenant ON public.tenant_users(tenant_id);
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- 12. INTEGRATION LOGS TABLE (Maxijet / Porego API request logs)
-------------------------------------------------------------------------
CREATE TABLE public.integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- 'maxijet', 'porego'
    request_payload JSONB NOT NULL,
    response_payload JSONB NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_integration_logs_tenant ON public.integration_logs(tenant_id);
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-------------------------------------------------------------------------
-- RLS POLICIES (Row-Level Security)
-------------------------------------------------------------------------
CREATE POLICY tenant_isolation_policy ON public.tenant_configs FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY customer_isolation_policy ON public.customers FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY product_isolation_policy ON public.products FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY terminal_isolation_policy ON public.terminals FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY campaign_isolation_policy ON public.campaigns FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY order_isolation_policy ON public.orders FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY receipt_isolation_policy ON public.payment_receipts FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY bank_tx_isolation_policy ON public.bank_transactions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY tenant_users_isolation_policy ON public.tenant_users FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY integration_logs_isolation_policy ON public.integration_logs FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
CREATE POLICY prompt_templates_policy ON public.prompt_templates FOR ALL USING (true);
CREATE POLICY tenants_policy ON public.tenants FOR ALL USING (true);
