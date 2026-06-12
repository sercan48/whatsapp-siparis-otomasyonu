# SaaS Sektörel Genişleme ve Aktivasyon Planı

## Hedef
Platformu farklı sektörlere göre (butik, nargile, outdoor, fastfood, parfümeri, eczane) uyarlayarak, Super Admin üzerinden modüler lisanslama (kurye/kargo/pos) ve otomatik giriş bilgisi üretme özelliklerini entegre etmek.

## Görevler
- [x] Görev 1: `ui-demo.html` Super Admin formuna "Aktif Modüller" checkbox'ları ve "Üretilen Giriş Bilgileri" bildirim kartı eklenmesi &rarr; Doğrulama: Formda checkbox'lar görünür.
- [x] Görev 2: `createTenant(e)` fonksiyonunu güncelleyerek rastgele admin e-postası ve şifresi üretmesi, bunları `tenant_users` dizisine kaydetmesi ve ekranda göstermesi &rarr; Doğrulama: Yeni tenant ekleyince giriş bilgileri alert veya panel kartı olarak listelenir.
- [x] Görev 3: Yeni sektörleri (`boutique`, `hookah_shop`, `outdoor_shop`, `cosmetics`, `pharmacy`) `tenants` mock listesine ve form dropdown listesine ekleme &rarr; Doğrulama: Dropdown'da tüm sektörler listelenir.
- [x] Görev 4: `processBotResponse` fonksiyonuna dinamik sektörel AI varyant soruları (sos, beden, yaş onayı vb.) ve siparişin `meta_data` alanına kaydetme logic'i ekleme &rarr; Doğrulama: Butik seçildiğinde beden, fastfood seçildiğinde sos sorulur.
- [x] Görev 5: Kanban tahtasındaki butonların (`Maxijet Çağır`, `Kargoya Gönder`) kiracının `active_modules` lisanslarına göre dinamik olarak gizlenip gösterilmesi &rarr; Doğrulama: Kurye modülü kapalıysa Maxijet butonu gizlenir.

## Done When
- [x] Super Admin'den sektöre ve modüllere göre yeni bir kiracı aktif edilip giriş bilgileri alınabiliyor.
- [x] WhatsApp simülatöründe yeni eklenen butik ve fastfood sektörlerindeki ürün kişiselleştirmeleri başarıyla tamamlanıp sipariş meta verilerine yansıyor.
- [x] Kanban paneli lisanslanan modüllere göre butonları dinamik gizliyor.
