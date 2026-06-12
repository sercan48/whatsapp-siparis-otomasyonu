import React, { useState, useEffect } from 'react';
import {
    Settings, Save, Loader2, DollarSign, Package,
    Truck, Clock, Award, Sun, Moon, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const CourierPaymentConfig = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tenantId, setTenantId] = useState(null);

    const [config, setConfig] = useState({
        config_name: 'Varsayılan Kurye Ücreti',
        is_default: true,
        payment_model: 'per_package',

        // Per Package
        base_rate_per_package: 15,

        // Per KM
        base_rate_per_km: 3,
        min_km_charge: 10,

        // Hybrid
        hybrid_base_fee: 10,
        hybrid_km_rate: 2,

        // Hourly
        hourly_rate: 50,

        // Bonuses
        peak_hour_bonus: 5,
        night_bonus: 10,
        weekend_bonus_percent: 10,
        bad_weather_bonus: 8,

        // Performance
        daily_target: 20,
        daily_target_bonus: 50,
        rating_bonus_threshold: 4.8,
        rating_bonus: 20
    });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setTenantId(user.id);

            const { data, error } = await supabase
                .from('courier_payment_config')
                .select('*')
                .eq('tenant_id', user.id)
                .eq('is_default', true)
                .single();

            if (data) {
                setConfig(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Error loading config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: existing } = await supabase
                .from('courier_payment_config')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('is_default', true)
                .single();

            if (existing) {
                await supabase
                    .from('courier_payment_config')
                    .update({ ...config, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('courier_payment_config')
                    .insert({ ...config, tenant_id: tenantId });
            }

            toast.success('Kurye ödeme ayarları kaydedildi');
        } catch (error) {
            console.error('Error saving config:', error);
            toast.error('Ayarlar kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const paymentModels = [
        { id: 'per_package', label: 'Paket Başı', icon: Package, desc: 'Her teslimat için sabit ücret' },
        { id: 'per_km', label: 'KM Başı', icon: Truck, desc: 'Mesafeye göre ücretlendirme' },
        { id: 'hybrid', label: 'Hibrit', icon: DollarSign, desc: 'Sabit + KM başı ücret' },
        { id: 'hourly', label: 'Saatlik', icon: Clock, desc: 'Çalışma saatine göre ücret' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="w-8 h-8 text-blue-500" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Kurye Ödeme Ayarları</h1>
                    <p className="text-slate-500">Teslimat ücretlendirme modelini yapılandırın</p>
                </div>
            </div>

            {/* Payment Model Selection */}
            <div className="bg-white rounded-xl border p-6 mb-6">
                <h2 className="font-semibold text-slate-800 mb-4">Ödeme Modeli</h2>
                <div className="grid md:grid-cols-4 gap-3">
                    {paymentModels.map(model => (
                        <button
                            key={model.id}
                            onClick={() => updateConfig('payment_model', model.id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${config.payment_model === model.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <model.icon className={`w-6 h-6 mb-2 ${config.payment_model === model.id ? 'text-blue-600' : 'text-slate-400'
                                }`} />
                            <p className="font-medium text-slate-800">{model.label}</p>
                            <p className="text-xs text-slate-500">{model.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Model-Specific Settings */}
            <div className="bg-white rounded-xl border p-6 mb-6">
                <h2 className="font-semibold text-slate-800 mb-4">Ücret Ayarları</h2>

                {config.payment_model === 'per_package' && (
                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                            Teslimat Başı Ücret (₺)
                        </label>
                        <input
                            type="number"
                            value={config.base_rate_per_package}
                            onChange={(e) => updateConfig('base_rate_per_package', parseFloat(e.target.value))}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                        <p className="text-xs text-slate-500 mt-1">Her teslimat için kurye bu ücreti alır</p>
                    </div>
                )}

                {config.payment_model === 'per_km' && (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                KM Başı Ücret (₺)
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                value={config.base_rate_per_km}
                                onChange={(e) => updateConfig('base_rate_per_km', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                Minimum Ücret (₺)
                            </label>
                            <input
                                type="number"
                                value={config.min_km_charge}
                                onChange={(e) => updateConfig('min_km_charge', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">Mesafe ne olursa olsun minimum bu kadar ödenir</p>
                        </div>
                    </div>
                )}

                {config.payment_model === 'hybrid' && (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                Sabit Başlangıç Ücreti (₺)
                            </label>
                            <input
                                type="number"
                                value={config.hybrid_base_fee}
                                onChange={(e) => updateConfig('hybrid_base_fee', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">
                                Ek KM Başı Ücret (₺)
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                value={config.hybrid_km_rate}
                                onChange={(e) => updateConfig('hybrid_km_rate', parseFloat(e.target.value))}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}

                {config.payment_model === 'hourly' && (
                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                            Saatlik Ücret (₺)
                        </label>
                        <input
                            type="number"
                            value={config.hourly_rate}
                            onChange={(e) => updateConfig('hourly_rate', parseFloat(e.target.value))}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                    </div>
                )}
            </div>

            {/* Bonus Settings */}
            <div className="bg-white rounded-xl border p-6 mb-6">
                <h2 className="font-semibold text-slate-800 mb-4">Bonus Ayarları</h2>

                <div className="grid md:grid-cols-3 gap-4">
                    {/* Peak Hour */}
                    <div className="p-4 bg-amber-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Sun className="w-5 h-5 text-amber-600" />
                            <span className="font-medium text-slate-800">Öğle Saati Bonusu</span>
                        </div>
                        <input
                            type="number"
                            value={config.peak_hour_bonus}
                            onChange={(e) => updateConfig('peak_hour_bonus', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg mb-1"
                        />
                        <p className="text-xs text-slate-500">12:00 - 14:00 arası ekstra ₺</p>
                    </div>

                    {/* Night */}
                    <div className="p-4 bg-indigo-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Moon className="w-5 h-5 text-indigo-600" />
                            <span className="font-medium text-slate-800">Gece Mesai Bonusu</span>
                        </div>
                        <input
                            type="number"
                            value={config.night_bonus}
                            onChange={(e) => updateConfig('night_bonus', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg mb-1"
                        />
                        <p className="text-xs text-slate-500">22:00 - 06:00 arası ekstra ₺</p>
                    </div>

                    {/* Weekend */}
                    <div className="p-4 bg-green-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-slate-800">Hafta Sonu Bonusu</span>
                        </div>
                        <input
                            type="number"
                            value={config.weekend_bonus_percent}
                            onChange={(e) => updateConfig('weekend_bonus_percent', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg mb-1"
                        />
                        <p className="text-xs text-slate-500">Cumartesi-Pazar ekstra %</p>
                    </div>
                </div>
            </div>

            {/* Performance Bonuses */}
            <div className="bg-white rounded-xl border p-6 mb-6">
                <h2 className="font-semibold text-slate-800 mb-4">Performans Bonusları</h2>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Package className="w-5 h-5 text-slate-600" />
                            <span className="font-medium text-slate-800">Günlük Hedef</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-500">Hedef (teslimat)</label>
                                <input
                                    type="number"
                                    value={config.daily_target}
                                    onChange={(e) => updateConfig('daily_target', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Bonus (₺)</label>
                                <input
                                    type="number"
                                    value={config.daily_target_bonus}
                                    onChange={(e) => updateConfig('daily_target_bonus', parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Award className="w-5 h-5 text-slate-600" />
                            <span className="font-medium text-slate-800">Yüksek Puan Bonusu</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-500">Min Puan</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    max="5"
                                    value={config.rating_bonus_threshold}
                                    onChange={(e) => updateConfig('rating_bonus_threshold', parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Aylık Bonus (₺)</label>
                                <input
                                    type="number"
                                    value={config.rating_bonus}
                                    onChange={(e) => updateConfig('rating_bonus', parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>
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
    );
};

export default CourierPaymentConfig;
