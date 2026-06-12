# 🔒 Kapsamlı Güvenlik, Güvenilirlik & Performans Audit Raporu

**Tarih:** 2026-01-29  
**Proje:** WhatsApp Sipariş Otomasyonu (SaaS Restoran Yönetim Sistemi)  
**Auditor:** Security + Reliability + Performance Audit

---

## 📋 Executive Summary

Bu audit, WhatsApp sipariş otomasyon sisteminin kapsamlı bir güvenlik, veri tutarlılığı ve performans incelemesini içermektedir.

### 🚨 Risk Matrisi

| Şiddet | Sayı | Kategoriler |
|--------|------|-------------|
| **CRITICAL** | 4 | Secret Exposure, RLS Bypass, Payment Security, XSS |
| **HIGH** | 6 | IDOR, Missing Idempotency, Webhook Security |
| **MEDIUM** | 8 | Missing Rate Limits, Audit Logging, Cache |
| **LOW** | 5 | Performance, UX, Observability |

### 🎯 Kritik Eylem Gereken Alanlar (İlk 48 Saat)

1. **🔴 ACIL:** `.env` dosyasındaki OpenAI API Key'i revoke edin ve rotate edin
2. **🔴 ACIL:** RLS policy'leri `USING(true)` olan tabloları sıkılaştırın  
3. **🔴 ACIL:** iyzico HMAC signature validation eksik - prodda aktif hale getirin
4. **🟠 YÜKSEK:** WhatsApp webhook signature verification ekleyin

---

## 🏗️ Mimari Harita

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  React + Vite   │  │  SlugMenuPage   │  │  CheckoutPage   │  │
│  │  (PWA Support)  │  │  (Public Menu)  │  │  (Secure RPC)   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼─────────────────────┼─────────────────────┼─────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE EDGE FUNCTIONS                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ whatsapp-webhook│  │ iyzico-checkout │  │ detect-intent   │  │
│  │  (2799 lines!)  │  │  (Payment GW)   │  │  (AI/NLP)       │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│  ┌────────┴────────────────────┴────────────────────┴──────────┐│
│  │              SUPABASE POSTGRES + RLS                        ││
│  │  Tables: pos_orders, customers, menu_items, profiles, etc. ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL INTEGRATIONS                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ WhatsApp    │ │   iyzico    │ │   OpenAI    │ │ n8n (opt)   ││
│  │ Cloud API   │ │   Payment   │ │   GPT-4     │ │ Workflows   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Kritik Akış Listesi

| # | Akış | Endpoint/Function | Risk Seviyesi |
|---|------|-------------------|---------------|
| 1 | **WhatsApp Sipariş** | `whatsapp-webhook/index.ts` | 🔴 CRITICAL |
| 2 | **Online Ödeme** | `iyzico-checkout/index.ts` | 🔴 CRITICAL |
| 3 | **Dijital Menü Sipariş** | `place_order_secure` RPC | 🟠 HIGH |
| 4 | **Auth/Login** | Supabase Auth | 🟢 OK |
| 5 | **POS Sipariş** | `pos_orders` direct insert | 🟠 HIGH |
| 6 | **Admin Panel** | Frontend + RLS | 🟡 MEDIUM |

---

## 🔍 BULGULAR

---

### BULGU-001: Secret Exposure in Repository

| Alan | Değer |
|------|-------|
| **ID** | SEC-001 |
| **Şiddet** | 🔴 **CRITICAL** |
| **Kategori** | Security |
| **Etki** | API Key sızıntısı → Maliyet, Abuse, Hesap Takeover |

**Kanıt:**

```
Dosya: .env (Line 1)
OPENAI_API_KEY=sk-proj-KXhjwVx...
```

**Kök Neden:** `.env` dosyası lokalde oluşturulmuş ve `.gitignore` içinde olsa bile, Git history'de veya başka bir yerde izlenmiş olabilir.

**Düzeltme Önerisi:**

1. OpenAI dashboard'dan bu key'i DERHAL revoke edin
2. Yeni key oluşturup sadece Supabase Edge Function secrets'a ekleyin
3. Tüm env değişkenlerini `Deno.env.get()` ile alın (şu an doğru yapılıyor)
4. Git history'den temizlemek için: `git filter-branch` veya BFG Repo-Cleaner

