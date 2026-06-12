import React, { useState, useEffect } from 'react';
import {
    Truck, Settings, Check, X, Loader2, RefreshCw,
    DollarSign, Clock, MapPin, Phone, ExternalLink,
    ToggleLeft, ToggleRight, ChevronRight, AlertCircle
} from 'lucide-react';
import {
    getProviders, toggleProvider, updateProviderConfig,
    getDeliveryQuotes, createExternalOrder, getExternalOrders
} from '../lib/externalCourierService';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const ExternalCourierPanel = () => {
    const [loading, setLoading] = useState(true);
    const [providers, setProviders] = useState([]);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('providers'); // providers, orders, settings
    const [tenantId, setTenantId] = useState(null);
    const [configModal, setConfigModal] = useState(null);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setTenantId(user.id);
            await loadData(user.id);
        }
        setLoading(false);
    };

    const loadData = async (tid) => {
        try {
            const [providerData, orderData] = await Promise.all([
                getProviders(tid),
                getExternalOrders(tid, { limit: 20 })
            ]);
            setProviders(providerData);
            setOrders(orderData);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const handleToggleProvider = async (providerCode, currentState) => {
        try {
            await toggleProvider(tenantId, providerCode, !currentState);
            toast.success(!currentState ? 'Sağlayıcı aktifleştirildi' : 'Sağlayıcı devre dışı bırakıldı');
            await loadData(tenantId);
        } catch (error) {
            toast.error('İşlem başarısız');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-gray-100 text-gray-700',
            requested: 'bg-blue-100 text-blue-700',
            accepted: 'bg-blue-100 text-blue-700',
            courier_assigned: 'bg-purple-100 text-purple-700',
            picked_up: 'bg-amber-100 text-amber-700',
            in_transit: 'bg-cyan-100 text-cyan-700',
            delivered: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700',
            failed: 'bg-red-100 text-red-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    const getStatusText = (status) => {
        const texts = {
            pending: 'Bekliyor',
            requested: 'Talep Gönderildi',
            accepted: 'Kabul Edildi',
            courier_assigned: 'Kurye Atandı',
            picked_up: 'Alındı',
            in_transit: 'Yolda',
            delivered: 'Teslim Edildi',
            cancelled: 'İptal',
            failed: 'Başarısız'
        };
        return texts[status] || status;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Truck className="w-8 h-8 text-orange-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Harici Kurye Entegrasyonları</h1>
                        <p className="text-slate-500">Paketaxi, Maxijet ve diğer kurye firmalarını yönetin</p>
                    </div>
                </div>
                <button
                    onClick={() => loadData(tenantId)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
                {[
                    { id: 'providers', label: 'Sağlayıcılar', icon: Truck },
                    { id: 'orders', label: 'Siparişler', icon: Clock },
                    { id: 'settings', label: 'Ayarlar', icon: Settings }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 -mb-px transition-all ${activeTab === tab.id
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Providers Tab */}
            {activeTab === 'providers' && (
                <div className="grid md:grid-cols-3 gap-4">
                    {providers.length === 0 ? (
                        <div className="col-span-3 text-center py-12 text-slate-500">
                            Henüz kurye sağlayıcısı yapılandırılmadı
                        </div>
                    ) : (
                        providers.map(provider => (
                            <div
                                key={provider.provider_code}
                                className={`bg-white rounded-xl border-2 p-5 transition-all ${provider.is_enabled ? 'border-green-300' : 'border-slate-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{provider.logo}</span>
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{provider.provider_name}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${provider.is_sandbox
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-green-100 text-green-700'
                                                }`}>
                                                {provider.is_sandbox ? 'Test Modu' : 'Canlı'}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleProvider(provider.provider_code, provider.is_enabled)}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        {provider.is_enabled ? (
                                            <ToggleRight className="w-8 h-8 text-green-500" />
                                        ) : (
                                            <ToggleLeft className="w-8 h-8" />
                                        )}
                                    </button>
                                </div>

                                <div className="space-y-2 text-sm mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Toplam Sipariş</span>
                                        <span className="font-medium">{provider.total_orders || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Ort. Teslimat</span>
                                        <span className="font-medium">{provider.average_delivery_time || provider.avgDeliveryTime || '~'} dk</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Baz Ücret</span>
                                        <span className="font-medium">{provider.base_fee || 0} ₺</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setConfigModal(provider)}
                                    className="w-full py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg 
                                               flex items-center justify-center gap-1"
                                >
                                    <Settings className="w-4 h-4" />
                                    Yapılandır
                                </button>
                            </div>
                        ))
                    )}

                    {/* Add Provider Card */}
                    <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 p-5 
                                    flex flex-col items-center justify-center text-center min-h-[200px]">
                        <Truck className="w-10 h-10 text-slate-400 mb-3" />
                        <p className="text-slate-600 font-medium mb-1">Yeni Sağlayıcı Ekle</p>
                        <p className="text-xs text-slate-500">Yakında: Yemeksepeti Banabi, Trendyol Go</p>
                    </div>
                </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="bg-white rounded-xl border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-sm text-slate-600">
                            <tr>
                                <th className="px-4 py-3 text-left">Sağlayıcı</th>
                                <th className="px-4 py-3 text-left">Sipariş</th>
                                <th className="px-4 py-3 text-left">Kurye</th>
                                <th className="px-4 py-3 text-left">Durum</th>
                                <th className="px-4 py-3 text-left">Ücret</th>
                                <th className="px-4 py-3 text-left">Tarih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                        Henüz harici kurye siparişi yok
                                    </td>
                                </tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <span className="font-medium capitalize">{order.provider_code}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium text-slate-800 truncate max-w-[150px]">
                                                {order.delivery_address}
                                            </p>
                                            <p className="text-xs text-slate-500">{order.delivery_phone}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {order.courier_name ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">
                                                        {order.courier_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{order.courier_name}</p>
                                                        <p className="text-xs text-slate-500">{order.courier_vehicle}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {getStatusText(order.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {order.actual_fee || order.estimated_fee || '-'} ₺
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500">
                                            {new Date(order.created_at).toLocaleString('tr-TR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="bg-white rounded-xl border p-6">
                    <h2 className="font-semibold text-slate-800 mb-4">Genel Ayarlar</h2>

                    <div className="space-y-6">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-amber-800">Webhook Yapılandırması</p>
                                    <p className="text-sm text-amber-700 mt-1">
                                        Harici kurye sağlayıcılarının gerçek zamanlı durum güncellemesi gönderebilmesi için
                                        aşağıdaki webhook URL'lerini sağlayıcı panellerinde tanımlamanız gerekir.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {providers.filter(p => p.is_enabled).map(provider => (
                                <div key={provider.provider_code} className="p-4 bg-slate-50 rounded-lg">
                                    <p className="font-medium text-slate-700 mb-2">{provider.provider_name} Webhook URL</p>
                                    <code className="block p-3 bg-slate-800 text-green-400 rounded text-sm overflow-x-auto">
                                        {window.location.origin}/api/webhooks/{provider.provider_code}
                                    </code>
                                </div>
                            ))}

                            {providers.filter(p => p.is_enabled).length === 0 && (
                                <p className="text-slate-500 text-center py-4">
                                    Webhook URL'leri görmek için en az bir sağlayıcıyı aktifleştirin
                                </p>
                            )}
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="font-medium text-slate-700 mb-3">Otomatik Atama Kuralları</h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="rounded border-slate-300 text-orange-500" defaultChecked />
                                    <span className="text-sm text-slate-600">Kendi kuryem müsait değilse harici kurye kullan</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="rounded border-slate-300 text-orange-500" />
                                    <span className="text-sm text-slate-600">Her zaman en ucuz sağlayıcıyı seç</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="rounded border-slate-300 text-orange-500" defaultChecked />
                                    <span className="text-sm text-slate-600">Müşteriye harici kurye bilgilerini gönder</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {configModal && (
                <ProviderConfigModal
                    provider={configModal}
                    tenantId={tenantId}
                    onClose={() => setConfigModal(null)}
                    onSave={async (config) => {
                        await updateProviderConfig(tenantId, configModal.provider_code, config);
                        toast.success('Ayarlar kaydedildi');
                        setConfigModal(null);
                        await loadData(tenantId);
                    }}
                />
            )}
        </div>
    );
};

// Provider Config Modal Component
const ProviderConfigModal = ({ provider, tenantId, onClose, onSave }) => {
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        api_key: provider.api_key || '',
        api_secret: provider.api_secret || '',
        merchant_id: provider.merchant_id || '',
        base_fee: provider.base_fee || 0,
        per_km_rate: provider.per_km_rate || 3,
        min_fee: provider.min_fee || 15,
        max_distance_km: provider.max_distance_km || 10,
        is_sandbox: provider.is_sandbox !== false
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(config);
        } catch (error) {
            toast.error('Kayıt başarısız');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{provider.logo}</span>
                        <h2 className="text-xl font-bold text-slate-800">{provider.provider_name} Ayarları</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* API Credentials */}
                    <div>
                        <h3 className="font-medium text-slate-700 mb-3">API Bilgileri</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={config.api_key}
                                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                                    placeholder="API anahtarınızı girin"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">API Secret</label>
                                <input
                                    type="password"
                                    value={config.api_secret}
                                    onChange={(e) => setConfig({ ...config, api_secret: e.target.value })}
                                    placeholder="API secret girin"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Merchant ID</label>
                                <input
                                    type="text"
                                    value={config.merchant_id}
                                    onChange={(e) => setConfig({ ...config, merchant_id: e.target.value })}
                                    placeholder="Mağaza ID"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div>
                        <h3 className="font-medium text-slate-700 mb-3">Fiyatlandırma</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Baz Ücret (₺)</label>
                                <input
                                    type="number"
                                    value={config.base_fee}
                                    onChange={(e) => setConfig({ ...config, base_fee: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">KM Başı (₺)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={config.per_km_rate}
                                    onChange={(e) => setConfig({ ...config, per_km_rate: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Min (₺)</label>
                                <input
                                    type="number"
                                    value={config.min_fee}
                                    onChange={(e) => setConfig({ ...config, min_fee: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Service Area */}
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Max Mesafe (km)</label>
                        <input
                            type="number"
                            value={config.max_distance_km}
                            onChange={(e) => setConfig({ ...config, max_distance_km: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>

                    {/* Sandbox Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-amber-50 rounded-lg">
                        <input
                            type="checkbox"
                            checked={config.is_sandbox}
                            onChange={(e) => setConfig({ ...config, is_sandbox: e.target.checked })}
                            className="rounded border-slate-300 text-amber-500"
                        />
                        <div>
                            <span className="text-sm font-medium text-slate-700">Test Modu</span>
                            <p className="text-xs text-slate-500">Gerçek sipariş göndermeden test edin</p>
                        </div>
                    </label>
                </div>

                <div className="p-6 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium 
                                   hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExternalCourierPanel;
