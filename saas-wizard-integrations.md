# SaaS Entegrasyon ve Sektör Sihirbazı Görev Listesi

## Hedef
Kurye/Kargo sağlayıcılarını genişletmek (Vigo, ShipEntegra), Super Admin'e kodsuz sektör oluşturma sihirbazı eklemek, iletişim/onboarding formunu kurmak, SMS/E-posta bildirim seçeneklerini aktif etmek ve AI adres/ürün özelleştirme doğrulama motorunu kurmak.

## Görevler
- [ ] Görev 1: Super Admin kiracı formuna Müşteri Adı, E-postası, Telefon Numarası alanları eklenmesi &rarr; Doğrulama: Formda bu alanlar görüntülenir.
- [ ] Görev 2: Super Admin panelinde "Kodsuz Sektör Oluşturucu Sihirbazı" arayüzü ve kaydetme script'i kurulması &rarr; Doğrulama: Yeni oluşturulan sektör listeye eklenir ve seçilebilir.
- [ ] Görev 3: Merchant Ayarlar Kartı altına Vigo, ShipEntegra, SMS/E-posta Bildirimleri ve 2FA anahtarlarının eklenmesi &rarr; Doğrulama: Ayarlar sekmesinde yeni switch'ler görünür.
- [ ] Görev 4: WhatsApp Chat robotunda `processBotResponse` fonksiyonuna AI adres doğrulama ("ev" kelimesi reddedilir) ve sos seçimi doğrulama ("pesto sos" reddedilir, Ketçap önerilir) mantıklarının eklenmesi &rarr; Doğrulama: Hatalı adres/sos girildiğinde AI hata mesajı döner.
- [ ] Görev 5: WhatsApp sohbette Havale seçildiğinde dinamik IBAN ve hesap bilgileri şablonunun listelenmesi &rarr; Doğrulama: Havale seçilince IBAN yazdırılır.

## Done When
- [ ] Super Admin'den yeni bir sektör (örneğin Market) kodsuz üretilip, bu sektöre kargo ve kurye modülleri bağımsız lisanslanabiliyor.
- [ ] Müşteri fastfood siparişinde hatalı adres girdiğinde veya geçersiz pesto sos istediğinde AI motoru bunu başarıyla filtreliyor.
- [ ] Havale seçildiğinde ilgili IBAN detayları listelenip sipariş oluşturulabiliyor.
