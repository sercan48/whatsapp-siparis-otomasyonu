# Meta WhatsApp Webhook Yapılandırması

## 🎯 Aktif ngrok URL
```
https://max-beardlike-deludingly.ngrok-free.dev
```

## Webhook Callback URL
```
https://max-beardlike-deludingly.ngrok-free.dev/webhook/whatsapp-webhook
```

## Verify Token
```
resto123
```

---

## 📋 Meta Business Manager'da Yapılacaklar

### Adım 1: Webhook Sayfasına Git
1. https://business.facebook.com → Giriş
2. Sol menü: **WhatsApp Accounts** → **[Hesabınız]**
3. **WhatsApp Manager** açılacak
4. Sol sidebar: **Configuration** (veya "Yapılandırma")
5. **Webhook** bölümü → **Edit** (veya "Düzenle")

### Adım 2: Webhook Ayarlarını Gir

| Alan | Değer |
|------|-------|
| **Callback URL** | `https://max-beardlike-deludingly.ngrok-free.dev/webhook/whatsapp-webhook` |
| **Verify Token** | `resto123` |

### Adım 3: Subscribe (Abone Ol)
Şu alanları işaretleyin:
- ✅ **messages** (ZORUNLU)
- ✅ **message_status** (opsiyonel ama önerilir)

### Adım 4: Verify and Save
- Yeşil ✅ işareti görmelisiniz
- Eğer kırmızı ❌ varsa → n8n workflow aktif olmayabilir

---

## ⚠️ ÖNEMLİ: n8n Workflow Aktif Olmalı!

Meta webhook'u verify etmeden ÖNCE:
1. n8n'de `1_Master_Webhook` workflow'unu açın
2. **Active** toggle'ını AÇIN
3. Sonra Meta'da Save yapın

---

## 🧪 Test URL'leri

### n8n Çalışıyor mu?
```
https://max-beardlike-deludingly.ngrok-free.dev
```
Bu URL'e gittiğinizde n8n login sayfası görmelisiniz.

### Webhook Test
```
https://max-beardlike-deludingly.ngrok-free.dev/webhook/whatsapp-webhook
```
GET isteği atarsanız "Workflow not found" veya benzeri mesaj görürsünüz (bu normal).
