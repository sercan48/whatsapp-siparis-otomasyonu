# 📋 TODO List - SaaS Conversational Commerce Engine

**Son Güncelleme:** 2026-06-10  
**Proje Durumu:** 🟢 SaaS Core Transformation Complete (Multi-Tenant, Dynamic & Sektör Bağımsız Altyapı Hazır)

---

## ✅ Tamamlanan İşler (SaaS Detoks & Refactoring)

- [x] **Multi-Tenant Şema Dönüşümü:** `Supabase_Schema.sql` sıfırdan tasarlanarak tüm tablolar `tenant_id` ve RLS ile güvenli hale getirildi.
- [x] **Sektörel Kolonların Temizlenmesi:** Menü tablosu `products` yapıldı, restorana özel garson/masa/kurye özellikleri kaldırılarak `meta_data` JSONB içine aktarıldı.
- [x] **Dinamik Konfigürasyon:** Kiracı ayarlarını, dynamic ödeme yollarını, dinamik sepet sorularını tutan `tenant_configs` tablosu eklendi.
- [x] **Evrensel Asistan System Prompt:** LLM promptu dışarıdan konfigürasyon alıp kendini şekillendirecek şekilde dinamikleştirildi.
- [x] **n8n & JS Uyumlaması:** Prompt oluşturucu, kampanya motoru, sepet hesaplama ve iyzico/email parser modülleri multi-tenant JSONB yapısıyla entegre edildi.
- [x] **React Bileşenleri:** Legacy mutfak ekranı KDS kaldırılarak, durum akışlarını `order_states` üzerinden okuyan dinamik Kanban sipariş paneli oluşturuldu.
- [x] **Legacy Dosya Temizliği:** Eski restorana özel migrationlar, komisyon/bayi sistemleri ve n8n artık akışları silindi.

---

## 🔴 Öncelik 1 - Kritik (Bu Hafta)

### Güvenlik
- [ ] **SaaS RLS Hardening:**
  - `app.current_tenant_id` session parametresinin API/Edge Functions üzerinden güvenli ve sızdırılamaz şekilde iletildiğinden emin olun.
  - Test senaryoları: Farklı tenant token'larıyla çapraz sorgu denemeleri.

### Entegrasyon
- [ ] **n8n dynamic workflow deployment:**
  - `n8n_Workflow_AIAgent.json` ve `n8n_Workflow_MASTER.json` akışlarının test ortamına yüklenmesi ve Supabase webhooks bağlantılarının doğrulanması.

---

## 🟠 Öncelik 2 - Yüksek (2 Hafta İçinde)

### AI İyileştirmeleri
- [ ] **Abandoned Cart Recovery (SaaS Core):**
  - Müşteri sepeti oluşturup ödeme adımında kaldığında (veya havale/dekont göndermediğinde) WhatsApp üzerinden otomatik hatırlatma tetiklenmesi.
- [ ] **Dynamic Question Context Management:**
  - AI'ın `checkout_questions` listesindeki soruları sırayla sorarken müşterinin yarıda bırakması durumunda kaldığı yeri orders tablosundaki `meta_data.checkout_progress` içinde saklaması.

---

## 🟡 Öncelik 3 - Orta (1 Ay İçinde)

### Merchant UX
- [ ] **Evrensel Panel Ürün Yönetimi:**
  - `React_Components_Structure.jsx` içindeki Merchant Dashboard'a ürün ekleme/düzenleme formu eklenmesi (JSONB `meta_data` varyant yönetimi dahil).

---

## 📝 Referanslar & Notlar
- `Supabase_Schema.sql` - SaaS Core DB
- `n8n_Javascript_Functions.js` - Dynamic AI & Cart engine
- `React_Components_Structure.jsx` - SaaS Admin & Merchant Dashboard