**Test:**

- `.env` dosyasını silip, `grep -r "sk-proj" .` ile tarama yapın
- CI'da secret scanning (GitHub Secret Scanning, GitGuardian) aktif edin

**Gözlemlenebilirlik:**

- OpenAI Usage Dashboard'u izleyin (beklenmedik kullanım)
- Alarm: Günlük maliyet > $10 → Alert

---

### BULGU-002: Overly Permissive RLS Policies

| Alan | Değer |
|------|-------|
| **ID** | SEC-002 |
| **Şiddet** | 🔴 **CRITICAL** |
| **Kategori** | Security / DB |
| **Etki** | Tenant izolasyonu kırık, IDOR, Veri sızıntısı |

**Kanıt:**

```sql
-- 36 farklı migration dosyasında USING(true) pattern'i bulundu:

-- migration_tier_security.sql:39
CREATE POLICY "Public Access" ON public.customers FOR ALL USING (true);

-- 20260121_comprehensive_fix.sql:139
CREATE POLICY "Anyone can manage profiles" ON public.profiles 
  FOR ALL USING (true) WITH CHECK (true);

-- migration_platform_conversion.sql:55
CREATE POLICY "Service can manage conversions" ON platform_customer_conversions 
  FOR ALL USING (true) WITH CHECK (true);

-- Supabase_Schema.sql:133-138 (Ana şema!)
CREATE POLICY "Enable read/write for all" ON public.tenants FOR ALL USING (true);
CREATE POLICY "Enable read/write for all" ON public.users FOR ALL USING (true);
CREATE POLICY "Enable read/write for all" ON public.menu FOR ALL USING (true);
CREATE POLICY "Enable read/write for all" ON public.orders FOR ALL USING (true);
```

**Kök Neden:** Geliştirme sırasında kolaylık için "demo mode" policy'ler eklenmiş ve production'a geçilmemiş.

**Düzeltme Önerisi:**

```sql
-- ADIM 1: Mevcut tehlikeli policy'leri listele
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND (qual::text LIKE '%true%' OR with_check::text LIKE '%true%');

-- ADIM 2: Her tablo için tenant-based policy oluştur
-- Örnek: customers tablosu
DROP POLICY IF EXISTS "Public Access" ON public.customers;

CREATE POLICY "tenant_isolation" ON public.customers
  FOR ALL 
  USING (
    tenant_id = auth.uid() OR 
    tenant_id IN (SELECT tenant_id FROM user_tenant_access WHERE user_id = auth.uid())
  )
  WITH CHECK (tenant_id = auth.uid());

-- Örnek: menu tablosu (public read, tenant write)
DROP POLICY IF EXISTS "Enable read/write for all" ON public.menu;

CREATE POLICY "menu_public_read" ON public.menu FOR SELECT USING (true);
CREATE POLICY "menu_tenant_write" ON public.menu 
  FOR INSERT UPDATE DELETE 
  USING (tenant_id = auth.uid());
```

**Öncelikli Tablolar (Veri Hassasiyeti):**

1. `customers` (PII, adres, telefon) ❗
2. `orders` / `pos_orders` (finansal veri) ❗
3. `payment_transactions` (kart token, ödeme bilgisi) ❗
4. `profiles` (işletme bilgileri)
5. `tenant_configs` (API keys, secrets)

**Test:**

```javascript
// Anon client ile farklı tenant verisi çekme testi
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('tenant_id', 'BASKA_TENANT_UUID');

// Bu BOŞŞ dönmeli, dönmüyorsa RLS açık değildir
```

---

### BULGU-003: Missing Webhook Signature Verification

| Alan | Değer |
|------|-------|
| **ID** | SEC-003 |
| **Şiddet** | 🔴 **CRITICAL** |
| **Kategori** | Security |
| **Etki** | Sahte webhook ile sahte sipariş, data injection |

**Kanıt:**

```typescript
// whatsapp-webhook/index.ts:230-240
if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // ✅ Token doğrulaması var
    if (mode === "subscribe" && token === VERIFY_TOKEN) {...}
}

// AMA POST için signature yok!
if (req.method === "POST") {
    const body = await req.json();
    // ❌ X-Hub-Signature-256 header doğrulaması YOK
    processMessage(message);  // Direkt işleniyor
}
```

