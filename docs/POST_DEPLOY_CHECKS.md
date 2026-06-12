# ✅ Hibrit Güvenlik ve Senkronizasyon - Kontrol Listesi

Bu liste, sistemin güvenlik ve veri bütünlüğü güncellemelerinin doğru çalıştığını doğrulamak için hazırlanmıştır.

## 1. 📦 Stok ve Envanter Otomasyonu (Zayi Kontrolü)

Bu test, satılan ürünlerin stoktan düştüğünü ve iptal edilenlerin "Zayi" olarak işlendiğini doğrular.

- [ ] **Adım 1: Sipariş Oluştur**
  - POS ekranını açın.
  - [x] Herhangi bir masaya (örn: Masa 5) ürün ekleyin (örn: 1x Smash Burger).
  - *Not:* Bu aşamada stok henüz düşmemelidir.

- [x] **Adım 2: Ödeme Al (Stok Düşüşü)**
  - "Ödeme Al" butonuna basın.
  - "Nakit" veya "Kredi Kartı" ile ödemeyi tamamlayın.
  - **Kontrol:** `Envanter` > `Malzemeler` sayfasına gidin. Burger ekmeği veya köftesinin stoğunun azaldığını teyit edin.
  - *(Kod Doğrulaması: `atomic_stock_deduction` fonksiyonu `paid` durumunda tetikleniyor)*

- [x] **Adım 3: İptal Et (Zayi Kaydı)**
  - Masayı tekrar açın veya "Geçmiş Siparişler"den bulun.
  - Siparişi "İptal" durumuna getirin.
  - **Kontrol:** `Envanter` > `Hareketler` sayfasına gidin.
  - *Beklenen:* Stok miktarı **GERİ ARTMAZ**. Bunun yerine işlem tipi `waste` (Zayi) olan yeni bir kayıt oluşmalıdır.
  - *(Kod Doğrulaması: `trigger_atomic_stock` iptal durumunda `waste` kaydı oluşturuyor)*

---

## 2. 🛵 Kurye ve Tenant İzolasyonu

Bu test, kuryelerin sadece yetkili oldukları restoran verilerini gördüğünü doğrular.

- [ ] **Adım 1: Kurye Girişi**
  - Bir kurye hesabıyla (`courier@test.com` vb.) sisteme giriş yapın.

- [ ] **Adım 2: Yabancı Sipariş Testi**
  - Farklı bir tarayıcıda veya gizli sekmede **Farklı Bir Restoran (Tenant B)** yöneticisi olarak giriş yapın.
  - Tenant B hesabından "Teslime Hazır" bir sipariş oluşturun.

- [ ] **Adım 3: Havuz Kontrolü**
  - Kurye ekranına geri dönün.
  - "Havuz" sekmesini yenileyin.
  - *Beklenen:* Tenant B'nin siparişi **GÖRÜNMEMELİDİR**.
  - *(Kod Doğrulaması: `get_secure_courier_pool` fonksiyonu tenant_id ile filtreliyor)*

- [x] **Adım 4: Bağlantı Testi (Opsiyonel)**
  - Yönetici panelinden bu kuryeyi Tenant B'ye bağlayın (`courier_store_links`).
  - Kurye ekranını yenileyin.
  - *Beklenen:* Sipariş artık havuzda görünmelidir.

---

## 3. 🛡️ Yetkisiz Erişim (AuthGuard)

- [ ] **Adım 1: URL Erişimi**
  - Garson veya Kurye olarak giriş yapın.
  - Tarayıcı adres çubuğuna `/settings` veya sadece yöneticilerin görebileceği bir sayfa adresi yazın.
  - *Beklenen:* "Yetkisiz Erişim" sayfasına yönlendirilmeli veya ana sayfaya atılmalıdır.
  - *(Kod Doğrulaması: `AuthGuard.jsx` strict tenant/role kontrolü yapıyor)*
