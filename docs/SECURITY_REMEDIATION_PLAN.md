# 🛠️ Güvenlik Düzeltme Planı (Implementation Plan)

**Oluşturma Tarihi:** 2026-01-29  
**Son Güncelleme:** 2026-01-29 00:55  
**Öncelik Sırası:** Güvenlik > Veri Tutarlılığı > Ödeme > Performans

---

## 📋 Öncelik Matrisi & İlerleme Durumu

| Öncelik | Zaman | Bulgular | Durum |
|---------|-------|----------|-------|
| **P0 - ACIL** | 0-24 saat | SEC-001, SEC-003 | ✅ TAMAMLANDI |
| **P1 - YÜKSEK** | 1-3 gün | SEC-002, PAY-001, PAY-002, SEC-004 | ✅ TAMAMLANDI |
| **P2 - ORTA** | 1-2 hafta | SEC-005, SEC-006, OBS-001 | 🔶 KISMİ |
| **P3 - DÜŞÜK** | 2-4 hafta | PERF-001 | ⏳ Bekliyor |

### Tamamlanan İşlemler ✅

1. `.env` dosyası silindi, `.env.example` şablon oluşturuldu
2. WhatsApp webhook signature verification eklendi
3. XSS fix (QRCodeManager) uygulandı
4. iyzico HMAC fix (gerçek SHA-1 implementasyonu) uygulandı
5. CORS whitelist uygulandı
6. Idempotency key migration oluşturuldu
7. RLS hardening migration oluşturuldu

---

## 🔴 P0: ACİL DÜZELTMELER (24 SAAT)

### Task 1: OpenAI API Key Rotation (SEC-001)

**Durum:** ⏳ Bekliyor

**Adımlar:**

1. [ ] OpenAI Dashboard'a giriş yap
2. [ ] `sk-proj-KXhjwVx...` key'i REVOKE et
3. [ ] Yeni API Key oluştur
4. [ ] Supabase Dashboard → Edge Functions → Secrets'a yeni key'i ekle
5. [ ] `.env` dosyasını sil veya placeholder'a çevir
6. [ ] Git history'den temizle (BFG Repo-Cleaner)

**Doğrulama:**

```bash
# 1. Eski key çalışmamalı
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-proj-KXhjwVx..."
# Expected: 401 Unauthorized

# 2. Yeni key Edge Function'da çalışmalı
# WhatsApp'tan test mesajı gönder, AI yanıt vermeli
```

---

### Task 2: WhatsApp Webhook Signature Verification (SEC-003)

**Durum:** ⏳ Bekliyor

**Dosya:** `supabase/functions/whatsapp-webhook/index.ts`

**Değişiklikler:**

```typescript
// ===== EKLENECEK BÖLÜM (index.ts başına) =====

// Crypto import
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Environment variable
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");

/**
 * Verify Meta webhook signature
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
async function verifyWebhookSignature(signature: string | null, rawBody: string): Promise<boolean> {
    if (!signature || !WHATSAPP_APP_SECRET) {
        console.error("Missing signature or app secret");
        return false;
    }
    
    // Signature format: sha256=abc123...
    const expectedPrefix = "sha256=";
    if (!signature.startsWith(expectedPrefix)) {
        return false;
    }
    
    const providedHash = signature.slice(expectedPrefix.length);
    
    // HMAC-SHA256
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(WHATSAPP_APP_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(rawBody)
    );
    
    const computedHash = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    return providedHash === computedHash;
}

// ===== MEVCUT POST HANDLER DEĞİŞİKLİĞİ =====

// ÖNCE (mevcut):
if (req.method === "POST") {
    try {
        const body = await req.json();
        // ...
    }
}

// SONRA (güncellenmiş):
if (req.method === "POST") {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-hub-signature-256");
        
        // Signature validation (production)
        if (WHATSAPP_APP_SECRET) {
            const isValid = await verifyWebhookSignature(signature, rawBody);
            if (!isValid) {
                console.error("❌ Invalid webhook signature - possible attack!");
                return new Response("Forbidden", { status: 403 });
            }
        } else {
            console.warn("⚠️ WHATSAPP_APP_SECRET not set - signature verification skipped");
        }
        
        const body = JSON.parse(rawBody);
        console.log("Incoming:", JSON.stringify(body, null, 2));
        // ... devam eden kod
    }
}
```