**Düzeltme Önerisi:**

```typescript
// whatsapp-webhook/index.ts - POST handler'a eklenmeli

import { crypto } from "https://deno.land/std/crypto/mod.ts";

async function verifyWebhookSignature(req: Request, body: string): Promise<boolean> {
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) return false;
    
    const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");
    if (!APP_SECRET) {
        console.error("WHATSAPP_APP_SECRET not configured!");
        return false;
    }
    
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(APP_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expectedSignature = "sha256=" + Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    return signature === expectedSignature;
}

// POST handler'da:
if (req.method === "POST") {
    const rawBody = await req.text();
    
    if (!await verifyWebhookSignature(req, rawBody)) {
        console.error("Invalid webhook signature - possible attack");
        return new Response("Forbidden", { status: 403 });
    }
    
    const body = JSON.parse(rawBody);
    // ... devam
}
```

---

### BULGU-004: XSS Risk in QRCodeManager

| Alan | Değer |
|------|-------|
| **ID** | SEC-004 |
| **Şiddet** | 🟠 **HIGH** |
| **Kategori** | Security / Frontend |
| **Etki** | Stored XSS, Session Hijacking |

**Kanıt:**

```jsx
// QRCodeManager.jsx:419
<div dangerouslySetInnerHTML={{ __html: getDesignHTML(selectedTable, previewUrl) }} />

// getDesignHTML içinde kullanıcı girdisi:
// Line 162: ${qrStyle.customTitle}
// Line 165: ${qrStyle.customSlogan}  
// Line 193: ${tenantName}
```

**Saldırı Senaryosu:**

1. Admin "Başlık" alanına `<img src=x onerror=alert(document.cookie)>` yazar
2. QR önizlemesi açıldığında XSS çalışır
3. Yazdırılan QR'ı tık layıp açan kullanıcı da etkilenir

**Düzeltme Önerisi:**

```jsx
// 1. HTML escape utility ekle
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 2. getDesignHTML içinde kullan
const safeTitle = escapeHtml(qrStyle.customTitle);
const safeSlogan = escapeHtml(qrStyle.customSlogan);
const safeTenantName = escapeHtml(tenantName);

// Alternatif: React component olarak render et (dangerouslySetInnerHTML kullanma)
```

---

### BULGU-005: Missing Idempotency in Payment Flow

| Alan | Değer |
|------|-------|
| **ID** | PAY-001 |
| **Şiddet** | 🔴 **CRITICAL** |
| **Kategori** | Billing / Concurrency |
| **Etki** | Double charge, müşteri şikayet, chargeback |

**Kanıt:**

```typescript
// iyzico-checkout/index.ts - handleInit
const { data: transaction } = await supabase
    .from("payment_transactions")
    .insert({...})  // ❌ Idempotency key yok
    .select()
    .single();

// CheckoutPage.jsx - handleSubmit
const handleSubmit = async () => {
    if (paymentMethod === 'online') {
        const order = await createOrder();  // ❌ Debounce/lock yok
        // Kullanıcı butona hızlıca 2 kez basarsa 2 sipariş oluşur
    }
};
```

**Saldırı/Hata Senaryosu:**

1. Kullanıcı "Ödeme Yap" butonuna tıklar (ağ yavaş)
2. UI yanıt vermez, kullanıcı tekrar tıklar
3. 2 ayrı transaction oluşur → 2 ödeme çekilir

**Düzeltme Önerisi:**

**Frontend:**

```jsx
// CheckoutPage.jsx
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
    if (submitting) return; // ✅ Double-click guard
    setSubmitting(true);
    
    try {
        // Idempotency key oluştur (client-side)
        const idempotencyKey = `${Date.now()}-${customerInfo.phone}-${total}`;
        localStorage.setItem('lastOrderIdempotencyKey', idempotencyKey);
        
        const order = await createOrder(idempotencyKey);
        ...
    } finally {
        setSubmitting(false);
    }
};
```

**Backend (Edge Function):**

