import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Save, ArrowLeft, MessageSquare, Globe, Phone, Store, Bell, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const TenantConfigPage = ({ tenantId, tenantName, onBack }) => {
    const [config, setConfig] = useState({
        whatsapp_api_token: '',
        whatsapp_phone_number_id: '',
        whatsapp_business_account_id: '',
        whatsapp_webhook_verify_token: '',
        business_name: '',
        business_phone: '',
        business_address: '',
        welcome_message: 'Merhaba! Siparişinizi almak için hazırım. Lütfen menüyü inceleyip seçiminizi yapın.',
        order_confirmation_message: 'Siparişiniz alındı! Hazır olduğunda size haber vereceğiz.',
        delivery_message: 'Siparişiniz yola çıktı! Afiyet olsun.',
        pos_integration_enabled: false,
        delivery_integration_enabled: false,
        is_active: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exists, setExists] = useState(false);

    useEffect(() => {
        if (tenantId) fetchConfig();
    }, [tenantId]);

    const fetchConfig = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('tenant_configs')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (data) {
            setConfig({ ...config, ...data });
            setExists(true);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (exists) {
                // Update
                const { error } = await supabase
                    .from('tenant_configs')
                    .update(config)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('tenant_configs')
                    .insert({ ...config, tenant_id: tenantId });
                if (error) throw error;
                setExists(true);
            }
            toast.success('Konfigürasyon kaydedildi!');
        } catch (error) {
            console.error('Save Error:', error);
            toast.error('Kayıt başarısız: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Müşteri Konfigürasyonu</h1>
                    <p className="text-gray-500">{tenantName || tenantId}</p>
                </div>
            </div>

            {/* Status Badge */}
            <div className={`mb-6 p-3 rounded-lg flex items-center gap-2 ${config.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {config.is_active ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="font-medium">{config.is_active ? 'Aktif' : 'Pasif'}</span>
                <button
                    onClick={() => updateField('is_active', !config.is_active)}
                    className="ml-auto text-sm underline"
                >
                    {config.is_active ? 'Devre Dışı Bırak' : 'Aktifleştir'}
                </button>
            </div>

            {/* WhatsApp API Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-800">WhatsApp Business API</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                        <input
                            type="password"
                            value={config.whatsapp_api_token}
                            onChange={(e) => updateField('whatsapp_api_token', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="EAABx..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                        <input
                            type="text"
                            value={config.whatsapp_phone_number_id}
                            onChange={(e) => updateField('whatsapp_phone_number_id', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="1234567890..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Account ID</label>
                        <input
                            type="text"
                            value={config.whatsapp_business_account_id}
                            onChange={(e) => updateField('whatsapp_business_account_id', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="1234567890..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Verify Token</label>
                        <input
                            type="text"
                            value={config.whatsapp_webhook_verify_token}
                            onChange={(e) => updateField('whatsapp_webhook_verify_token', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="my_secret_token"
                        />
                    </div>
                </div>
            </div>

            {/* Business Info Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Store className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-800">İşletme Bilgileri</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">İşletme Adı</label>
                        <input
                            type="text"
                            value={config.business_name}
                            onChange={(e) => updateField('business_name', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Lezzet Dünyası"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                        <input
                            type="text"
                            value={config.business_phone}
                            onChange={(e) => updateField('business_phone', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="+90 532 123 4567"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                        <input
                            type="text"
                            value={config.business_address}
                            onChange={(e) => updateField('business_address', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="İstanbul, Türkiye"
                        />
                    </div>
                </div>
            </div>

            {/* Bot Messages Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-bold text-gray-800">Bot Mesajları</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Karşılama Mesajı</label>
                        <textarea
                            value={config.welcome_message}
                            onChange={(e) => updateField('welcome_message', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none h-20"
                            placeholder="Merhaba! Hoş geldiniz..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sipariş Onay Mesajı</label>
                        <textarea
                            value={config.order_confirmation_message}
                            onChange={(e) => updateField('order_confirmation_message', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none h-20"
                            placeholder="Siparişiniz alındı..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teslimat Mesajı</label>
                        <textarea
                            value={config.delivery_message}
                            onChange={(e) => updateField('delivery_message', e.target.value)}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none h-20"
                            placeholder="Siparişiniz yola çıktı..."
                        />
                    </div>
                </div>
            </div>

            {/* Integrations Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-orange-600" />
                    <h2 className="text-lg font-bold text-gray-800">Entegrasyonlar</h2>
                </div>

                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.pos_integration_enabled}
                            onChange={(e) => updateField('pos_integration_enabled', e.target.checked)}
                            className="w-5 h-5 rounded text-orange-600"
                        />
                        <span className="font-medium">POS Entegrasyonu</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.delivery_integration_enabled}
                            onChange={(e) => updateField('delivery_integration_enabled', e.target.checked)}
                            className="w-5 h-5 rounded text-orange-600"
                        />
                        <span className="font-medium">Teslimat Entegrasyonu</span>
                    </label>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 shadow-lg transition-all
                        ${saving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>
        </div>
    );
};
