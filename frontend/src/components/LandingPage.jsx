import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, QrCode, CheckCircle, Zap, Shield, Smartphone, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const LandingPage = () => {
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [scanned, setScanned] = useState(false);

    const [ip, setIp] = useState('');
    const [phone, setPhone] = useState('');

    // Fetch IP for Legal Logs
    useEffect(() => {
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setIp(data.ip))
            .catch(e => console.error('IP Error', e));
    }, []);

    const handlePhoneChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        let formatted = raw;
        if (raw.length > 0) {
            formatted = raw.substring(0, 10); // Limit to 10 digits
            if (raw.length > 3 && raw.length <= 6) {
                formatted = `(${raw.slice(0, 3)}) ${raw.slice(3)}`;
            } else if (raw.length > 6) {
                formatted = `(${raw.slice(0, 3)}) ${raw.slice(3, 6)} ${raw.slice(6)}`;
            }
        }
        setPhone(formatted);
    };

    // Simulate QR Scan Animation
    useEffect(() => {
        const interval = setInterval(() => {
            setScanned(prev => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">

            {/* Navbar */}
            <nav className="fixed w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        SaaS AI
                    </div>
                    <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-300">
                        <a href="#features" className="hover:text-white transition-colors">Özellikler</a>
                        <a href="#demo" className="hover:text-white transition-colors">Canlı Demo</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Paketler</a>
                    </div>
                    <div className="flex space-x-4 items-center">
                        <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white">Giriş Yap</Link>

                        {/* Restaurant CTA */}
                        <a href="#pricing" className="hidden sm:block bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-bold transition-all">
                            Hemen Başla
                        </a>

                        {/* Partner CTA */}
                        <button
                            onClick={() => setShowPartnerModal(true)}
                            className="bg-slate-800 border border-slate-700 text-slate-300 px-5 py-2 rounded-full text-sm font-bold hover:bg-slate-700 hover:text-white transition-all"
                        >
                            Bayi Ol
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section id="demo" className="pt-24 pb-12 lg:pt-20 relative overflow-hidden">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />

                <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">

                    {/* Left: Content */}
                    <div className="space-y-8 animate-in slide-in-from-left duration-700">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-400">
                            <Zap className="w-3 h-3 mr-2" />
                            Yeni Nesil Restoran Otomasyonu
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight">
                            SaaS AI: <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Akıllı WhatsApp Asistanı</span>
                        </h1>

                        <h2 className="text-2xl text-slate-300 font-light border-l-4 border-purple-500 pl-4 py-2">
                            "Kazancınıza Ortak Değil, <br /> <span className="text-white font-semibold">İşinize Çözüm Ortağıyız.</span>"
                        </h2>

                        <p className="text-slate-400 text-lg max-w-xl leading-relaxed">
                            Restoranınızı fahiş komisyonlardan (%30+) kurtarın. Müşterileriniz QR kodu okutup
                            WhatsApp'tan saniyeler içinde sipariş versin; yapay zekamız tüm süreci yönetsin.
                            <br /><br />
                            <span className="text-white font-semibold">Komisyon Yok. Sürpriz Yok. Sadece Teknoloji Var.</span>
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-purple-900/20 group">
                                Komisyonsuz Dönemi Başlat
                                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="px-8 py-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium transition-all flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 mr-2" />
                                Bize Ulaşın
                            </button>
                        </div>
                    </div>

                    {/* Right: Interactive QRCode */}
                    <div className="relative animate-in slide-in-from-right duration-700 delay-200">
                        <div className="relative mx-auto w-72 h-[500px] bg-slate-900 rounded-[3rem] border-8 border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                            {/* Phone Notch */}
                            <div className="h-6 w-32 bg-slate-800 rounded-b-2xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 z-20" />

                            {/* Screen Overlay (Scan Effect) */}
                            <div className={`absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center transition-opacity duration-500 ${scanned ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                <div className="w-48 h-48 border-2 border-white/30 rounded-2xl relative flex items-center justify-center">
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500 -mt-1 -ml-1" />
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500 -mt-1 -mr-1" />
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500 -mb-1 -ml-1" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500 -mb-1 -mr-1" />

                                    <QrCode className="w-24 h-24 text-white/20 animate-pulse" />

                                    {/* Scanning Line */}
                                    <div className="absolute w-full h-0.5 bg-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,1)] animate-[scan_2s_ease-in-out_infinite]" />
                                </div>
                                <p className="mt-8 text-white font-medium animate-pulse">QR Taranıyor...</p>
                            </div>

                            {/* Chat Interface (Revealed after 'scan') */}
                            <div className="flex-1 bg-[#0b141a] p-4 pt-12 flex flex-col font-sans">
                                <div className="flex items-center space-x-3 mb-6 bg-[#202c33] p-2 rounded-lg">
                                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">🍔</div>
                                    <div>
                                        <div className="text-white text-sm font-bold">Muğla Restaurant</div>
                                        <div className="text-xs text-green-400">Çevrimiçi</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="self-end bg-[#005c4b] text-[#e9edef] p-3 rounded-lg rounded-tr-none text-xs ml-auto max-w-[80%]">
                                        Merhaba, sipariş vermek istiyorum. 🌮
                                    </div>
                                    <div className="self-start bg-[#202c33] text-[#e9edef] p-3 rounded-lg rounded-tl-none text-xs max-w-[80%] shadow-sm">
                                        Selam! Hoş geldin. 👋
                                        <br />Bugün senin için harika burgerlerimiz var.
                                    </div>
                                    <div className="self-start bg-[#202c33] text-[#e9edef] p-2 rounded-lg rounded-tl-none text-xs max-w-[80%]">
                                        <div className="w-full h-24 bg-slate-700 rounded mb-2 overflow-hidden relative">
                                            {/* Mock Burger Image */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                                                <span className="font-bold">🔥 Süper Menü</span>
                                            </div>
                                        </div>
                                        <button className="w-full bg-[#005c4b] py-1.5 rounded text-blue-200 font-bold">Sepete Ekle</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Hint */}
                        <div className="absolute -right-8 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 hidden lg:block">
                            <div className="flex items-center space-x-3">
                                <QrCode className="w-6 h-6 text-blue-400" />
                                <div className="text-xs">
                                    <div className="font-bold text-white">Canlı Test Et</div>
                                    <div className="text-slate-400">Kameranızı Okutun</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-20 bg-slate-900 relative">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">neden <span className="text-purple-400">Biz?</span></h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">Geleneksel pazaryerlerinin kısıtlamalarından kurtulun. Kendi müşteriniz, kendi veriniz, kendi kazancınız.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: Shield, title: "%0 Komisyon", desc: "Cironuzdan pay almıyoruz. Sadece sabit, düşük bir teknoloji kullanım ücreti ödersiniz." },
                            { icon: Smartphone, title: "WhatsApp Entegrasyonu", desc: "Uygulama indirme derdi yok. 85 Milyon kişinin halihazırda kullandığı WhatsApp üzerinden satış yapın." },
                            { icon: CheckCircle, title: "Tam Otomasyon", desc: "Sipariş onayı, kurye ataması ve ödeme kontrolü yapay zeka tarafından otomatik yapılır." }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-all hover:-translate-y-1 group">
                                <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
                                    <item.icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-3 group-hover:text-purple-300">{item.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 bg-slate-800/30 relative border-t border-slate-800">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Şeffaf <span className="text-blue-400">Fiyatlandırma</span></h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">Sürpriz faturalar yok. İşletmenizin büyüklüğüne göre en uygun paketi seçin.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {/* Starter Plan */}
                        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl hover:border-blue-500/50 transition-all flex flex-col">
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-slate-200">Başlangıç</h3>
                                <p className="text-slate-500 text-sm mt-2">Küçük işletmeler ve kafeler için.</p>
                                <div className="mt-6 flex items-baseline">
                                    <span className="text-4xl font-extrabold text-white">499 ₺</span>
                                    <span className="text-slate-500 ml-2">/ay</span>
                                </div>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1">
                                {['Sınırsız Sipariş', 'Tek WhatsApp Numarası', 'Temel Raporlama', 'E-Posta Desteği'].map(feature => (
                                    <li key={feature} className="flex items-center text-slate-300 text-sm">
                                        <CheckCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button className="w-full py-3 rounded-xl border border-blue-600 text-blue-400 font-bold hover:bg-blue-600 hover:text-white transition-all">
                                Hemen Başla
                            </button>
                        </div>

                        {/* Pro Plan */}
                        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-purple-500 p-8 rounded-2xl relative shadow-2xl shadow-purple-900/20 flex flex-col transform md:-translate-y-4">
                            <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                EN POPÜLER
                            </div>
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-white">Profesyonel</h3>
                                <p className="text-purple-200/60 text-sm mt-2">Büyüyen restoranlar için ideal.</p>
                                <div className="mt-6 flex items-baseline">
                                    <span className="text-5xl font-extrabold text-white">999 ₺</span>
                                    <span className="text-slate-400 ml-2">/ay</span>
                                </div>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1">
                                {['Her Şey Sınırsız', 'Özel WhatsApp API', 'AI Müşteri Temsilcisi', 'Gelişmiş Analitik', 'Öncelikli Destek', 'QR Menü Tasarımı'].map(feature => (
                                    <li key={feature} className="flex items-center text-white text-sm">
                                        <CheckCircle className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                                14 Gün Ücretsiz Dene
                            </button>
                        </div>

                        {/* Enterprise Plan */}
                        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl hover:border-blue-500/50 transition-all flex flex-col">
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-slate-200">Zincir</h3>
                                <p className="text-slate-500 text-sm mt-2">Çok şubeli işletmeler için.</p>
                                <div className="mt-6 flex items-baseline">
                                    <span className="text-4xl font-extrabold text-white">Özel</span>
                                    <span className="text-slate-500 ml-2">Fiyat</span>
                                </div>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1">
                                {['Çoklu Şube Yönetimi', 'Merkezi Stok Kontrolü', 'Özel Entegrasyonlar', '7/24 Canlı Destek', 'Dedicated Sunucu'].map(feature => (
                                    <li key={feature} className="flex items-center text-slate-300 text-sm">
                                        <CheckCircle className="w-5 h-5 text-slate-500 mr-3 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button className="w-full py-3 rounded-xl border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-all">
                                İletişime Geç
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-800 bg-slate-950 text-slate-400 text-sm">
                <div className="container mx-auto px-6 text-center">
                    <p className="mb-4">&copy; 2025 SaaS AI System. Tüm hakları saklıdır.</p>
                    <div className="flex justify-center space-x-6">
                        <Link to="/legal/kvkk" className="hover:text-white transition-colors">KVKK & Gizlilik</Link>
                        <Link to="/legal/service-contract" className="hover:text-white transition-colors">Hizmet Sözleşmesi</Link>
                    </div>
                </div>
            </footer>


            {/* Partner Application Modal */}
            {showPartnerModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPartnerModal(false)}></div>
                    <div className="relative bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white">Bayilik Başvurusu</h3>
                                <p className="text-slate-400 text-sm mt-1">Bölgenizdeki restoranları dijitalleştirin, gelir ortaklığı modeliyle kazanç sağlayın.</p>
                            </div>
                            <button onClick={() => setShowPartnerModal(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>

                        <form className="space-y-4" onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const payload = {
                                first_name: formData.get('first_name'),
                                last_name: formData.get('last_name'),
                                phone: phone, // Use formatted phone
                                city: formData.get('city'),
                                ip_address: ip,
                                user_agent: navigator.userAgent,
                                kvkk_approved: true,
                                contract_approved: true
                            };

                            try {
                                const { error } = await supabase.from('reseller_applications').insert([payload]);
                                if (error) throw error;
                                alert('Başvurunuz başarıyla alındı! Ekibimiz en kısa sürede sizinle iletişime geçecek.');
                                setShowPartnerModal(false);
                            } catch (err) {
                                alert('Hata oluştu: ' + err.message);
                            }
                        }}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">Adınız</label>
                                    <input name="first_name" type="text" required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-purple-500 outline-none" placeholder="Ahmet" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">Soyadınız</label>
                                    <input name="last_name" type="text" required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-purple-500 outline-none" placeholder="Yılmaz" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">Telefon</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-500 font-bold">+90</span>
                                    <input
                                        name="phone"
                                        type="tel"
                                        required
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 pl-12 text-white focus:border-purple-500 outline-none font-mono"
                                        placeholder="(5XX) XXX XX XX"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">Şehir / Bölge</label>
                                <input name="city" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-purple-500 outline-none" placeholder="Örn: Muğla / Menteşe" />
                            </div>

                            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
                                <h4 className="font-bold text-purple-400 text-sm mb-2">Kazanç Modeli</h4>
                                <ul className="text-xs text-slate-300 space-y-1">
                                    <li>• Kurulum Ücretinin %100'ü Sizin</li>
                                    <li>• Aylık Aboneliklerden %30'a Varan Komisyon</li>
                                    <li>• Teknik Destek Merkezden</li>
                                </ul>
                            </div>

                            <div className="flex items-start space-x-2">
                                <input type="checkbox" required className="mt-1 rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-purple-600" />
                                <label className="text-xs text-slate-400">
                                    <Link to="/legal/reseller-contract" target="_blank" className="text-purple-400 hover:text-purple-300 underline">Bayilik Sözleşmesi</Link>'ni ve <Link to="/legal/kvkk" target="_blank" className="text-purple-400 hover:text-purple-300 underline">KVKK Metnini</Link> okudum, onaylıyorum.
                                </label>
                            </div>

                            <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20">
                                Başvuruyu Gönder
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Keyframe for scanning line */}
            <style>{`
                @keyframes scan {
                    0% { top: 10%; opacity: 0; }
                    50% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
             `}</style>
        </div>
    );
};
