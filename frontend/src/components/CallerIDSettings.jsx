import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
    Phone, Save, RefreshCw, Copy, Check, X, Settings,
    PhoneCall, PhoneIncoming, PhoneMissed, Clock, User,
    Eye, EyeOff, AlertCircle, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { generateUUID } from '../lib/utils';

/**
 * CallerIDSettings - Arayan Kimliği Entegrasyonu Ayarları
 * - Provider seçimi (Telsam, Netgsm, Mobil)
 * - API credentials
 * - Webhook URL
 * - Son aramalar
 */
export const CallerIDSettings = () => {
    const { tenantId } = useOutletContext();
    // Settings State
    const [settings, setSettings] = useState({
        provider: 'telsam',
        api_username: '',
        api_password: '',
        api_key: '',
        webhook_secret: '',
        phone_lines: [],
        is_active: true,
        auto_popup: true,
        auto_create_customer: true,
        popup_duration_seconds: 30,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Recent Calls State
    const [recentCalls, setRecentCalls] = useState([]);
    const [callsLoading, setCallsLoading] = useState(false);

    // Active Tab
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'calls'

    useEffect(() => {
        if (tenantId) {
            fetchSettings();
        }
    }, [tenantId]);

    const fetchSettings = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('caller_id_settings')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (data) {
                setSettings(data);
            } else {
                // Generate webhook secret if not exists
                setSettings(prev => ({
                    ...prev,
                    webhook_secret: generateUUID()
                }));
            }
        } catch (error) {
            console.error('Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentCalls = async () => {
        if (!tenantId) return;
        setCallsLoading(true);
        try {
            const { data } = await supabase
                .from('incoming_calls')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('call_time', { ascending: false })
                .limit(50);

            setRecentCalls(data || []);
        } catch (error) {
            console.error('Calls Fetch Error:', error);
        } finally {
            setCallsLoading(false);
        }
    };

    const saveSettings = async () => {
        if (!tenantId) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('caller_id_settings')
                .upsert({
                    tenant_id: tenantId,
                    ...settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_id' });

            if (error) throw error;

            toast.success('Caller ID ayarları kaydedildi!');
        } catch (error) {
            console.error('Save Error:', error);
            toast.error('Kaydetme başarısız');
        } finally {
            setSaving(false);
        }
    };

    const getWebhookUrl = () => {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
        const provider = settings.provider;
        return `${baseUrl}/functions/v1/caller-id-webhook/${provider}?secret=${settings.webhook_secret}`;
    };

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(getWebhookUrl());
        setCopied(true);
        toast.success('Webhook URL kopyalandı!');
        setTimeout(() => setCopied(false), 2000);
    };

    const providers = [
        {
            id: 'telsam',
            name: 'Telsam',
            description: 'VoIP / Sanal Santral',
            logo: '📞',
            fields: ['api_username', 'api_password']
        },
        {
            id: 'netgsm',
            name: 'Netgsm VoIP',
            description: 'Netgsm Sanal Santral',
            logo: '🌐',
            fields: ['api_username', 'api_password']
        },
        {
            id: 'mobile_app',
            name: 'Mobil Caller ID',
            description: 'Android/iOS Uygulaması',
            logo: '📱',
            fields: ['api_key']
        },
    ];

    const getCallIcon = (status) => {
        switch (status) {
            case 'answered': return <PhoneCall className="w-4 h-4 text-green-500" />;
            case 'missed': return <PhoneMissed className="w-4 h-4 text-red-500" />;
            default: return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center h-64">
                <div className="text-gray-400 animate-pulse">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Phone className="w-7 h-7 text-blue-600" />
                        Caller ID Entegrasyonu
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Gelen aramaları görüntüle, müşterileri otomatik tanı
                    </p>
                </div>

                {/* Status Badge */}
                <div className={`px-4 py-2 rounded-xl ${settings.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                    }`}>
                    <div className="text-xs font-medium">Durum</div>
                    <div className="font-bold">{settings.is_active ? 'Aktif' : 'Pasif'}</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
                {[
                    { id: 'settings', label: 'Ayarlar', icon: Settings },
                    { id: 'calls', label: 'Son Aramalar', icon: Clock },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id === 'calls') fetchRecentCalls();
                        }}
                        className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {/* Provider Selection */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-800 mb-4">Sağlayıcı Seçimi</h3>

                        <div className="grid md:grid-cols-3 gap-4">
                            {providers.map(provider => (
                                <button
                                    key={provider.id}
                                    onClick={() => setSettings({ ...settings, provider: provider.id })}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${settings.provider === provider.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="text-3xl mb-2">{provider.logo}</div>
                                    <div className="font-bold text-gray-800">{provider.name}</div>
                                    <div className="text-sm text-gray-500">{provider.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Credentials */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-800 mb-4">API Bilgileri</h3>

                        <div className="grid md:grid-cols-2 gap-4">
                            {settings.provider !== 'mobile_app' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Kullanıcı Adı
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.api_username}
                                            onChange={(e) => setSettings({ ...settings, api_username: e.target.value })}
                                            placeholder={`${settings.provider === 'telsam' ? 'Telsam' : 'Netgsm'} kullanıcı adı`}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Şifre
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={settings.api_password}
                                                onChange={(e) => setSettings({ ...settings, api_password: e.target.value })}
                                                placeholder="API şifresi"
                                                className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {settings.provider === 'mobile_app' && (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        API Anahtarı
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.api_key}
                                        onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                                        placeholder="Mobil uygulama için API anahtarı"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Webhook URL */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                        <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Webhook URL
                        </h3>
                        <p className="text-sm text-blue-600 mb-4">
                            Bu URL'yi {settings.provider === 'telsam' ? 'Telsam' : settings.provider === 'netgsm' ? 'Netgsm' : 'mobil uygulama'} ayarlarına ekleyin
                        </p>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={getWebhookUrl()}
                                readOnly
                                className="flex-1 px-4 py-2 bg-white border border-blue-300 rounded-lg font-mono text-sm"
                            />
                            <button
                                onClick={copyWebhookUrl}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                Kopyala
                            </button>
                        </div>

                        {settings.provider === 'telsam' && (
                            <a
                                href="https://panel.telsam.com.tr"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-3"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Telsam Paneline Git
                            </a>
                        )}
                    </div>

                    {/* Popup Settings */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-800 mb-4">Popup Ayarları</h3>

                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="flex items-center gap-3">
                                    <span className="text-xl">🔔</span>
                                    <div>
                                        <span className="font-medium text-gray-700 block">Otomatik Popup</span>
                                        <span className="text-xs text-gray-500">Gelen aramada popup göster</span>
                                    </div>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_popup}
                                    onChange={(e) => setSettings({ ...settings, auto_popup: e.target.checked })}
                                    className="w-5 h-5 text-blue-600"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="flex items-center gap-3">
                                    <span className="text-xl">👤</span>
                                    <div>
                                        <span className="font-medium text-gray-700 block">Otomatik Müşteri Oluştur</span>
                                        <span className="text-xs text-gray-500">Yeni numara için müşteri kaydı oluştur</span>
                                    </div>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_create_customer}
                                    onChange={(e) => setSettings({ ...settings, auto_create_customer: e.target.checked })}
                                    className="w-5 h-5 text-blue-600"
                                />
                            </label>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="flex items-center gap-3">
                                    <span className="text-xl">⏱️</span>
                                    <div>
                                        <span className="font-medium text-gray-700 block">Popup Süresi</span>
                                        <span className="text-xs text-gray-500">Popup kaç saniye görünür</span>
                                    </div>
                                </span>
                                <input
                                    type="number"
                                    value={settings.popup_duration_seconds}
                                    onChange={(e) => setSettings({ ...settings, popup_duration_seconds: parseInt(e.target.value) || 30 })}
                                    min={5}
                                    max={120}
                                    className="w-20 px-3 py-1 border rounded-lg text-center"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Active Toggle & Save */}
                    <div className="flex gap-4">
                        <label className="flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.is_active}
                                onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
                                className="w-5 h-5 text-blue-600"
                            />
                            <span className="font-medium text-gray-700">Caller ID Aktif</span>
                        </label>

                        <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                        </button>
                    </div>
                </div>
            )}

            {/* Calls Tab */}
            {activeTab === 'calls' && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Son Aramalar</h3>
                        <button
                            onClick={fetchRecentCalls}
                            disabled={callsLoading}
                            className="p-2 text-gray-400 hover:text-blue-600"
                        >
                            <RefreshCw className={`w-5 h-5 ${callsLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {callsLoading ? (
                        <div className="p-8 text-center text-gray-400">Yükleniyor...</div>
                    ) : recentCalls.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <Phone className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p>Henüz arama kaydı yok</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {recentCalls.map(call => (
                                <div key={call.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                        {getCallIcon(call.call_status)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-800">{call.caller_phone}</span>
                                            {call.is_new_customer && (
                                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                                                    Yeni Müşteri
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500 flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {new Date(call.call_time).toLocaleString('tr-TR')}
                                            {call.customer_name && (
                                                <>
                                                    <span className="text-gray-300">•</span>
                                                    <User className="w-3 h-3" />
                                                    {call.customer_name}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {call.handled ? (
                                            <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                                <Check className="w-4 h-4" />
                                                İşlendi
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-orange-600 text-sm">
                                                <AlertCircle className="w-4 h-4" />
                                                Bekliyor
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CallerIDSettings;
