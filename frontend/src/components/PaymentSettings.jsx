import React, { useState, useEffect } from 'react';
import {
    CreditCard, Save, Loader2, Eye, EyeOff, CheckCircle,
    AlertCircle, Settings, BarChart3, RefreshCw
} from 'lucide-react';
import { getPaymentSettings, savePaymentSettings, getPaymentStats, getTransactions } from '../lib/paymentService';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const PaymentSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSecrets, setShowSecrets] = useState({});
    const [activeTab, setActiveTab] = useState('settings'); // settings, transactions, stats
    const [tenantId, setTenantId] = useState(null);

    const [settings, setSettings] = useState({
        // Iyzico
        iyzico_enabled: false,
        iyzico_api_key: '',
        iyzico_secret_key: '',
        iyzico_sandbox: true,
        // PayTR
        paytr_enabled: false,
        paytr_merchant_id: '',
        paytr_merchant_key: '',
        paytr_merchant_salt: '',
        paytr_sandbox: true,
        // Masterpass
        masterpass_enabled: false,
        masterpass_merchant_id: '',
        masterpass_token: '',
        masterpass_sandbox: true,
        // BKM Express
        bkm_express_enabled: false,
        bkm_express_merchant_id: '',
        bkm_express_private_key: '',
        bkm_express_sandbox: true,
        // General
        default_provider: 'iyzico',
        allow_installments: true,
        max_installments: 12,
        // Card Storage
        card_storage_enabled: true
    });

    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setTenantId(user.id);
            const data = await getPaymentSettings(user.id);
            if (data) {
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async () => {
        if (!tenantId) return;
        try {
            const data = await getTransactions(tenantId, { limit: 50 });
            setTransactions(data || []);
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    };

    const loadStats = async () => {
        if (!tenantId) return;
        try {
            const data = await getPaymentStats(tenantId, 'month');
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    useEffect(() => {
        if (activeTab === 'transactions') loadTransactions();
        if (activeTab === 'stats') loadStats();
    }, [activeTab, tenantId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await savePaymentSettings(tenantId, settings);
            toast.success('Ödeme ayarları kaydedildi');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Ayarlar kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    const toggleSecret = (key) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const ProviderCard = ({ id, name, icon, fields, enabled, sandbox }) => (
        <div className={`border-2 rounded-xl p-5 transition-all ${settings[enabled] ? 'border-green-300 bg-green-50/50' : 'border-slate-200'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                        <h3 className="font-semibold text-slate-800">{name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${settings[sandbox] ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            }`}>
                            {settings[sandbox] ? 'Sandbox' : 'Production'}
                        </span>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings[enabled]}
                        onChange={(e) => setSettings({ ...settings, [enabled]: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-green-500 
                                    peer-checked:after:translate-x-full after:content-[''] after:absolute 
                                    after:top-0.5 after:left-[2px] after:bg-white after:rounded-full 
                                    after:h-5 after:w-5 after:transition-all" />
                </label>
            </div>

            {settings[enabled] && (
                <div className="space-y-3 pt-3 border-t">
                    {fields.map(field => (
                        <div key={field.key}>
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                {field.label}
                            </label>
                            <div className="relative">
                                <input
                                    type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                                    value={settings[field.key] || ''}
                                    onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                                    placeholder={field.placeholder}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                               focus:border-blue-500 pr-10"
                                />
                                {field.secret && (
                                    <button
                                        type="button"
                                        onClick={() => toggleSecret(field.key)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <label className="flex items-center gap-2 mt-3">
                        <input
                            type="checkbox"
                            checked={settings[sandbox]}
                            onChange={(e) => setSettings({ ...settings, [sandbox]: e.target.checked })}
                            className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">Sandbox/Test modu</span>
                    </label>
                </div>
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Ödeme Ayarları</h1>
                        <p className="text-slate-500">Online ödeme entegrasyonlarını yönetin</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
                {[
                    { id: 'settings', label: 'Ayarlar', icon: Settings },
                    { id: 'transactions', label: 'İşlemler', icon: CreditCard },
                    { id: 'stats', label: 'İstatistikler', icon: BarChart3 }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 -mb-px ${activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
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
                    {/* Provider Cards */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <ProviderCard
                            id="iyzico"
                            name="Iyzico"
                            icon="💳"
                            enabled="iyzico_enabled"
                            sandbox="iyzico_sandbox"
                            fields={[
                                { key: 'iyzico_api_key', label: 'API Key', placeholder: 'sandbox-xxx', secret: true },
                                { key: 'iyzico_secret_key', label: 'Secret Key', placeholder: 'sandbox-xxx', secret: true }
                            ]}
                        />
                        <ProviderCard
                            id="paytr"
                            name="PayTR"
                            icon="🏦"
                            enabled="paytr_enabled"
                            sandbox="paytr_sandbox"
                            fields={[
                                { key: 'paytr_merchant_id', label: 'Merchant ID', placeholder: 'XXXXXX' },
                                { key: 'paytr_merchant_key', label: 'Merchant Key', secret: true },
                                { key: 'paytr_merchant_salt', label: 'Merchant Salt', secret: true }
                            ]}
                        />
                        <ProviderCard
                            id="masterpass"
                            name="Masterpass"
                            icon="🔵"
                            enabled="masterpass_enabled"
                            sandbox="masterpass_sandbox"
                            fields={[
                                { key: 'masterpass_merchant_id', label: 'Merchant ID', placeholder: 'XXXXXX' },
                                { key: 'masterpass_token', label: 'Token', secret: true }
                            ]}
                        />
                        <ProviderCard
                            id="bkm_express"
                            name="BKM Express"
                            icon="🟣"
                            enabled="bkm_express_enabled"
                            sandbox="bkm_express_sandbox"
                            fields={[
                                { key: 'bkm_express_merchant_id', label: 'Merchant ID', placeholder: 'XXXXXX' },
                                { key: 'bkm_express_private_key', label: 'Private Key', secret: true }
                            ]}
                        />
                    </div>

                    {/* General Settings */}
                    <div className="bg-slate-50 rounded-xl p-5">
                        <h3 className="font-semibold text-slate-800 mb-4">Genel Ayarlar</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Varsayılan Sağlayıcı
                                </label>
                                <select
                                    value={settings.default_provider}
                                    onChange={(e) => setSettings({ ...settings, default_provider: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="iyzico">Iyzico</option>
                                    <option value="paytr">PayTR</option>
                                    <option value="masterpass">Masterpass</option>
                                    <option value="bkm_express">BKM Express</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Maksimum Taksit
                                </label>
                                <select
                                    value={settings.max_installments}
                                    onChange={(e) => setSettings({ ...settings, max_installments: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    {[1, 2, 3, 6, 9, 12].map(n => (
                                        <option key={n} value={n}>{n === 1 ? 'Tek Çekim' : `${n} Taksit`}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.allow_installments}
                                        onChange={(e) => setSettings({ ...settings, allow_installments: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-600">Taksitli ödemeye izin ver</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg 
                                       font-medium hover:bg-blue-600 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="font-semibold text-slate-800">Son İşlemler</h3>
                        <button onClick={loadTransactions} className="text-slate-500 hover:text-slate-700">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-sm text-slate-600">
                                <tr>
                                    <th className="px-4 py-3 text-left">Tarih</th>
                                    <th className="px-4 py-3 text-left">Sağlayıcı</th>
                                    <th className="px-4 py-3 text-left">Tutar</th>
                                    <th className="px-4 py-3 text-left">Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                            Henüz işlem bulunmuyor
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm">
                                                {new Date(tx.created_at).toLocaleString('tr-TR')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="capitalize">{tx.provider}</span>
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {parseFloat(tx.amount).toFixed(2)} ₺
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tx.status === 'success' ? 'bg-green-100 text-green-700' :
                                                    tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                        tx.status === 'refunded' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {tx.status === 'success' && <CheckCircle className="w-3 h-3" />}
                                                    {tx.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                                                    {tx.status === 'success' ? 'Başarılı' :
                                                        tx.status === 'failed' ? 'Başarısız' :
                                                            tx.status === 'refunded' ? 'İade' : 'Bekliyor'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    {stats ? (
                        <>
                            <div className="grid md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl border p-5">
                                    <p className="text-sm text-slate-500 mb-1">Toplam İşlem</p>
                                    <p className="text-2xl font-bold text-slate-800">{stats.totalTransactions}</p>
                                </div>
                                <div className="bg-white rounded-xl border p-5">
                                    <p className="text-sm text-slate-500 mb-1">Başarılı</p>
                                    <p className="text-2xl font-bold text-green-600">{stats.successfulTransactions}</p>
                                </div>
                                <div className="bg-white rounded-xl border p-5">
                                    <p className="text-sm text-slate-500 mb-1">Başarısız</p>
                                    <p className="text-2xl font-bold text-red-600">{stats.failedTransactions}</p>
                                </div>
                                <div className="bg-white rounded-xl border p-5">
                                    <p className="text-sm text-slate-500 mb-1">Toplam Tutar</p>
                                    <p className="text-2xl font-bold text-blue-600">{stats.totalAmount.toFixed(2)} ₺</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border p-5">
                                <h3 className="font-semibold text-slate-800 mb-4">Sağlayıcı Bazında</h3>
                                <div className="space-y-3">
                                    {Object.entries(stats.byProvider).map(([provider, data]) => (
                                        <div key={provider} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <span className="capitalize font-medium">{provider}</span>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-800">{data.amount.toFixed(2)} ₺</p>
                                                <p className="text-xs text-slate-500">{data.count} işlem</p>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(stats.byProvider).length === 0 && (
                                        <p className="text-center text-slate-500 py-4">Veri bulunmuyor</p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PaymentSettings;
