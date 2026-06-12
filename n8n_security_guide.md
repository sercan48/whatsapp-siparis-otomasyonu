# n8n Güvenlik ve Kurulum Rehberi

Henüz n8n kurgularını yapmadığınız için, ileride işinize yarayacak teknik güvenlik ayarlarını buraya not ediyorum. Bu adımlar, sisteminizi dış saldırılara (botlar, fake istekler) karşı korur.

## 1. Webhook Güvenliği (HMAC Doğrulama)
WhatsApp'tan gelen her mesajın gerçekten WhatsApp'tan geldiğini anlamak için "HMAC SHA256" imzası kontrol edilir.

**Nasıl Yapılır?**
1. Meta App Dashboard > WhatsApp > Configuration sayfasından bir `Verify Token` belirleyin.
2. n8n'de Webhook noduna gelen `X-Hub-Signature-256` başlığını (header) okuyun.
3. n8n içinde bir **Crypto** nodu veya **Function** nodu kullanarak şu işlemi yapın:
   - Gelen Ham Veri (Body) + Sizin Gizli Anahtarınız (App Secret) -> SHA256 Hash üretin.
   - Bu Hash, gelen `X-Hub-Signature` ile aynı mı?
   - Aynıysa devam et, değilse durdur.

## 2. Rate Limiting (Hız Sınırı)
Bir saldırgan saniyede 1000 mesaj atarak n8n sunucunuzu kilitleyebilir. Bunu engellemek için Cloudflare kullanıyorsanız:

1. Cloudflare Panel > Security > WAF > Rate Limiting Rules.
2. Kural Oluştur:
   - URL Path: `/webhook` içeriyorsa
   - Request Rate: 10 saniyede 50 isteği geçerse
   - Action: **Block** (Engelle) veya **Managed Challenge** (Doğrulama sor).

## 3. Veri Gizliliği (Otomatik Maskeleme)
Veritabanında oluşturduğumuz `mask_old_customer_data` SQL fonksiyonunu n8n üzerinden her gece çalıştırın.

**n8n Akışı:**
`Schedule Trigger (Every Day at 03:00)` -> `Postgres Node (Execute Query)` -> `SELECT public.mask_old_customer_data();`

Bu sayede 30 günden eski siparişlerin adresleri otomatik olarak `***` şeklinde gizlenir.