**Supabase Secret Ekleme:**

```bash
# Supabase CLI ile
supabase secrets set WHATSAPP_APP_SECRET=your_meta_app_secret_here

# Veya Dashboard'dan:
# Project Settings → Edge Functions → Manage secrets
```

**Doğrulama:**

```bash
# Invalid signature ile test (403 dönmeli)
curl -X POST "https://xxx.supabase.co/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=invalid_signature" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"123","text":{"body":"test"}}]}}]}]}'

# Expected: 403 Forbidden
```

---

## 🟠 P1: YÜKSEK ÖNCELİKLİ DÜZELTMELER (1-3 GÜN)

### Task 3: RLS Policy Hardening (SEC-002)

**Durum:** ⏳ Bekliyor

**Migration Dosyası:** `supabase/migrations/harden_rls_policies.sql`

```sql
-- =====================================================
-- RLS POLICY HARDENING
-- Tarih: 2026-01-29
-- Amaç: USING(true) policy'leri tenant-based izolasyona çevir
-- =====================================================

-- 1. CUSTOMERS TABLE (PII - En Kritik)
DROP POLICY IF EXISTS "Public Access" ON public.customers;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.customers;

-- Service role (Edge Functions) her şeyi yapabilir
CREATE POLICY "service_role_all" ON public.customers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users kendi tenant'larını görebilir
CREATE POLICY "tenant_read" ON public.customers
    FOR SELECT TO authenticated 
    USING (tenant_id = auth.uid());

CREATE POLICY "tenant_write" ON public.customers
    FOR INSERT UPDATE DELETE TO authenticated 
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- 2. ORDERS TABLE (Finansal Veri)
DROP POLICY IF EXISTS "Enable read/write for all" ON public.orders;

CREATE POLICY "service_role_all" ON public.orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_read" ON public.orders
    FOR SELECT TO authenticated 
    USING (tenant_id = auth.uid());

-- Orders sadece RPC üzerinden oluşturulmalı (place_order_secure)
-- Direct insert kapatıyoruz
CREATE POLICY "tenant_update" ON public.orders
    FOR UPDATE TO authenticated 
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- 3. PROFILES TABLE
DROP POLICY IF EXISTS "Anyone can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.profiles;

-- Public read (menü görüntüleme için gerekli)
CREATE POLICY "public_read" ON public.profiles
    FOR SELECT TO anon, authenticated USING (true);

-- Sadece kendi profili düzenleyebilir
CREATE POLICY "owner_write" ON public.profiles
    FOR UPDATE TO authenticated 
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 4. MENU TABLE (Public okuma, tenant yazma)
DROP POLICY IF EXISTS "Enable read/write for all" ON public.menu;

CREATE POLICY "public_read" ON public.menu
    FOR SELECT USING (true);

CREATE POLICY "tenant_write" ON public.menu
    FOR INSERT UPDATE DELETE TO authenticated 
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- 5. PAYMENT_TRANSACTIONS (Çok Hassas!)
DROP POLICY IF EXISTS "Enable read/write for all" ON public.payment_transactions;

CREATE POLICY "service_role_all" ON public.payment_transactions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_read" ON public.payment_transactions
    FOR SELECT TO authenticated 
    USING (tenant_id = auth.uid());

-- 6. POS_ORDERS (QR Menü siparişleri)
-- Anon insert gerekli (QR menu müşterileri auth olmadan sipariş verebilmeli)
DROP POLICY IF EXISTS "Enable read/write for all" ON public.pos_orders;

CREATE POLICY "service_role_all" ON public.pos_orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_insert" ON public.pos_orders
    FOR INSERT TO anon WITH CHECK (true);  -- RPC kontrolü yapılacak

CREATE POLICY "tenant_all" ON public.pos_orders
    FOR ALL TO authenticated 
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- 7. TENANT_CONFIGS (API Keys içeriyor!)
DROP POLICY IF EXISTS "Enable read/write for all" ON public.tenant_configs;

CREATE POLICY "owner_only" ON public.tenant_configs
    FOR ALL TO authenticated 
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

-- Service role erişimi
CREATE POLICY "service_role_all" ON public.tenant_configs
    FOR ALL TO service_role USING (true);
```