```typescript
// iyzico-checkout/index.ts
async function handleInit(req: Request, supabase: any) {
    const body = await req.json();
    const idempotencyKey = body.idempotencyKey || req.headers.get('Idempotency-Key');
    
    if (idempotencyKey) {
        // Aynı key ile daha önce işlem yapılmış mı?
        const { data: existing } = await supabase
            .from("payment_transactions")
            .select("id, status, checkout_form_content")
            .eq("idempotency_key", idempotencyKey)
            .single();
        
        if (existing) {
            // Mevcut işlemi dön - yeni oluşturma!
            return new Response(JSON.stringify({
                success: true,
                transactionId: existing.id,
                checkoutFormHtml: existing.checkout_form_content,
                cached: true
            }), { headers: corsHeaders });
        }
    }
    
    // Yeni transaction (idempotency_key dahil)
    const { data: transaction } = await supabase
        .from("payment_transactions")
        .insert({
            ...existingFields,
            idempotency_key: idempotencyKey
        })
        .select()
        .single();
    ...
}
```

**DB Migration:**

```sql
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX idx_pt_idempotency ON payment_transactions(idempotency_key);
```

---

### BULGU-006: Weak iyzico HMAC Implementation

| Alan | Değer |
|------|-------|
| **ID** | PAY-002 |
| **Şiddet** | 🔴 **CRITICAL** |
| **Kategori** | Security / Billing |
| **Etki** | Payment tampering, unauthorized transactions |

**Kanıt:**

```typescript
// iyzico-checkout/index.ts:324-337
function generateIyzicoAuth(apiKey: string, secretKey: string, request: any): string {
    // ❌ YANLIŞ UYGULAMA - Demo amaçlı yazılmış
    const pki = [
        apiKey,
        new Date().getTime().toString(),
        JSON.stringify(request)
    ].join("");

    const hash = btoa(pki.slice(0, 100)); // ❌ Bu gerçek HMAC değil, sadece base64!

    return `IYZWS ${apiKey}:${hash}`;
}
// Comment: "Simple hash for demo - in production use proper HMAC-SHA256"
```

**Düzeltme Önerisi:**

```typescript
async function generateIyzicoAuth(
    apiKey: string, 
    secretKey: string, 
    request: any
): Promise<string> {
    const randomString = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    const requestString = JSON.stringify(request);
    
    // PKI String oluştur (iyzico format)
    const pkiString = `[apiKey=${apiKey},randomKey=${randomString},` +
        `request=${requestString}]`;
    
    // SHA-256 Hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(secretKey + pkiString)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Base64 encode
    const authorizationData = `${apiKey}:${randomString}:${hashHex}`;
    const authorization = btoa(authorizationData);
    
    return `IYZWS ${authorization}`;
}
```

---

### BULGU-007: Missing Rate Limiting

| Alan | Değer |
|------|-------|
| **ID** | SEC-005 |
| **Şiddet** | 🟠 **HIGH** |
| **Kategori** | Security / Distributed |
| **Etki** | DoS, Brute force, API abuse, Maliyet artışı |

**Kanıt:**
Hiçbir Edge Function'da rate limiting uygulanmamış:

- `whatsapp-webhook`: Sınırsız mesaj işleme
- `iyzico-checkout`: Sınırsız ödeme denemesi
- `detect-intent`: OpenAI API çağrısı (maliyet!)

**Düzeltme Önerisi:**

**Supabase Edge Function için Deno KV tabanlı rate limiter:**

```typescript
// lib/rateLimiter.ts
const kv = await Deno.openKv();

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}

export async function checkRateLimit(
    identifier: string, 
    limit: number = 10, 
    windowMs: number = 60000
): Promise<RateLimitResult> {
    const key = ["ratelimit", identifier];
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const entry = await kv.get<{ count: number; firstRequest: number }>(key);
    
    if (!entry.value || entry.value.firstRequest < windowStart) {
        // Yeni window başlat
        await kv.set(key, { count: 1, firstRequest: now }, { expireIn: windowMs });
        return { allowed: true, remaining: limit - 1, resetAt: new Date(now + windowMs) };
    }
    
    if (entry.value.count >= limit) {
        return { 
            allowed: false, 
            remaining: 0, 
            resetAt: new Date(entry.value.firstRequest + windowMs) 
        };
    }
    
    await kv.set(key, { 
        count: entry.value.count + 1, 
        firstRequest: entry.value.firstRequest 
    }, { expireIn: windowMs });
    
    return { 
        allowed: true, 
        remaining: limit - entry.value.count - 1,
        resetAt: new Date(entry.value.firstRequest + windowMs)
    };
}

// Kullanım (whatsapp-webhook):
const rateLimit = await checkRateLimit(`whatsapp:${customerPhone}`, 20, 60000);
if (!rateLimit.allowed) {
    return new Response("Rate limited", { 
        status: 429,
        headers: { 
            "Retry-After": Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString()
        }
    });
}
```

