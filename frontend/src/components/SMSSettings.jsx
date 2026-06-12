import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    MessageSquare, Save, RefreshCw, Send, Settings,
    Edit2, Trash2, Plus, Check, X, Eye, EyeOff,
    Smartphone, Clock, AlertTriangle, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * SMSSettings - Netgsm SMS Entegrasyonu Ayarları
 * - API credentials
 * - Şablon yönetimi
 * - Otomatik SMS toggle'ları
 * - Bakiye sorgulama
 * - Gönderim geçmişi
 */
export const SMSSettings = () => {
    // Settings State
    const [settings, setSettings] = useState({
        api_username: '',
        api_password: '',
        sender_title: '',
        is_active: true,
        auto_order_received: true,
        auto_order_preparing: false,
        auto_order_on_way: true,
        auto_order_delivered: true,
        auto_order_cancelled: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Balance State
    const [balance, setBalance] = useState(null);
    const [checkingBalance, setCheckingBalance] = useState(false);

    // Templates State
    const [templates, setTemplates] = useState([]);
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Logs State
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Active Tab
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'templates' | 'logs'

    // Test SMS State
    const [testPhone, setTestPhone] = useState('');
    const [sendingTest, setSendingTest] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchTemplates();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('sms_settings')
                .select('*')
                .eq('tenant_id', user.id)
                .single();

            if (data) {
                setSettings(data);
                setBalance(data.sms_balance);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('sms_templates')
                .select('*')
                .eq('tenant_id', user.id)
                .order('trigger_type');

            setTemplates(data || []);
        } catch (error) {
            console.error('Templates Fetch Error:', error);
        }
    };

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('sms_logs')
                .select('*')
                .eq('tenant_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            setLogs(data || []);
        } catch (error) {
            console.error('Logs Fetch Error:', error);
        } finally {
            setLogsLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('sms_settings')
                .upsert({
                    tenant_id: user.id,
                    ...settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_id' });

            if (error) throw error;

            toast.success('SMS ayarları kaydedildi!');
        } catch (error) {
            console.error('Save Error:', error);
            toast.error('Kaydetme başarısız');
        } finally {
            setSaving(false);
        }
    };

    const checkBalance = async () => {
        setCheckingBalance(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const response = await supabase.functions.invoke('sms-sender', {
                body: null,
                method: 'GET',
                headers: {},
            });

            // Alternative: Direct fetch to edge function
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-sender/balance?tenant_id=${user.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                    }
                }
            );

            const data = await res.json();

            if (data.balance !== undefined) {
                setBalance(data.balance);
                toast.success(`Bakiye: ${data.balance} SMS`);
            } else {
                toast.error(data.error || 'Bakiye sorgulama başarısız');
            }
        } catch (error) {
            console.error('Balance Check Error:', error);
            toast.error('Bakiye sorgulanamadı');
        } finally {
            setCheckingBalance(false);
        }
    };

    const sendTestSMS = async () => {
        if (!testPhone || testPhone.length < 10) {
            toast.error('Geçerli bir telefon numarası girin');
            return;
        }

        setSendingTest(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-sender/send`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tenant_id: user.id,
                        phone: testPhone,
                        message: 'Bu bir test SMS mesajıdır. SMS entegrasyonunuz başarıyla çalışıyor! 🎉'
                    })
                }
            );

            const data = await res.json();

            if (data.success) {
                toast.success('Test SMS gönderildi!');
                setTestPhone('');
            } else {
                toast.error(data.error || 'Gönderim başarısız');
            }
        } catch (error) {
            console.error('Test SMS Error:', error);
            toast.error('Test SMS gönderilemedi');
        } finally {
            setSendingTest(false);
        }
    };

    const saveTemplate = async (template) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('sms_templates')
                .upsert({
                    ...template,
                    tenant_id: user.id,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success('Şablon kaydedildi!');
            setEditingTemplate(null);
            fetchTemplates();
        } catch (error) {
            console.error('Template Save Error:', error);
            toast.error('Şablon kaydedilemedi');
        }
    };

    const triggerLabels = {
        'order_received': 'Sipariş Alındı',
        'order_preparing': 'Hazırlanıyor',
        'order_on_way': 'Kuryede',
        'order_delivered': 'Teslim Edildi',
        'order_cancelled': 'İptal Edildi',
        'campaign': 'Kampanya',
        'custom': 'Özel',
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
                        <MessageSquare className="w-7 h-7 text-green-600" />
                        SMS Entegrasyonu
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Netgsm SMS servisi ayarları ve şablon yönetimi</p>
                </div>

                {/* Balance Badge */}
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-4 py-2">
                        <div className="text-xs text-green-600 font-medium">SMS Bakiye</div>
                        <div className="text-2xl font-bold text-green-700">
                            {balance !== null ? balance : '—'}
                        </div>
                    </div>
                    <button
                        onClick={checkBalance}
                        disabled={checkingBalance}
                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${checkingBalance ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
                {[
                    { id: 'settings', label: 'Ayarlar', icon: Settings },
                    { id: 'templates', label: 'Şablonlar', icon: Edit2 },
                    { id: 'logs', label: 'Gönderim Geçmişi', icon: Clock },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            if (tab.id === 'logs') fetchLogs();
                        }}
                        className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-green-500 text-green-600'
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
                    {/* API Credentials */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-800 mb-4">Netgsm API Bilgileri</h3>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Kullanıcı Adı
                                </label>
                                <input
                                    type="text"
                                    value={settings.api_username}
                                    onChange={(e) => setSettings({ ...settings, api_username: e.target.value })}
                                    placeholder="Netgsm kullanıcı adı"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
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
                                        placeholder="Netgsm şifresi"
                                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Gönderici Başlığı
                                </label>
                                <input
                                    type="text"
                                    value={settings.sender_title}
                                    onChange={(e) => setSettings({ ...settings, sender_title: e.target.value.slice(0, 11) })}
                                    placeholder="RESTORAN"
                                    maxLength={11}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <span className="text-xs text-gray-400">Max 11 karakter</span>
                            </div>
                        </div>
                    </div>

                    {/* Auto SMS Settings */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-800 mb-4">Otomatik SMS Ayarları</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Sipariş durumu değiştiğinde müşteriye otomatik SMS gönder
                        </p>

                        <div className="space-y-3">
                            {[
                                { key: 'auto_order_received', label: 'Sipariş Alındı', emoji: '📦' },
                                { key: 'auto_order_preparing', label: 'Hazırlanıyor', emoji: '🍳' },
                                { key: 'auto_order_on_way', label: 'Kuryede', emoji: '🛵' },
                                { key: 'auto_order_delivered', label: 'Teslim Edildi', emoji: '✅' },
                                { key: 'auto_order_cancelled', label: 'İptal Edildi', emoji: '❌' },
                            ].map(item => (
                                <label key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                    <span className="flex items-center gap-3">
                                        <span className="text-xl">{item.emoji}</span>
                                        <span className="font-medium text-gray-700">{item.label}</span>
                                    </span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={settings[item.key]}
                                            onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                                            className="sr-only"
                                        />
                                        <div className={`w-11 h-6 rounded-full transition-colors ${settings[item.key] ? 'bg-green-500' : 'bg-gray-300'}`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ${settings[item.key] ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`}></div>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Test SMS */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-800 mb-4">Test SMS Gönder</h3>

                        <div className="flex gap-4">
                            <input
                                type="tel"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                placeholder="05XX XXX XX XX"
                                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            />
                            <button
                                onClick={sendTestSMS}
                                disabled={sendingTest}
                                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                                {sendingTest ? 'Gönderiliyor...' : 'Gönder'}
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                    </button>
                </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-4">
                    {templates.map(template => (
                        <div key={template.id} className="bg-white rounded-xl shadow-sm border p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${template.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {triggerLabels[template.trigger_type] || template.trigger_type}
                                        </span>
                                        {template.is_default && (
                                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                                                Varsayılan
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-gray-800">{template.name}</h4>
                                </div>
                                <button
                                    onClick={() => setEditingTemplate(template)}
                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-gray-600 text-sm mt-2 bg-gray-50 p-3 rounded-lg">
                                {template.template_text}
                            </p>
                            <div className="mt-2 text-xs text-gray-400">
                                Değişkenler: {'{name}'}, {'{order_no}'}, {'{total}'}, {'{eta}'}
                            </div>
                        </div>
                    ))}

                    {/* Edit Template Modal */}
                    {editingTemplate && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                                <div className="p-4 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-lg">Şablon Düzenle</h3>
                                    <button onClick={() => setEditingTemplate(null)}>
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Şablon Adı</label>
                                        <input
                                            type="text"
                                            value={editingTemplate.name}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mesaj Metni</label>
                                        <textarea
                                            value={editingTemplate.template_text}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, template_text: e.target.value })}
                                            rows={4}
                                            className="w-full px-4 py-2 border rounded-lg resize-none"
                                        />
                                        <div className="text-xs text-gray-400 mt-1">
                                            {editingTemplate.template_text.length}/160 karakter
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={editingTemplate.is_active}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })}
                                            className="w-4 h-4 text-green-600"
                                        />
                                        <span className="text-sm text-gray-700">Aktif</span>
                                    </label>
                                </div>
                                <div className="p-4 border-t flex gap-3">
                                    <button
                                        onClick={() => setEditingTemplate(null)}
                                        className="flex-1 py-2 border rounded-lg font-medium hover:bg-gray-50"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => saveTemplate(editingTemplate)}
                                        className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
                                    >
                                        Kaydet
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {logsLoading ? (
                        <div className="p-8 text-center text-gray-400">Yükleniyor...</div>
                    ) : logs.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p>Henüz SMS gönderimi yok</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-3 font-medium text-gray-600">Tarih</th>
                                        <th className="text-left p-3 font-medium text-gray-600">Telefon</th>
                                        <th className="text-left p-3 font-medium text-gray-600">Mesaj</th>
                                        <th className="text-left p-3 font-medium text-gray-600">Durum</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="p-3 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString('tr-TR')}
                                            </td>
                                            <td className="p-3 font-mono">{log.phone}</td>
                                            <td className="p-3 max-w-xs truncate" title={log.message}>
                                                {log.message}
                                            </td>
                                            <td className="p-3">
                                                {log.status === 'sent' ? (
                                                    <span className="inline-flex items-center gap-1 text-green-600">
                                                        <CheckCircle className="w-4 h-4" />
                                                        Gönderildi
                                                    </span>
                                                ) : log.status === 'failed' ? (
                                                    <span className="inline-flex items-center gap-1 text-red-600" title={log.error_message}>
                                                        <AlertTriangle className="w-4 h-4" />
                                                        Başarısız
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">Bekliyor</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SMSSettings;