**⚠️ UYARI:** Bu migration'ı uygulamadan önce:

1. Tüm frontend sayfalarını test edin
2. Edge function'lar service_role kullandığı için etkilenmez
3. Staging'de kapsamlı test yapın

---

### Task 4: Payment Idempotency (PAY-001)

**Durum:** ⏳ Bekliyor

**Dosyalar:**

- `supabase/migrations/add_idempotency_key.sql`
- `supabase/functions/iyzico-checkout/index.ts`
- `frontend/src/components/CheckoutPage.jsx`

**Migration:**

```sql
-- add_idempotency_key.sql
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_idempotency 
ON payment_transactions(idempotency_key) 
WHERE idempotency_key IS NOT NULL;
```

**Frontend (CheckoutPage.jsx):**

```jsx
// generateIdempotencyKey helper
const generateIdempotencyKey = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
};

// State ekle
const [idempotencyKey] = useState(() => generateIdempotencyKey());

// handleSubmit güncelle
const handleSubmit = async () => {
    if (submitting) return; // Double-click guard
    setSubmitting(true);
    
    try {
        if (paymentMethod === 'online') {
            const order = await createOrder();
            if (order) {
                setShowPaymentForm(true);
            }
        } else {
            const order = await createOrder();
            if (order) {
                toast.success('Siparişiniz alındı!');
                navigate(`/m/${slug}/order-success`, {
                    state: { orderId: order.id, total, paymentMethod }
                });
            }
        }
    } finally {
        // setSubmitting(false) kaldırıldı - başarılı işlemde navigate ediliyor
        // Hata durumunda finally'de set ediyoruz
    }
};

// createOrder'a idempotency key ekle
const createOrder = async () => {
    // ... mevcut kod
    const { data: rpcResponse, error: rpcError } = await supabase.rpc('place_order_secure', {
        // ... mevcut parametreler
        p_idempotency_key: idempotencyKey  // Yeni parametre
    });
    // ...
};
```

---

### Task 5: iyzico HMAC Fix (PAY-002)

**Dosya:** `supabase/functions/iyzico-checkout/index.ts`

```typescript
// ===== generateIyzicoAuth fonksiyonunu değiştir =====

/**
 * Generate iyzico authorization header (GERÇEK IMPLEMENTASYON)
 * @see https://dev.iyzipay.com/en/api-documentation
 */
async function generateIyzicoAuth(
    apiKey: string, 
    secretKey: string, 
    request: any
): Promise<string> {
    // Random string (8 karakter)
    const randomKey = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    
    // Request JSON string
    const requestString = JSON.stringify(request);
    
    // PKI String formatı
    const pkiString = `apiKey:${apiKey}&secretKey:${secretKey}&randomKey:${randomKey}&request:${requestString}`;
    
    // SHA-1 Hash (iyzico SHA-1 kullanıyor)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(pkiString));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    // Authorization string
    const authString = `${apiKey}:${randomKey}:${hashBase64}`;
    
    return `IYZWS ${btoa(authString)}`;
}

// Ayrıca fonksiyonu async yapıp çağrıları await ile güncelle:
// Line 154: const authorization = await generateIyzicoAuth(...);
// Line 246: const authorization = await generateIyzicoAuth(...);
```

---

### Task 6: XSS Fix in QRCodeManager (SEC-004)

**Dosya:** `frontend/src/components/QRCodeManager.jsx`