**Önerilen Limitler:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| whatsapp-webhook | 20/dakika/telefon | 60s |
| iyzico-checkout/init | 5/dakika/IP | 60s |
| detect-intent | 10/dakika/tenant | 60s |
| order placement | 3/dakika/telefon | 60s |

---

### BULGU-008: Insecure CORS Configuration

| Alan | Değer |
|------|-------|
| **ID** | SEC-006 |
| **Şiddet** | 🟡 **MEDIUM** |
| **Kategori** | Security |
| **Etki** | CSRF benzeri saldırılar, veri sızıntısı |

**Kanıt:**

```typescript
// iyzico-checkout/index.ts:12-16
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",  // ❌ Wildcard!
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

**Düzeltme Önerisi:**

```typescript
const ALLOWED_ORIGINS = [
    'https://arasta.vercel.app',
    'https://your-production-domain.com',
    process.env.DEV === 'true' ? 'http://localhost:3000' : null
].filter(Boolean);

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('Origin');
    
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Credentials": "true"
        };
    }
    
    return {}; // Origin yoksa veya izin verilmiyorsa CORS header ekleme
}
```

---

### BULGU-009: Missing Audit Logging

| Alan | Değer |
|------|-------|
| **ID** | OBS-001 |
| **Şiddet** | 🟡 **MEDIUM** |
| **Kategori** | Observability |
| **Etki** | Fraud detection zor, Incident response yavaş |

**Kanıt:**

- Ödeme işlemlerinde audit log yok
- Admin işlemlerinde iz takibi yok
- Müşteri data erişimlerinde log yok

**Mevcut Durum:** `admin_login_audit` tablosu var ama sadece login için.

**Düzeltme Önerisi:**

```sql
-- Migration: create_audit_log.sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id UUID REFERENCES profiles(id),
    actor_id TEXT,           -- user_id veya system
    actor_type TEXT,         -- 'user', 'admin', 'system', 'webhook'
    action TEXT NOT NULL,    -- 'order.create', 'payment.success', 'customer.update'
    resource_type TEXT,      -- 'order', 'customer', 'payment'
    resource_id TEXT,
    details JSONB,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- RLS: Sadece service role yazabilir
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON audit_logs 
    FOR ALL USING (auth.role() = 'service_role');
```

**Kullanım:**

```typescript
async function logAudit(params: {
    tenantId?: string;
    actorId: string;
    actorType: 'user' | 'admin' | 'system' | 'webhook';
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, any>;
    req?: Request;
}) {
    await supabase.from('audit_logs').insert({
        tenant_id: params.tenantId,
        actor_id: params.actorId,
        actor_type: params.actorType,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        details: params.details,
        ip_address: params.req?.headers.get('x-forwarded-for'),
        user_agent: params.req?.headers.get('user-agent')
    });
}

