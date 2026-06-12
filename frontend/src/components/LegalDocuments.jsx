import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, Briefcase } from 'lucide-react';

export const LegalDocuments = () => {
    const { type } = useParams();

    const renderContent = () => {
        switch (type) {
            case 'kvkk':
                return <KVKKContent />;
            case 'reseller-contract':
                return <ResellerContractContent />;
            case 'service-contract':
                return <ServiceContractContent />;
            default:
                return <div className="p-8 text-center">Belge bulunamadı.</div>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Ana Sayfaya Dön
                    </Link>
                    <div className="font-bold text-gray-900 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        Hukuki Belgeler
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 md:p-12">
                    {renderContent()}
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-8 text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} Whatsapp Sipariş Otomasyonu. Tüm hakları saklıdır.</p>
            </footer>
        </div>
    );
};

const KVKKContent = () => (
    <article className="prose prose-blue max-w-none">
        <div className="flex items-center mb-6">
            <Shield className="w-10 h-10 text-green-600 mr-4" />
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 m-0">KVKK ve Gizlilik Politikası</h1>
        </div>

        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded text-sm text-blue-800 mb-8">
            <strong>Kişisel Verilerin Korunması Kanunu (KVKK) Hakkında Bilgilendirme</strong><br />
            Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca kişisel verilerinizin toplanması, işlenmesi, aktarılması ve haklarınız konusunda sizi bilgilendirmek amacıyla hazırlanmıştır.
        </div>

        <h3>1. Veri Sorumlusu</h3>
        <p>Whatsapp Sipariş Otomasyonu ("Şirket") olarak, veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan amaçlar kapsamında işlemekteyiz.</p>

        <h3>2. İşlenen Kişisel Veriler</h3>
        <p>Hizmetlerimizi kullanırken işlenebilecek verileriniz şunlardır:</p>
        <ul>
            <li><strong>Kimlik Bilgileri:</strong> Ad, soyad.</li>
            <li><strong>İletişim Bilgileri:</strong> Telefon numarası, açık adres. (Adres verileri teslimat sonrası 30 gün içinde anonimleştirilir).</li>
            <li><strong>İşlem Güvenliği:</strong> IP adresi, işlem kayıtları, giriş-çıkış bilgileri.</li>
            <li><strong>Pazarlama Verileri:</strong> Alışveriş geçmişi, doğum tarihi (açık rıza ile), çerez kayıtları.</li>
        </ul>

        <h3>3. Emsal Yargı Kararları ve Açık Rıza</h3>
        <p>Danıştay ve Anayasa Mahkemesi kararları uyarınca, elektronik ticari ileti (SMS/WhatsApp) gönderimi açık rızanıza tabidir. Sistemimize kayıt olurken veya sipariş verirken onayladığınız metin ile:</p>
        <ul>
            <li>WhatsApp ve SMS üzerinden sipariş bilgilendirmesi almayı,</li>
            <li>Doğum günü ve özel günlerde kampanya bildirimleri almayı (reddetme hakkınız saklı kalarak) kabul etmiş sayılırsınız.</li>
        </ul>

        <h3>4. Kişisel Verilerin Aktarılması</h3>
        <p>Verileriniz, siparişin teslimi amacıyla ilgili restoran işletmesiyle ve yasal zorunluluklar dahilinde yetkili kamu kurumlarıyla paylaşılabilir. Harici üçüncü taraf reklam ağlarıyla verileriniz <strong>paylaşılmaz</strong>.</p>

        <h3>5. Haklarınız</h3>
        <p>KVKK’nın 11. maddesi uyarınca başvurarak verilerinizin silinmesini, düzeltilmesini veya anonimleştirilmesini talep edebilirsiniz.</p>
    </article>
);