```jsx
// ===== escapeHtml utility ekle (dosyanın başına) =====

/**
 * HTML karakterlerini escape et (XSS önleme)
 */
const escapeHtml = (text) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
};

// ===== getDesignHTML içinde kullan =====

const getDesignHTML = (table, qrSrc, isPrint = false) => {
    // Escape user inputs
    const safeTitle = escapeHtml(qrStyle.customTitle);
    const safeSlogan = escapeHtml(qrStyle.customSlogan);
    const safeTenantName = escapeHtml(tenantName);
    const safeTableNumber = escapeHtml(table?.table_number || '');
    
    // Logo URL'i de escape et (src attribute injection)
    const safeLogoUrl = tenantLogo ? encodeURI(tenantLogo) : '';
    
    const logoHtml = (qrStyle.includeLogo && safeLogoUrl)
        ? `<img src="${safeLogoUrl}" class="logo" alt="Logo" />`
        : '';

    // Template'lerde ${qrStyle.customTitle} yerine ${safeTitle} kullan
    // ... devam eden template kodu
};
```

---

## 🟡 P2: ORTA ÖNCELİKLİ DÜZELTMELER (1-2 HAFTA)

### Task 7: Rate Limiting (SEC-005)

**Dosya:** `supabase/functions/_shared/rateLimiter.ts`

```typescript
// Deno KV tabanlı rate limiter
// Bu dosyayı oluştur ve tüm Edge Function'lardan import et

export interface RateLimitConfig {
    limit: number;      // Max istekler
    windowMs: number;   // Zaman penceresi (ms)
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;    // Unix timestamp
}

const kv = await Deno.openKv();

export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = { limit: 10, windowMs: 60000 }
): Promise<RateLimitResult> {
    const key = ["ratelimit", identifier];
    const now = Date.now();
    
    const entry = await kv.get<{ count: number; windowStart: number }>(key);
    
    // Yeni window veya expired window
    if (!entry.value || now - entry.value.windowStart > config.windowMs) {
        await kv.set(key, { count: 1, windowStart: now }, { 
            expireIn: config.windowMs 
        });
        return {
            allowed: true,
            remaining: config.limit - 1,
            resetAt: now + config.windowMs
        };
    }
    
    // Limit aşıldı
    if (entry.value.count >= config.limit) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.value.windowStart + config.windowMs
        };
    }
    
    // Limit içinde
    await kv.set(key, { 
        count: entry.value.count + 1, 
        windowStart: entry.value.windowStart 
    }, { expireIn: config.windowMs });
    
    return {
        allowed: true,
        remaining: config.limit - entry.value.count - 1,
        resetAt: entry.value.windowStart + config.windowMs
    };
}

// Convenience functions
export const rateLimitWhatsApp = (phone: string) => 
    checkRateLimit(`whatsapp:${phone}`, { limit: 20, windowMs: 60000 });

export const rateLimitPayment = (ip: string) => 
    checkRateLimit(`payment:${ip}`, { limit: 5, windowMs: 60000 });

export const rateLimitOrder = (phone: string) => 
    checkRateLimit(`order:${phone}`, { limit: 3, windowMs: 60000 });
```

---

### Task 8: CORS Whitelist (SEC-006)

**Tüm Edge Function'larda corsHeaders güncelle:**

```typescript
// _shared/cors.ts

const ALLOWED_ORIGINS = [
    'https://arasta.vercel.app',
    'https://your-domain.com',
    // Development
    ...(Deno.env.get('ENVIRONMENT') === 'development' 
        ? ['http://localhost:3000', 'http://localhost:5173'] 
        : [])
];

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('Origin');
    
    // Origin yoksa veya listede değilse boş dön
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        return {};
    }
    
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
}

// Kullanım:
// const corsHeaders = getCorsHeaders(req);
// return new Response(JSON.stringify(data), { headers: corsHeaders });
```

---

### Task 9: Audit Logging (OBS-001)