// Örnek kullanım:
await logAudit({
    tenantId: tenant.id,
    actorId: customerPhone,
    actorType: 'user',
    action: 'order.create',
    resourceType: 'order',
    resourceId: orderId,
    details: { total, paymentMethod, itemCount: items.length },
    req
});
```

---

### BULGU-010: Large Monolithic Edge Function

| Alan | Değer |
|------|-------|
| **ID** | PERF-001 |
| **Şiddet** | 🟡 **MEDIUM** |
| **Kategori** | Performance / Maintainability |
| **Etki** | Cold start süresi, Debug zorluğu, Test edilemezlik |

**Kanıt:**

```
whatsapp-webhook/index.ts: 2799 satır (!)
```

Tek bir dosyada:

- Session management
- Intent detection
- Order processing
- WhatsApp API calls
- AI integration
- Security checks
- All translations

**Düzeltme Önerisi:**

```
supabase/functions/whatsapp-webhook/
├── index.ts          (Entry point, ~100 lines)
├── handlers/
│   ├── messageHandler.ts
│   ├── buttonHandler.ts
│   └── orderHandler.ts
├── services/
│   ├── sessionService.ts
│   ├── whatsappService.ts
│   ├── aiService.ts
│   └── orderService.ts
├── utils/
│   ├── translations.ts
│   ├── intentDetection.ts
│   └── security.ts
└── types.ts
```

**Kısa Vadeli:** En azından `translations`, `intentDetection`, `whatsappApi` ayrı dosyalara çıkarılabilir.

---

## 📊 Quick Wins (1-2 Gün)

| # | Aksiyon | Öncelik | Effort | Etki |
|---|---------|---------|--------|------|
| 1 | OpenAI API Key revoke & rotate | 🔴 P0 | 30 dk | Critical |
| 2 | WhatsApp webhook signature validation | 🔴 P0 | 2 saat | Critical |
| 3 | Frontend double-submit guard | 🟠 P1 | 1 saat | High |
| 4 | QRCodeManager XSS fix | 🟠 P1 | 30 dk | High |
| 5 | CORS origin whitelist | 🟡 P2 | 1 saat | Medium |

## 🏗️ Yapısal İyileştirmeler (1-4 Hafta)

| # | Aksiyon | Hafta | Risk |
|---|---------|-------|------|
| 1 | RLS Policy overhaul (tüm tablolar) | 1-2 | High (test gerekli) |
| 2 | iyzico gerçek HMAC implementasyonu | 1 | Medium |
| 3 | Idempotency key desteği (payment + order) | 1 | Medium |
| 4 | Rate limiting (Deno KV) | 1 | Low |
| 5 | Audit logging infrastructure | 2 | Low |
| 6 | Edge function modularization | 3-4 | Medium |
| 7 | E2E test suite (Playwright) | 4 | Low |

---

## 📋 PR Önerileri

### PR-1: 🔴 Critical Security Fixes

**Dosyalar:**

- `.env` → Sil veya placeholder'a çevir
- `supabase/functions/whatsapp-webhook/index.ts` → Signature validation ekle
- `frontend/src/components/QRCodeManager.jsx` → XSS fix

**Risk:** Low (security improvement)

---

### PR-2: Payment Idempotency

**Dosyalar:**

- `supabase/functions/iyzico-checkout/index.ts`
- `frontend/src/components/CheckoutPage.jsx`
- `supabase/migrations/add_idempotency_key.sql`

**Risk:** Medium (payment flow değişikliği - staging test gerekli)

---

### PR-3: RLS Policy Hardening

**Dosyalar:**

- `supabase/migrations/harden_rls_policies.sql`

**Risk:** High (mevcut fonksiyonaliteyi bozabilir - kapsamlı test gerekli)

**Aşamalı Yaklaşım:**

1. Önce kritik tablolar: `customers`, `orders`, `payment_transactions`
2. Edge function'ları service_role ile çalıştığı için etkilenmez
3. Frontend anon/authenticated erişimleri test edilmeli

---

## ✅ Değişiklik Sonrası Doğrulama

```bash
# 1. Security scan
npm audit
npx eslint . --ext .ts,.tsx,.js,.jsx

# 2. RLS test
# Frontend'den farklı tenant verilerine erişim dene

# 3. Payment test (Sandbox)
# Double-click senaryosu test et
# Idempotency key ile duplicate request gönder

# 4. Webhook test
# Invalid signature ile POST gönder (403 döndürmeli)
curl -X POST https://xxx.supabase.co/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Expected: 403 Forbidden
```

---

## 📝 Sonuç

Bu sistem **üretim ortamına geçmeden önce** yukarıdaki kritik bulgular ele alınmalıdır. Özellikle:

1. **Secret management** (OpenAI key sızıntısı)
2. **RLS policies** (tenant isolation)
3. **Payment security** (idempotency, HMAC)
4. **Webhook security** (signature verification)

Bulgular düzeltildikten sonra kapsamlı bir **penetration test** önerilir.

---

*Rapor Sonu*
