import React, { useState, useEffect } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, Clock, MapPin, Users,
    Utensils, Truck, Brain, Loader2, RefreshCw, Calendar,
    ArrowUpRight, ArrowDownRight, Sparkles, Target, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const AIReportsPanel = () => {
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState(null);
    const [insights, setInsights] = useState(null);
    const [dateRange, setDateRange] = useState('week');

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        if (tenantId) generateInsights();
    }, [tenantId, dateRange]);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setTenantId(user.id);
        setLoading(false);
    };

    const generateInsights = async () => {
        setLoading(true);
        try {
            // Get date range
            const now = new Date();
            let startDate;
            switch (dateRange) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                default:
                    startDate = new Date(now.setDate(now.getDate() - 7));
            }

            // Fetch orders data
            const { data: orders } = await supabase
                .from('pos_orders')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate.toISOString());

            // Fetch delivery data
            const { data: deliveries } = await supabase
                .from('courier_deliveries')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('created_at', startDate.toISOString());

            // Generate AI insights
            const analysis = analyzeData(orders || [], deliveries || []);
            setInsights(analysis);
        } catch (error) {
            console.error('Error generating insights:', error);
        } finally {
            setLoading(false);
        }
    };

    const analyzeData = (orders, deliveries) => {
        // Peak hours analysis
        const hourCounts = {};
        orders.forEach(order => {
            const hour = new Date(order.created_at).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const peakHours = Object.entries(hourCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([hour]) => `${hour}:00 - ${parseInt(hour) + 1}:00`);

        // Category analysis
        const categoryRevenue = {};
        orders.forEach(order => {
            const items = order.items || [];
            items.forEach(item => {
                const cat = item.category || 'Diğer';
                categoryRevenue[cat] = (categoryRevenue[cat] || 0) + (item.price * item.quantity);
            });
        });

        const topCategories = Object.entries(categoryRevenue)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        // Delivery performance
        const avgDeliveryTime = deliveries.length > 0
            ? deliveries.reduce((sum, d) => {
                if (d.delivered_at && d.picked_up_at) {
                    return sum + (new Date(d.delivered_at) - new Date(d.picked_up_at)) / 60000;
                }
                return sum;
            }, 0) / deliveries.filter(d => d.delivered_at).length
            : 0;

        // Revenue trends
        const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

        // Day of week analysis
        const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        orders.forEach(order => {
            const day = new Date(order.created_at).getDay();
            dayCounts[day]++;
        });
        const busiestDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];

        // Predictions based on trends
        const predictions = [];

        if (peakHours.length > 0) {
            predictions.push({
                type: 'tip',
                icon: Clock,
                title: 'Yoğun Saatler',
                description: `En yoğun saatleriniz: ${peakHours.join(', ')}. Bu saatlerde ekstra personel planlaması yapın.`
            });
        }

        if (avgDeliveryTime > 30) {
            predictions.push({
                type: 'warning',
                icon: Truck,
                title: 'Teslimat Süresi',
                description: `Ortalama teslimat süresi ${avgDeliveryTime.toFixed(0)} dakika. Kurye sayısını artırmayı düşünün.`
            });
        }

        predictions.push({
            type: 'info',
            icon: Target,
            title: 'En Yoğun Gün',
            description: `${busiestDay} günleri en yoğun gününüz. Stok ve personel planlamasını buna göre yapın.`
        });

        if (topCategories.length > 0) {
            predictions.push({
                type: 'success',
                icon: Utensils,
                title: 'En Çok Satan Kategori',
                description: `"${topCategories[0][0]}" kategorisi en çok gelir getiriyor. Bu kategoriye odaklanın.`
            });
        }

        return {
            summary: {
                totalOrders: orders.length,
                totalRevenue,
                avgOrderValue,
                totalDeliveries: deliveries.length,
                avgDeliveryTime: avgDeliveryTime || 0
            },
            peakHours,
            topCategories,
            busiestDay,
            predictions,
            dayCounts,
            dayNames
        };
    };

    if (loading && !insights) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl text-white">
                        <Brain className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">AI Destekli Raporlar</h1>
                        <p className="text-slate-500">Akıllı analiz ve öngörüler</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-4 py-2 border rounded-lg"
                    >
                        <option value="today">Bugün</option>
                        <option value="week">Bu Hafta</option>
                        <option value="month">Bu Ay</option>
                    </select>
                    <button
                        onClick={generateInsights}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {insights && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-5 gap-4">
                        <div className="bg-white rounded-xl border p-4">
                            <p className="text-sm text-slate-500">Toplam Sipariş</p>
                            <p className="text-2xl font-bold text-slate-800">{insights.summary.totalOrders}</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <p className="text-sm text-slate-500">Toplam Ciro</p>
                            <p className="text-2xl font-bold text-green-600">{insights.summary.totalRevenue.toLocaleString('tr-TR')} ₺</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <p className="text-sm text-slate-500">Ort. Sipariş</p>
                            <p className="text-2xl font-bold text-blue-600">{insights.summary.avgOrderValue.toFixed(0)} ₺</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <p className="text-sm text-slate-500">Teslimatlar</p>
                            <p className="text-2xl font-bold text-purple-600">{insights.summary.totalDeliveries}</p>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <p className="text-sm text-slate-500">Ort. Teslimat</p>
                            <p className="text-2xl font-bold text-amber-600">{insights.summary.avgDeliveryTime.toFixed(0)} dk</p>
                        </div>
                    </div>

                    {/* AI Predictions */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-yellow-400" />
                            <h2 className="text-lg font-semibold">AI Öngörüleri</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            {insights.predictions.map((pred, idx) => (
                                <div key={idx} className={`p-4 rounded-xl ${pred.type === 'warning' ? 'bg-amber-500/20 border border-amber-500/30' :
                                        pred.type === 'success' ? 'bg-green-500/20 border border-green-500/30' :
                                            pred.type === 'tip' ? 'bg-blue-500/20 border border-blue-500/30' :
                                                'bg-white/10 border border-white/20'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <pred.icon className="w-4 h-4" />
                                        <h3 className="font-medium">{pred.title}</h3>
                                    </div>
                                    <p className="text-sm text-slate-300">{pred.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Peak Hours */}
                        <div className="bg-white rounded-xl border p-6">
                            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-500" />
                                Yoğun Saatler
                            </h3>
                            <div className="space-y-2">
                                {insights.peakHours.map((hour, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <span className="font-medium">{idx + 1}. {hour}</span>
                                        <span className="text-sm text-slate-500">
                                            {idx === 0 ? '🔥 En yoğun' : idx === 1 ? '📈 Yoğun' : '📊 Orta'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Categories */}
                        <div className="bg-white rounded-xl border p-6">
                            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Utensils className="w-5 h-5 text-green-500" />
                                En Çok Satan Kategoriler
                            </h3>
                            <div className="space-y-2">
                                {insights.topCategories.map(([category, revenue], idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <span className="font-medium">{category}</span>
                                        <span className="text-sm font-bold text-green-600">
                                            {revenue.toLocaleString('tr-TR')} ₺
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Day Distribution */}
                    <div className="bg-white rounded-xl border p-6">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-purple-500" />
                            Günlere Göre Dağılım
                        </h3>
                        <div className="flex items-end justify-around h-32 gap-2">
                            {insights.dayNames.map((day, idx) => {
                                const height = insights.dayCounts[idx] > 0
                                    ? (insights.dayCounts[idx] / Math.max(...insights.dayCounts)) * 100
                                    : 5;
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                                        <span className="text-xs text-slate-500">{insights.dayCounts[idx]}</span>
                                        <div
                                            className={`w-full rounded-t-lg transition-all ${insights.dayCounts[idx] === Math.max(...insights.dayCounts)
                                                    ? 'bg-gradient-to-t from-purple-500 to-blue-500'
                                                    : 'bg-slate-200'
                                                }`}
                                            style={{ height: `${height}%` }}
                                        />
                                        <span className="text-xs font-medium text-slate-600">{day.slice(0, 2)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AIReportsPanel;