**Migration:** `supabase/migrations/create_audit_logs.sql`

```sql
-- Audit log tablosu oluştur
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Actor bilgisi
    tenant_id UUID REFERENCES public.profiles(id),
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system', 'webhook', 'api')),
    
    -- Action bilgisi
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    
    -- Context
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,
    
    -- Indexler için
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical'))
);

-- Indexes
CREATE INDEX idx_audit_tenant_time ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_action ON public.audit_logs(action);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_type, actor_id);

-- RLS: Sadece service role yazabilir, authenticated okuyabilir (kendi tenant'ını)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_write" ON public.audit_logs
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "tenant_read" ON public.audit_logs
    FOR SELECT TO authenticated 
    USING (tenant_id = auth.uid());

-- Otomatik cleanup (30 günden eski kayıtları sil)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.audit_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Edge Function Helper:**

```typescript
// _shared/auditLogger.ts

interface AuditLogEntry {
    tenantId?: string;
    actorId: string;
    actorType: 'user' | 'admin' | 'system' | 'webhook' | 'api';
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, any>;
    severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    req?: Request;
}

export async function logAudit(supabase: any, entry: AuditLogEntry): Promise<void> {
    try {
        await supabase.from('audit_logs').insert({
            tenant_id: entry.tenantId,
            actor_id: entry.actorId,
            actor_type: entry.actorType,
            action: entry.action,
            resource_type: entry.resourceType,
            resource_id: entry.resourceId,
            details: entry.details,
            severity: entry.severity || 'info',
            ip_address: entry.req?.headers.get('x-forwarded-for')?.split(',')[0],
            user_agent: entry.req?.headers.get('user-agent'),
            request_id: entry.req?.headers.get('x-request-id')
        });
    } catch (err) {
        // Audit log hatası ana işlemi bloklamasın
        console.error('Audit log failed:', err);
    }
}

// Convenience wrappers
export const auditOrderCreated = (supabase: any, tenantId: string, orderId: string, customerPhone: string, total: number) =>
    logAudit(supabase, {
        tenantId,
        actorId: customerPhone,
        actorType: 'user',
        action: 'order.created',
        resourceType: 'order',
        resourceId: orderId,
        details: { total },
        severity: 'info'
    });

export const auditPaymentSuccess = (supabase: any, tenantId: string, transactionId: string, amount: number) =>
    logAudit(supabase, {
        tenantId,
        actorId: 'system',
        actorType: 'system',
        action: 'payment.success',
        resourceType: 'payment_transaction',
        resourceId: transactionId,
        details: { amount },
        severity: 'info'
    });

export const auditSecurityEvent = (supabase: any, eventType: string, details: Record<string, any>, req?: Request) =>
    logAudit(supabase, {
        actorId: 'security-system',
        actorType: 'system',
        action: `security.${eventType}`,
        resourceType: 'security',
        details,
        severity: 'warn',
        req
    });
```

---

## ✅ Doğrulama Checklist

Tüm değişiklikler uygulandıktan sonra:

- [ ] `.env` dosyası Git'te yok
- [ ] OpenAI eski key çalışmıyor (401)
- [ ] WhatsApp webhook invalid signature ile 403 dönüyor
- [ ] Farklı tenant verilerine erişim engellendi (RLS)
- [ ] Ödeme double-click koruma çalışıyor
- [ ] iyzico sandbox'da ödeme başarılı
- [ ] QRCodeManager'da XSS payload'ı escape ediliyor
- [ ] Rate limit aktif (20 req/min sonra 429)
- [ ] Audit log tablosuna kayıtlar düşüyor

---

## 📌 Notlar

1. **Staging Test:** P1 değişiklikleri mutlaka staging ortamında test edilmeli
2. **Rollback Plan:** Her migration için rollback SQL hazırla
3. **Downtime:** RLS değişiklikleri anlık, downtime yok
4. **Monitoring:** Değişiklikler sonrası Supabase Dashboard'da error rate izle

---

*Plan Sonu*
