import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    BarChart3, Users, ShoppingBag, TrendingUp, Globe, Shield,
    AlertTriangle, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AnalyticsDashboard = ({ tenantId }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('7'); // days

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();

        try {
            // 1. Customer Stats
            const { data: customers } = await supabase
                .from('customers')
                .select('trust_score, complaint_count, is_blacklisted, created_at')
                .eq('tenant_id', tenantId);

            // 2. Order Stats
            const { data: orders } = await supabase
                .from('pos_orders')
                .select('total, status, created_at, order_source')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate);

            // 3. WhatsApp Sessions (Language Distribution)
            const { data: sessions } = await supabase
                .from('whatsapp_sessions')
                .select('language')
                .eq('tenant_id', tenantId);

            // 4. Support Tickets
            const { data: tickets } = await supabase
                .from('support_tickets')
                .select('status, issue_type, created_at')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate);

            // 5. Sentiment Logs
            const { data: sentiments } = await supabase
                .from('sentiment_logs')
                .select('anger_level')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate);

            // Calculate stats
            const totalCustomers = customers?.length || 0;
            const avgTrustScore = customers?.length
                ? Math.round(customers.reduce((sum, c) => sum + (c.trust_score || 50), 0) / customers.length)
                : 50;
            const blacklistedCount = customers?.filter(c => c.is_blacklisted).length || 0;
            const riskyCustomers = customers?.filter(c => (c.trust_score || 50) < 30).length || 0;

            const totalOrders = orders?.length || 0;
            const totalRevenue = orders?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0;
            const whatsappOrders = orders?.filter(o => o.order_source === 'whatsapp').length || 0;
            const completedOrders = orders?.filter(o => o.status === 'completed').length || 0;
            const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0;

            // Language distribution
            const langCounts = {};
            sessions?.forEach(s => {
                const lang = s.language || 'tr';
                langCounts[lang] = (langCounts[lang] || 0) + 1;
            });

            // Issue type distribution
            const issueCounts = {};
            tickets?.forEach(t => {
                const type = t.issue_type || 'other';
                issueCounts[type] = (issueCounts[type] || 0) + 1;
            });

            const avgAnger = sentiments?.length
                ? Math.round(sentiments.reduce((sum, s) => sum + s.anger_level, 0) / sentiments.length * 10) / 10
                : 0;

            setStats({
                customers: {
                    total: totalCustomers,
                    avgTrust: avgTrustScore,
                    blacklisted: blacklistedCount,
                    risky: riskyCustomers
                },
                orders: {
                    total: totalOrders,
                    revenue: totalRevenue,
                    whatsapp: whatsappOrders,
                    completed: completedOrders,
                    cancelled: cancelledOrders,
                    whatsappRate: totalOrders ? Math.round(whatsappOrders / totalOrders * 100) : 0
                },
                languages: langCounts,
                issues: issueCounts,
                tickets: {
                    total: tickets?.length || 0,
                    open: tickets?.filter(t => t.status === 'open').length || 0
                },
                avgAnger
            });
        } catch (error) {
            console.error('Analytics error:', error);
            toast.error('İstatistikler yüklenemedi');
        }

        setLoading(false);
    }, [tenantId, period]);


    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (tenantId) fetchAnalytics();
    }, [tenantId, fetchAnalytics]);




    const langLabels = {
        tr: '🇹🇷 Türkçe',
        en: '🇬🇧 English',
        ar: '🇸🇦 العربية',
        de: '🇩🇪 Deutsch',
        ru: '🇷🇺 Русский'
    };

    const issueLabels = {
        cold_food: '❄️ Soğuk Yemek',
        late_delivery: '⏰ Geç Teslimat',
        wrong_item: '❌ Yanlış Ürün',
        taste_issue: '👅 Tat Problemi',
        other: '📋 Diğer'
    };

    if (loading) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <div className="text-gray-400">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-blue-500" />
                        Analytics Dashboard
                    </h1>
                    <p className="text-gray-500">WhatsApp bot ve müşteri istatistikleri</p>
                </div>
                <div className="flex gap-2">
                    {['7', '30', '90'].map(d => (
                        <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className={`px - 4 py - 2 rounded - lg text - sm font - medium transition - colors ${period === d
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-gray-600 border hover:bg-gray-50'
                                } `}
                        >
                            {d} Gün
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {/* Total Orders */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Toplam Sipariş</p>
                            <p className="text-3xl font-bold text-gray-800">{stats?.orders.total}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                        <span className="bg-green-100 px-2 py-0.5 rounded">{stats?.orders.whatsappRate}% WhatsApp</span>
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Toplam Ciro</p>
                            <p className="text-3xl font-bold text-gray-800">{stats?.orders.revenue.toLocaleString('tr-TR')} ₺</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-green-500" />
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                        Ortalama: {stats?.orders.total ? Math.round(stats.orders.revenue / stats.orders.total) : 0} ₺
                    </div>
                </div>

                {/* Customers */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Toplam Müşteri</p>
                            <p className="text-3xl font-bold text-gray-800">{stats?.customers.total}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                    <div className="mt-2 text-xs flex gap-2">
                        <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded">{stats?.customers.risky} Riskli</span>
                        <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{stats?.customers.blacklisted} Engelli</span>
                    </div>
                </div>

                {/* Trust Score */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Ort. Güven Skoru</p>
                            <p className="text-3xl font-bold text-gray-800">{stats?.customers.avgTrust}/100</p>
                        </div>
                        <div className={`w - 12 h - 12 rounded - xl flex items - center justify - center ${stats?.customers.avgTrust >= 70 ? 'bg-green-100' :
                            stats?.customers.avgTrust >= 40 ? 'bg-yellow-100' : 'bg-red-100'
                            } `}>
                            <Shield className={`w - 6 h - 6 ${stats?.customers.avgTrust >= 70 ? 'text-green-500' :
                                stats?.customers.avgTrust >= 40 ? 'text-yellow-500' : 'text-red-500'
                                } `} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h - 2 rounded - full ${stats?.customers.avgTrust >= 70 ? 'bg-green-500' :
                                    stats?.customers.avgTrust >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    } `}
                                style={{ width: `${stats?.customers.avgTrust}% ` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                {/* Language Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-500" />
                        Dil Dağılımı
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(stats?.languages || {}).sort((a, b) => b[1] - a[1]).map(([lang, count]) => {
                            const total = Object.values(stats?.languages || {}).reduce((a, b) => a + b, 0);
                            const pct = total ? Math.round(count / total * 100) : 0;
                            return (
                                <div key={lang} className="flex items-center gap-3">
                                    <span className="text-lg w-24">{langLabels[lang] || lang}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                                        <div
                                            className="bg-blue-500 h-4 rounded-full transition-all"
                                            style={{ width: `${pct}% ` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{pct}%</span>
                                </div>
                            );
                        })}
                        {Object.keys(stats?.languages || {}).length === 0 && (
                            <p className="text-gray-400 text-sm">Henüz veri yok</p>
                        )}
                    </div>
                </div>

                {/* Issue Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Şikayet Dağılımı
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(stats?.issues || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between">
                                <span className="text-sm">{issueLabels[type] || type}</span>
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
                                    {count}
                                </span>
                            </div>
                        ))}
                        {Object.keys(stats?.issues || {}).length === 0 && (
                            <p className="text-gray-400 text-sm">🎉 Şikayet yok!</p>
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        Hızlı İstatistikler
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <span className="text-sm text-gray-600">Tamamlanan Sipariş</span>
                            <span className="font-bold text-green-600">{stats?.orders.completed}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <span className="text-sm text-gray-600">İptal Edilen</span>
                            <span className="font-bold text-red-600">{stats?.orders.cancelled}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                            <span className="text-sm text-gray-600">Açık Şikayet</span>
                            <span className="font-bold text-orange-600">{stats?.tickets.open}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                            <span className="text-sm text-gray-600">Ort. Sinir Seviyesi</span>
                            <span className="font-bold text-purple-600">{stats?.avgAnger}/10</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
