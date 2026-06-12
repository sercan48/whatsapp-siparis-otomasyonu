import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    MessageCircle, Save, ToggleLeft, ToggleRight, Percent,
    Clock, Send, Users, TrendingUp, AlertCircle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * ConversionSettings - Admin panel for platform customer conversion
 * Configures post-delivery WhatsApp messages to convert platform customers
 */
export const ConversionSettings = () => {
    const [tenantId, setTenantId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        is_enabled: false,
        discount_percentage: 15,
        message_template: `Siparişiniz teslim edildi! 🎉

%{discount} İNDİRİM kodunuz: HOSGELDIN

👉 {menu_url}

{restaurant_name}`,
        resend_after_days: 0,
        daily_message_limit: 50,
        messages_sent_today: 0
    });
    const [stats, setStats] = useState({
        totalSent: 0,
        converted: 0,
        pendingCustomers: 0
    });
    const [slug, setSlug] = useState('');

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setTenantId(user.id);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (tenantId) {
            fetchSettings();
            fetchStats();
        }
    }, [tenantId]);

    const fetchSettings = async () => {
        try {
            // Get conversion settings
            const { data, error } = await supabase
                .from('conversion_settings')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (data) {
                setSettings(data);
            }

            // Get slug for preview
            const { data: profile } = await supabase
                .from('profiles')
                .select('slug')
                .eq('id', tenantId)
                .single();

            if (profile?.slug) setSlug(profile.slug);

        } catch (error) {
            // Settings don't exist yet, use defaults
            console.log('Using default settings');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            // Total sent
            const { count: sent } = await supabase
                .from('platform_customer_conversions')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .not('message_sent_at', 'is', null);

            // Converted
            const { count: converted } = await supabase
                .from('platform_customer_conversions')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .not('converted_at', 'is', null);

            // Pending (no message yet)
            const { count: pending } = await supabase
                .from('platform_customer_conversions')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .is('message_sent_at', null);

            setStats({
                totalSent: sent || 0,
                converted: converted || 0,
                pendingCustomers: pending || 0
            });
        } catch (error) {
            console.error('Stats fetch error:', error);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('conversion_settings')
                .upsert({
                    tenant_id: tenantId,
                    ...settings,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            toast.success('Ayarlar kaydedildi!');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Kaydetme hatası: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const previewMessage = () => {
        const menuUrl = `https://yourdomain.com/m/${slug || 'restoran-adi'}`;
        return settings.message_template
            .replace('{discount}', settings.discount_percentage.toString())
            .replace('{menu_url}', menuUrl)
            .replace('{restaurant_name}', 'Restoran Adınız');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const conversionRate = stats.totalSent > 0
        ? ((stats.converted / stats.totalSent) * 100).toFixed(1)
        : 0;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl text-white">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Müşteri Dönüşümü</h2>
                        <p className="text-gray-500">Platform müşterilerini direkt siparişe yönlendirin</p>
                    </div>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Send className="w-4 h-4" />
                        <span className="text-sm">Gönderilen</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalSent}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Check className="w-4 h-4" />
                        <span className="text-sm">Dönüşen</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">Dönüşüm Oranı</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">%{conversionRate}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Bugün Kalan</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">
                        {settings.daily_message_limit - settings.messages_sent_today}
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Settings */}
                <div className="space-y-4">
                    {/* Enable Toggle */}
                    <div className="bg-white rounded-xl border p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <MessageCircle className={`w-6 h-6 ${settings.is_enabled ? 'text-green-500' : 'text-gray-400'}`} />
                                <div>
                                    <h3 className="font-semibold text-gray-800">Dönüşüm Mesajları</h3>
                                    <p className="text-sm text-gray-500">Teslim sonrası WhatsApp mesajı gönder</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, is_enabled: !settings.is_enabled })}
                                className={`p-1 rounded-full transition ${settings.is_enabled ? 'bg-green-100' : 'bg-gray-100'}`}
                            >
                                {settings.is_enabled
                                    ? <ToggleRight className="w-10 h-10 text-green-500" />
                                    : <ToggleLeft className="w-10 h-10 text-gray-400" />
                                }
                            </button>
                        </div>
                    </div>

                    {/* Discount */}
                    <div className="bg-white rounded-xl border p-6">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Percent className="w-5 h-5 text-green-500" />
                            İndirim Oranı
                        </h3>
                        <div className="flex gap-2">
                            {[10, 15, 20, 25].map(pct => (
                                <button
                                    key={pct}
                                    onClick={() => setSettings({ ...settings, discount_percentage: pct })}
                                    className={`flex-1 py-3 rounded-lg font-bold transition ${settings.discount_percentage === pct
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    %{pct}
                                </button>
                            ))}
                        </div>
                        {/* Custom Input */}
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-sm text-gray-500">veya</span>
                            <div className="flex items-center gap-1 flex-1">
                                <span className="text-gray-400">%</span>
                                <input
                                    type="number"
                                    value={settings.discount_percentage}
                                    onChange={(e) => setSettings({ ...settings, discount_percentage: parseInt(e.target.value) || 0 })}
                                    min={1}
                                    max={50}
                                    className="w-20 p-2 border rounded-lg text-center font-bold"
                                    placeholder="Özel"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Resend Policy */}
                    <div className="bg-white rounded-xl border p-6">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            Tekrar Gönderim
                        </h3>
                        <select
                            value={settings.resend_after_days}
                            onChange={(e) => setSettings({ ...settings, resend_after_days: parseInt(e.target.value) })}
                            className="w-full p-3 border rounded-lg bg-white"
                        >
                            <option value={0}>Asla tekrar gönderme</option>
                            <option value={7}>7 gün sonra</option>
                            <option value={14}>14 gün sonra</option>
                            <option value={30}>30 gün sonra</option>
                            <option value={60}>60 gün sonra</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-2">
                            Aynı müşteriye kaç gün sonra tekrar mesaj gönderilsin?
                        </p>
                    </div>

                    {/* Daily Limit */}
                    <div className="bg-white rounded-xl border p-6">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            Günlük Limit
                        </h3>
                        <input
                            type="number"
                            value={settings.daily_message_limit}
                            onChange={(e) => setSettings({ ...settings, daily_message_limit: parseInt(e.target.value) || 50 })}
                            min={1}
                            max={500}
                            className="w-full p-3 border rounded-lg"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            Spam önlemek için günlük maksimum mesaj sayısı
                        </p>
                    </div>
                </div>

                {/* Message Template & Preview */}
                <div className="space-y-4">
                    {/* Template Editor */}
                    <div className="bg-white rounded-xl border p-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Mesaj Şablonu</h3>
                        <textarea
                            value={settings.message_template}
                            onChange={(e) => setSettings({ ...settings, message_template: e.target.value })}
                            rows={8}
                            className="w-full p-3 border rounded-lg font-mono text-sm"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{'{discount}'} = İndirim %</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{'{menu_url}'} = Menü linki</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{'{restaurant_name}'} = İşletme adı</span>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
                        <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                            📱 WhatsApp Önizleme
                        </h3>
                        <div className="bg-white rounded-xl p-4 shadow-sm whitespace-pre-wrap text-gray-700">
                            {previewMessage()}
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                        <h4 className="font-semibold text-blue-800 mb-2">💡 Nasıl Çalışır?</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                            <li>• Yemeksepeti/Getir siparişi <strong>teslim edilince</strong> mesaj gider</li>
                            <li>• Aynı müşteriye spam atılmaz</li>
                            <li>• Dönüşen müşteriler otomatik takip edilir</li>
                            <li>• Menü linki QR kodlarla aynı linktir</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConversionSettings;
