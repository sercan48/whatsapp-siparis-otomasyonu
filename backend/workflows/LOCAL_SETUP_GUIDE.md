# n8n Local Setup with ngrok - Adım Adım Kılavuz

## 🎯 Durum
- ✅ n8n local'de çalışıyor (`http://localhost:5678`)
- ✅ WhatsApp credentials hazır
- ✅ Supabase credentials hazır
- ⚠️ WhatsApp webhook için **HTTPS public URL** gerekli → ngrok kullanacağız

---

## 📝 Adımlar

### 1. ngrok Kurulumu (WhatsApp Webhook için HTTPS)

WhatsApp, webhook URL'inin HTTPS olmasını zorunlu kılar. Local n8n'i internete açmak için ngrok kullanacağız.

#### A) ngrok İndir ve Kur
```powershell
# Chocolatey ile (önerilir)
choco install ngrok

# Veya manuel: https://ngrok.com/download
```

#### B) ngrok Account Oluştur
1. https://dashboard.ngrok.com/signup → Kayıt ol
2. https://dashboard.ngrok.com/get-started/your-authtoken → Token'ı kopyala

#### C) ngrok Auth Token Ayarla
```powershell
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

#### D) n8n için Tunnel Aç
```powershell
ngrok http 5678
```

**Çıktı örneği:**
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5678
```

✅ `https://abc123.ngrok.io` → **Bu sizin public n8n URL'iniz!**

> ⚠️ **Önemli**: ngrok free tier'da her yeniden başlatmada URL değişir. Kalıcı URL için ngrok Pro gerekir veya production'da gerçek hosting kullanın.

---

### 2. n8n Environment Variables Ayarlama

#### Yöntem 1: n8n UI'dan (Önerilir)

1. n8n'i açın: `http://localhost:5678`
2. Sağ üst **Settings** (⚙️) → **Variables**
3. Aşağıdaki değişkenleri ekleyin:

| Key | Value |
|-----|-------|
| `WHATSAPP_PHONE_ID` | `904426252753907` |
| `WHATSAPP_TOKEN` | `EAAT5BQ39...` (uzun token) |
| `WHATSAPP_VERIFY_TOKEN` | `resto123` |
| `OPENAI_API_KEY` | `sk-proj-KXhjwV...` |
| `SUPABASE_URL` | `https://pcmlhgjphgquobcdpjpd.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJ...` |

#### Yöntem 2: .env Dosyası

n8n'in data klasöründe `.env` oluşturun:

**Windows**:
```powershell
# n8n data klasörü genelde:
C:\Users\$env:USERNAME\.n8n\.env
```

Dosya içeriği: `.env.n8n` dosyasındaki tüm değişkenleri kopyalayın.

---

### 3. Workflow'ları Import Etme

#### A) Tüm Workflow'ları Sırayla Import

1. n8n'de **Workflows** → **Import from File**
2. Aşağıdaki dosyaları **sırayla** seçin:

```
backend/workflows/1_Master_Webhook.json
backend/workflows/2_AI_Order_Processor.json
backend/workflows/3_Order_Fulfillment.json
backend/workflows/4_Status_Updater.json
backend/workflows/5_New_Reseller_Alert.json
backend/workflows/6_Customer_Retention.json
backend/workflows/7_AI_Dispute_Resolver.json
```

#### B) Her Workflow'u Kontrol

Import sonrası her workflow'da:
- ❌ Kırmızı node varsa → Environment variable eksik demektir
- ✅ Tüm node'lar yeşil/gri → Hazır

---

### 4. WhatsApp Webhook Yapılandırması

#### A) n8n'de Webhook URL'ini Al

1. `1_Master_Webhook` workflow'unu açın
2. **WhatsApp Webhook** node'una tıklayın
3. **Production URL**'yi kopyalayın:

**Şöyle olmalı:**
```
https://abc123.ngrok.io/webhook/whatsapp-webhook
```

#### B) Meta Business Manager'da Webhook Ayarla

1. Meta Business Manager'a git: https://business.facebook.com
2. **WhatsApp Accounts** → **[Hesabınız]** → **WhatsApp Manager**
3. Sol menü: **Configuration** → **Webhook** → **Edit**

**Ayarlar:**
- **Callback URL**: `https://abc123.ngrok.io/webhook/whatsapp-webhook`
- **Verify Token**: `resto123`
- **Subscribe to**:
  - ✅ `messages`
  - ✅ `message_status`

4. **Verify and Save** → Meta webhook'u test edecek

**Beklenen**: ✅ Yeşil tik (Verified)

---

### 5. İlk Test

#### A) ngrok ve n8n Çalışıyor mu?

```powershell
# Terminal 1: ngrok
ngrok http 5678

# Terminal 2: n8n (zaten çalışıyorsa skip)
n8n start
```

#### B) Workflow'ları Aktive Et

n8n'de her workflow'u açın ve **Active** toggle'ını AÇIN:
- ✅ `1_Master_Webhook` → **Active**
- ✅ `2_AI_Order_Processor` → **Active**
- ✅ `3_Order_Fulfillment` → **Active**

#### C) WhatsApp'tan Test Mesajı Gönder

WhatsApp'tan Meta Business numaranıza:
```
Merhaba
```

**Beklenen Sonuç:**
1. n8n **Executions** sekmesinde yeni execution görünmeli
2. Bot size WhatsApp'tan yanıt vermeli: "Merhaba! Size nasıl yardımcı olabilirim?"

---

### 6. Debug \u0026 Troubleshooting

#### Sorun: Webhook çalışmıyor

**1. ngrok çalışıyor mu?**
```powershell
curl https://your-ngrok-url.ngrok.io/webhook-test
```

**2. n8n webhook node'u aktif mi?**
- `1_Master_Webhook` → **Active** olmalı

**3. Meta webhook verified mı?**
- Meta Manager → Configuration → Webhook → Yeşil tik var mı?

#### Sorun: Bot yanıt vermiyor

**1. OpenAI API Key doğru mu?**
```powershell
# n8n Variables'da kontrol et
```

**2. Execution loglarına bak**
- n8n → Executions → Son execution → Error mesajı var mı?

**3. WhatsApp token süresi dolmuş mu?**
- Meta'da yeni token oluştur (System Users → Generate Token)

#### Sorun: Supabase'e yazamıyor

**1. Supabase URL doğru mu?**
- `.co` ile bitmeli (`.cov` değil)

**2. RLS policies kapalı mı?** (Test için)
```sql
-- Supabase SQL Editor
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
```

---

### 7. Production'a Geçiş (Opsiyonel)

ngrok free tier sınırlamaları:
- ❌ Her restart'ta URL değişir
- ❌ Maximum 40 connection
- ❌ Bazen yavaş

**Production için:**
- Railway.app (5 dakikada deploy)
- Render.com (free tier var)
- Kendi VPS'iniz (DigitalOcean, Hetzner)

---

## ✅ Final Checklist

Test öncesi kontrol:
- [ ] ngrok çalışıyor, HTTPS URL'i var
- [ ] n8n environment variables set
- [ ] Tüm 7 workflow import edildi
- [ ] `1_Master_Webhook` aktif
- [ ] Meta webhook verified
- [ ] WhatsApp test mesajı gönderildi

Hepsi ✅ ise → Sistem hazır! 🚀

---

## 🆘 Yardım Gerekirse

Herhangi bir adımda takılırsanız:
1. Ekran görüntüsü alın (error, settings, vs.)
2. n8n execution log'unu kopyalayın
3. Bana gönderin, beraber düzeltelim!
