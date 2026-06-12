import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Save, Upload, Palette, Type, Eye, RefreshCw, Link, Copy, Check, Clock, DollarSign, Truck, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

export const BrandingSettings = ({ tenantId: propTenantId, isReseller = false }) => {
    const context = useOutletContext();
    const tenantId = propTenantId || context?.tenantId;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [branding, setBranding] = useState({
        logo_url: null,
        primary_color: '#FF6B00',
        secondary_color: '#1F2937',
        accent_color: '#10B981',
        background_type: 'light',
        font_family: 'Inter'
    });
    const [menuSettings, setMenuSettings] = useState({
        show_prices: true,
        show_descriptions: true,
        show_images: true,
        currency_symbol: '₺',
        layout: 'grid',
        enable_notes: true,
        enable_customization: true
    });
    // New Store Settings
    const [storeSettings, setStoreSettings] = useState({
        min_order_amount: 0,
        delivery_fee: 0,
        free_delivery_threshold: 0,
        operating_hours: {
            monday: { open: '09:00', close: '23:00', closed: false },
            tuesday: { open: '09:00', close: '23:00', closed: false },
            wednesday: { open: '09:00', close: '23:00', closed: false },
            thursday: { open: '09:00', close: '23:00', closed: false },
            friday: { open: '09:00', close: '23:00', closed: false },
            saturday: { open: '09:00', close: '23:00', closed: false },
            sunday: { open: '09:00', close: '23:00', closed: false },
        },
        is_open: true
    });

    const [slug, setSlug] = useState('');
    const [slugCopied, setSlugCopied] = useState(false);
    const fileInputRef = useRef(null);

    const fonts = [
        { value: 'Inter', label: 'Inter (Modern)' },
        { value: 'Poppins', label: 'Poppins (Yuvarlak)' },
        { value: 'Roboto', label: 'Roboto (Klasik)' },
        { value: 'Playfair Display', label: 'Playfair (Şık)' },
        { value: 'Nunito', label: 'Nunito (Yumuşak)' },
    ];

    useEffect(() => {
        fetchBranding();
    }, [tenantId]);

    const fetchBranding = async () => {
        try {
            // Include store_settings in fetch
            const { data, error } = await supabase
                .from('profiles')
                .select('branding, menu_settings, store_settings, slug')
                .eq('id', tenantId)
                .single();

            if (error) throw error;
            if (data?.branding) setBranding({ ...branding, ...data.branding });
            if (data?.menu_settings) setMenuSettings({ ...menuSettings, ...data.menu_settings });

            if (data?.store_settings) {
                // Migrate old opening_time/closing_time to operating_hours if needed
                const settings = data.store_settings;
                if (!settings.operating_hours && settings.opening_time) {
                    const migratedHours = {};
                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                        migratedHours[day] = {
                            open: settings.opening_time || '09:00',
                            close: settings.closing_time || '23:00',
                            closed: false
                        };
                    });
                    settings.operating_hours = migratedHours;
                }
                setStoreSettings({ ...storeSettings, ...settings });
            }
            if (data?.slug) setSlug(data.slug);
        } catch (error) {
            console.error('Load branding error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDominantColor = (imageUrl) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let r = 0, g = 0, b = 0, count = 0;

                // Sample pixels for efficiency
                for (let i = 0; i < imageData.length; i += 40) {
                    // Skip very bright or very dark pixels
                    const total = imageData[i] + imageData[i + 1] + imageData[i + 2];
                    if (total > 50 && total < 700) {
                        r += imageData[i];
                        g += imageData[i + 1];
                        b += imageData[i + 2];
                        count++;
                    }
                }

                if (count === 0) return resolve('#FF6B00');

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                const toHex = (c) => {
                    const hex = c.toString(16);
                    return hex.length == 1 ? "0" + hex : hex;
                };

                resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
            };
            img.onerror = () => resolve('#FF6B00');
            img.src = imageUrl;
        });
    };

    const applyLogoColors = async () => {
        if (!branding.logo_url) {
            toast.error('Önce bir logo yükleyiniz');
            return;
        }

        const toastId = toast.loading('Renkler analiz ediliyor...');
        try {
            const dominant = await getDominantColor(branding.logo_url);

            // Generate secondary and accent variations
            // Simple logic: Secondary is dark gray, Accent is dominant but brighter/darker
            setBranding(prev => ({
                ...prev,
                primary_color: dominant,
                // keep others or generate smart variations if needed
            }));

            toast.success('Renkler logodan alındı!', { id: toastId });
        } catch (e) {
            toast.error('Renk analizi başarısız', { id: toastId });
        }
    };

    const handleLogoUpload = async (event) => {
        try {
            const file = event.target.files[0];
            if (!file) return;

            // Size check (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Dosya boyutu 2MB dan küçük olmalı');
                return;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${tenantId}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            setSaving(true);
            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data } = supabase.storage.from('logos').getPublicUrl(filePath);

            setBranding({ ...branding, logo_url: data.publicUrl });
            toast.success('Logo yüklendi!');

            // Auto prompt for colors
            toast((t) => (
                <div className="flex flex-col gap-2">
                    <span>Logonuzdaki renkleri temaya uygulamak ister misiniz?</span>
                    <button
                        onClick={() => { applyLogoColors(); toast.dismiss(t.id); }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                        Evet, Renkleri Uygula
                    </button>
                </div>
            ), { duration: 6000 });

        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Logo yüklenemedi');
        } finally {
            setSaving(false);
        }
    };

    const saveBranding = async () => {
        setSaving(true);
        try {
            if (isReseller) {
                // Reseller uses RPC to update tenant settings securely
                const session = localStorage.getItem('reseller_session');
                const reseller = session ? JSON.parse(session) : null;

                if (!reseller) throw new Error('Bayi oturumu bulunamadı');

                const { error } = await supabase.rpc('update_tenant_branding_by_reseller', {
                    p_reseller_id: reseller.id,
                    p_tenant_id: tenantId,
                    p_branding: branding,
                    p_menu_settings: menuSettings,
                    p_store_settings: storeSettings,
                    p_slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')
                });

                if (error) throw error;
            } else {
                // Standard Tenant Update
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        branding,
                        menu_settings: menuSettings,
                        store_settings: storeSettings, // Save store settings
                        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')
                    })
                    .eq('id', tenantId);

                if (error) throw error;
            }

            toast.success('Ayarlar başarıyla kaydedildi!');
        } catch (error) {
            console.error('Save branding error:', error);
            toast.error('Kaydetme başarısız: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const copySlug = () => {
        const url = `${window.location.origin}/m/${slug}`;
        navigator.clipboard.writeText(url);
        setSlugCopied(true);
        setTimeout(() => setSlugCopied(false), 2000);
        toast.success('Link kopyalandı');
    };

    if (loading) return <div className="p-8"><div className="animate-spin w-8 h-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div></div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Marka ve Mağaza Ayarları</h1>
                    <p className="text-slate-500">Görünüm, logo ve işletme çalışma kurallarını yönetin</p>
                </div>
                <button
                    onClick={saveBranding}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
                >
                    {saving ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent" /> : <Save className="w-5 h-5" />}
                    Değişiklikleri Kaydet
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                    {/* Store Link & Status */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Link className="w-5 h-5 text-indigo-500" />
                            Mağaza Bağlantısı & Durumu
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Mağaza Linki (Slug)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-2.5 text-slate-400 text-sm">/m/</span>
                                        <input
                                            type="text"
                                            value={slug}
                                            onChange={(e) => setSlug(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="magaza-adiniz"
                                        />
                                    </div>
                                    <button
                                        onClick={copySlug}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Linki Kopyala"
                                    >
                                        {slugCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <h3 className="font-medium text-slate-800">Mağaza Açık/Kapalı</h3>
                                    <p className="text-xs text-slate-500">Kapalıyken sipariş alımı durdurulur</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={storeSettings.is_open}
                                        onChange={(e) => setStoreSettings({ ...storeSettings, is_open: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Logo Upload */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-blue-500" />
                            Logo
                        </h2>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-blue-500 hover:bg-blue-50 transition-all group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            {branding.logo_url ? (
                                <div className="relative">
                                    <img src={branding.logo_url} alt="Logo" className="h-32 object-contain mb-4" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white rounded-lg transition-opacity">
                                        <RefreshCw className="w-6 h-6" />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Upload className="w-8 h-8" />
                                    </div>
                                    <p className="text-slate-600 font-medium">Logo yüklemek için tıklayın</p>
                                    <p className="text-slate-400 text-sm mt-1">PNG, JPG (Max 2MB)</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleLogoUpload}
                            />
                        </div>
                        {branding.logo_url && (
                            <button
                                onClick={applyLogoColors}
                                className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                            >
                                <Palette className="w-4 h-4" />
                                Sihirli Renkler (Logodan Uygula)
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* UPDATE: Store Settings (Hours, Minimums) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Sipariş & Çalışma Ayarları
                        </h2>

                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Çalışma Saatleri</label>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {[
                                    { id: 'monday', label: 'Pazartesi' },
                                    { id: 'tuesday', label: 'Salı' },
                                    { id: 'wednesday', label: 'Çarşamba' },
                                    { id: 'thursday', label: 'Perşembe' },
                                    { id: 'friday', label: 'Cuma' },
                                    { id: 'saturday', label: 'Cumartesi' },
                                    { id: 'sunday', label: 'Pazar' },
                                ].map((day) => (
                                    <div key={day.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="w-24 text-sm font-medium text-slate-700">{day.label}</div>

                                        <div className="flex-1 flex items-center gap-2">
                                            {storeSettings.operating_hours?.[day.id]?.closed ? (
                                                <div className="flex-1 text-center py-1 text-xs font-bold text-red-500 bg-red-50 rounded-lg">Kapalı</div>
                                            ) : (
                                                <>
                                                    <input
                                                        type="time"
                                                        value={storeSettings.operating_hours?.[day.id]?.open || '09:00'}
                                                        onChange={(e) => {
                                                            const newHours = { ...storeSettings.operating_hours };
                                                            newHours[day.id] = { ...newHours[day.id], open: e.target.value };
                                                            setStoreSettings({ ...storeSettings, operating_hours: newHours });
                                                        }}
                                                        className="flex-1 px-2 py-1 text-xs bg-white border rounded shadow-sm outline-none"
                                                    />
                                                    <span className="text-slate-400">-</span>
                                                    <input
                                                        type="time"
                                                        value={storeSettings.operating_hours?.[day.id]?.close || '23:00'}
                                                        onChange={(e) => {
                                                            const newHours = { ...storeSettings.operating_hours };
                                                            newHours[day.id] = { ...newHours[day.id], close: e.target.value };
                                                            setStoreSettings({ ...storeSettings, operating_hours: newHours });
                                                        }}
                                                        className="flex-1 px-2 py-1 text-xs bg-white border rounded shadow-sm outline-none"
                                                    />
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                const newHours = { ...storeSettings.operating_hours };
                                                newHours[day.id] = { ...newHours[day.id], closed: !newHours[day.id]?.closed };
                                                setStoreSettings({ ...storeSettings, operating_hours: newHours });
                                            }}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${storeSettings.operating_hours?.[day.id]?.closed
                                                ? 'bg-green-500 text-white'
                                                : 'bg-slate-200 text-slate-600'
                                                }`}
                                        >
                                            {storeSettings.operating_hours?.[day.id]?.closed ? 'AÇ' : 'KAPAT'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-green-600" />
                                    Minimum Sipariş Tutarı (₺)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={storeSettings.min_order_amount}
                                    onChange={(e) => setStoreSettings({ ...storeSettings, min_order_amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Bu tutarın altındaki siparişler kabul edilmeyecektir.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-indigo-600" />
                                    Paket Servis Ücreti (₺)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={storeSettings.delivery_fee}
                                    onChange={(e) => setStoreSettings({ ...storeSettings, delivery_fee: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Her siparişe eklenecek sabit kurye ücreti (Maxijett vb).</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-orange-600" />
                                    Ücretsiz Teslimat Limiti (₺)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={storeSettings.free_delivery_threshold || 0}
                                    onChange={(e) => setStoreSettings({ ...storeSettings, free_delivery_threshold: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Bu tutarın üzerindeki siparişlerde teslimat ücreti alınmaz. (0 = Devre dışı)</p>
                            </div>
                        </div>
                    </div>

                    {/* Branding Colors */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-purple-500" />
                            Renk Paleti
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Ana Renk</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={branding.primary_color}
                                        onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                                        className="h-10 w-full rounded cursor-pointer border border-slate-200"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Vurgu Rengi</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={branding.accent_color}
                                        onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                                        className="h-10 w-full rounded cursor-pointer border border-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Font Selection */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Type className="w-5 h-5 text-indigo-500" />
                            Yazı Tipi
                        </h2>
                        <div className="grid grid-cols-1 gap-2">
                            {fonts.map((font) => (
                                <label key={font.value} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${branding.font_family === font.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="font_family"
                                            value={font.value}
                                            checked={branding.font_family === font.value}
                                            onChange={(e) => setBranding({ ...branding, font_family: e.target.value })}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