const ResellerContractContent = () => (
    <article className="prose prose-blue max-w-none">
        <div className="flex items-center mb-6">
            <Briefcase className="w-10 h-10 text-purple-600 mr-4" />
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 m-0">Bayilik ve Çözüm Ortaklığı Sözleşmesi</h1>
        </div>

        <div className="text-sm text-gray-500 mb-8">Son Güncelleme: 09.12.2025</div>

        <h3>1. Taraflar</h3>
        <p>İşbu sözleşme, Whatsapp Sipariş Otomasyonu ("Sağlayıcı") ile sisteme kayıt olan ve başvurusu onaylanan bayi ("Bayi") arasında akdedilmiştir.</p>

        <h3>2. Sözleşmenin Konusu</h3>
        <p>İşbu Sözleşme, Sağlayıcı'nın geliştirdiği yazılım ürünlerinin Bayi tarafından üçüncü taraf restoran işletmelerine ("Müşteri") pazarlanması, satışı ve teknik desteği konularındaki hak ve yükümlülükleri düzenler.</p>

        <h3>3. Bayinin Hak ve Yükümlülükleri</h3>
        <ul>
            <li>Bayi, Sağlayıcı'nın ticari itibarını korumakla yükümlüdür.</li>
            <li>Bayi, kendisine atanan Müşterilere 1. seviye teknik destek sağlamakla yükümlüdür.</li>
            <li>Bayi, sistem üzerinden belirtilen komisyon oranları (Tier sistemine göre Bronze/Silver/Gold) üzerinden hak ediş elde eder.</li>
            <li>Bayi, Müşterilerden tahsil ettiği ödemeleri (kendi üzerinden geçiyorsa) en geç 3 iş günü içinde Sağlayıcı'ya bildirmekle yükümlüdür.</li>
        </ul>

        <h3>4. Komisyon ve Ödemeler</h3>
        <p>Tier sistemine göre komisyon oranları:</p>
        <ul>
            <li><strong>Bronze:</strong> %100 Kurulum Ücreti, %10 Aylık Komisyon.</li>
            <li><strong>Silver:</strong> %0 Kurulum Ücreti (veya indirimli), %30 Aylık Komisyon.</li>
            <li><strong>Gold:</strong> Özel anlaşmalı oranlar.</li>
        </ul>
        <p>Ödemeler, her ayın 1'i ile 5'i arasında Bayi'nin belirttiği banka hesabına havale edilir.</p>

        <h3>5. Rekabet Etmeme</h3>
        <p>Bayi, sözleşme süresince Sağlayıcı'nın doğrudan rakibi olan başka bir WhatsApp sipariş otomasyonu ürününü aynı bölgede aktif olarak pazarlayamaz.</p>

        <h3>6. Fesih</h3>
        <p>Taraflar, 15 gün önceden yazılı bildirimde bulunarak sözleşmeyi feshedebilir. Yüz kızartıcı suçlar veya marka itibarına zarar verme durumunda Sağlayıcı sözleşmeyi tek taraflı ve derhal feshetme hakkına sahiptir.</p>
    </article>
);

const ServiceContractContent = () => (
    <article className="prose prose-blue max-w-none">
        <div className="flex items-center mb-6">
            <FileText className="w-10 h-10 text-blue-600 mr-4" />
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 m-0">Mesafeli Hizmet Satış Sözleşmesi</h1>
        </div>

        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded text-sm text-yellow-800 mb-8">
            <strong>ÖNEMLİ:</strong> Bu sözleşme, sisteme kayıt olan Restoran/İşletme ile Sağlayıcı arasındaki SaaS (Hizmet Olarak Yazılım) aboneliğini kapsar.
        </div>

        <h3>1. Konu</h3>
        <p>İşbu sözleşmenin konusu, İşletme'nin ("Alıcı"), Sağlayıcı'ya ait WhatsApp Sipariş Otomasyonu yazılımını kiralaması ve hizmetten yararlanmasına ilişkin esasların belirlenmesidir.</p>

        <h3>2. Hizmet Kapsamı</h3>
        <p>Sağlayıcı, 7/24 çalışır durumda bulut tabanlı sipariş yönetim paneli, WhatsApp bot entegrasyonu ve raporlama araçlarını Alıcı'nın kullanımına sunar. Planlı bakım çalışmaları nedeniyle oluşan kesintiler hizmet ayıbı sayılmaz (%99.5 Uptime Hedefi).</p>

        <h3>3. Abonelik ve Ödeme</h3>
        <ul>
            <li>Hizmet bedeli aylık abonelik esasına dayanır.</li>
            <li>Ödemeler kredi kartı veya havale yoluyla peşin tahsil edilir.</li>
            <li>Ödeme yapılmaması durumunda Sağlayıcı, hizmeti 3 gün içinde askıya alma hakkına sahiptir.</li>
        </ul>

        <h3>4. Cayma Hakkı</h3>
        <p>6502 sayılı Tüketicinin Korunması Kanunu ve Mesafeli Sözleşmeler Yönetmeliği uyarınca; <strong>elektronik ortamda anında ifa edilen hizmetler</strong> (yazılım lisansları, SaaS abonelikleri) cayma hakkının istisnaları kapsamındadır. Bu nedenle, hizmet aktivasyonu gerçekleştikten sonra ücret iadesi yapılmaz.</p>

        <h3>5. Uyuşmazlık Çözümü</h3>
        <p>İşbu sözleşmeden doğan uyuşmazlıklarda İstanbul (Merkez) Mahkemeleri ve İcra Daireleri yetkilidir.</p>
    </article>
);
