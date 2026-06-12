-- PostgreSQL Migration: SaaS Commerce Core Transformation
-- Date: 2026-06-10
-- Version: 1.0.0

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------------------------------------------
-- 1. Create Core Tables
-------------------------------------------------------------------------

-- Dynamic Tenant Configuration (business_type, ai_config, commerce_config, order_states, api_keys)
CREATE TABLE IF NOT EXISTS public.tenant_configs (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_type TEXT NOT NULL, -- e.g., 'restaurant', 'florist', 'hookah_lounge', 'dry_cleaning'
    ai_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    commerce_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    order_states JSONB DEFAULT '{}'::jsonb NOT NULL,
    api_keys JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Generic Products Table (Replaces Menu)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    sku TEXT, -- Stock Keeping Unit
    is_active BOOLEAN DEFAULT true,
    meta_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- Domain specific extensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);

-- Restructured Orders Table (Core Commerce Order Registry - Replaces pos_orders, pos_order_items, pos_sessions)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received', -- Matches dynamic tenant_configs.order_states
    items JSONB NOT NULL, -- Basket items snapshot: [{"name": "...", "quantity": 1, "price": 10.00}]
    subtotal_amount NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    final_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL, -- 'credit_card', 'cash', 'bank_transfer', etc.
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    meta_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- Domain specific metadata (tables, addresses, courier, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);

-- Payment Receipts Table (Bank Transfers / Payment Verification)
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    receipt_url TEXT NOT NULL, -- Link to uploaded receipt image
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON public.payment_receipts(tenant_id);

-- Universal Prompt Templates Table
CREATE TABLE IF NOT EXISTS public.prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL UNIQUE, -- e.g., 'universal_agent'
    template_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-------------------------------------------------------------------------
-- 2. Row Level Security (RLS) Hardening
-------------------------------------------------------------------------

ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if they exist
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tenant_configs;
DROP POLICY IF EXISTS product_isolation_policy ON public.products;
DROP POLICY IF EXISTS order_isolation_policy ON public.orders;
DROP POLICY IF EXISTS receipt_isolation_policy ON public.payment_receipts;
DROP POLICY IF EXISTS prompt_templates_policy ON public.prompt_templates;

-- Create secure isolation policies based on the session variable app.current_tenant_id
CREATE POLICY tenant_isolation_policy ON public.tenant_configs 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY product_isolation_policy ON public.products 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY order_isolation_policy ON public.orders 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY receipt_isolation_policy ON public.payment_receipts 
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY prompt_templates_policy ON public.prompt_templates 
    FOR ALL USING (true);

-------------------------------------------------------------------------
-- 3. Seed Default Universal Prompt Template
-------------------------------------------------------------------------

INSERT INTO public.prompt_templates (type, template_text)
VALUES (
    'universal_agent',
    'Sen {{MAGAZA_ADI}} için çalışan, {{TON}} ve satış odaklı bir yapay zeka asistanısın. Sektörün: {{SEKTOR}}

KURALLAR:
1. Sadece aşağıdaki katalogda yer alan ürünleri sat. Katalog dışı bir ürün istenirse nazikçe reddet:
{{MENU_CONTEXT}}

2. Siparişi tamamlamadan önce eksik bilgileri (seçenekler, adet vb.) netleştir.
3. Müşterinin sepetine uygun ek ürünler önererek çapraz satış yap (Upsell).
4. Teslimat için adres ve ödeme yöntemi bilgilerini almadan siparişi kesinlikle onaylama.
5. Kullanıcı siparişi iptal etmek isterse "iptal" komutunu işle.
6. Emojileri şu şekilde kullan: {{EMOJI_RULES}}'
)
ON CONFLICT (type) DO UPDATE 
SET template_text = EXCLUDED.template_text;
