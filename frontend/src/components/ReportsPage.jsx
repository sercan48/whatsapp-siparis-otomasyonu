import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Calendar, TrendingUp, DollarSign, ShoppingBag, CreditCard, Filter, Sparkles, BarChart3, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { AIReportsPanel } from './AIReportsPanel';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const ReportsPage = () => {
    const navigate = useNavigate();
    // eslint-disable-next-line no-unused-vars
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('standard'); // standard, ai, conversion
    const [timeRange, setTimeRange] = useState('7'); // 7, 30, 90 days
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        salesOverTime: [],
        categoryData: [],
        topProducts: []
    });
    const [conversionMetrics, setConversionMetrics] = useState({
        totalSent: 0,
        totalConverted: 0,
        conversionRate: 0,
        recentConversions: [],
        byPlatform: []
    });

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);



    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(timeRange));

            // 1. Fetch POS Orders
            const { data: posOrders, error: posError } = await supabase
                .from('pos_orders')
                .select(`
                    id, created_at, status,
                    session:pos_sessions(total_amount),
                    items:pos_order_items(name, price, quantity)
                `)
                .eq('tenant_id', user.id)
                .gte('created_at', startDate.toISOString())
                .in('status', ['served', 'completed']); // Assuming 'served' is final for now

            if (posError) throw posError;

            // 2. Fetch Aggregated Data (Processing on Client for flexibility)
            let revenue = 0;
            let orderCount = 0;
            const salesMap = {};
            const productMap = {};

            const processOrder = (order, amount, dateStr, items) => {
                revenue += amount;
                orderCount += 1;

                // Daily Sales
                const date = new Date(dateStr).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
                salesMap[date] = (salesMap[date] || 0) + amount;

                // Products
                items?.forEach(item => {
                    productMap[item.name] = (productMap[item.name] || 0) + item.quantity;
                });
            };

            posOrders?.forEach(o => {
                const amount = o.session?.total_amount || 0;
                processOrder(o, amount, o.created_at, o.items);
            });

            // Format Data for Charts
            const salesOverTime = Object.keys(salesMap).map(date => ({
                name: date,
                satis: salesMap[date]
            }));

            const topProducts = Object.keys(productMap)
                .map(name => ({ name, count: productMap[name] }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            setMetrics({
                totalRevenue: revenue,
                totalOrders: orderCount,
                averageOrderValue: orderCount > 0 ? revenue / orderCount : 0,
                salesOverTime,
                topProducts,
                categoryData: [] // Placeholder
            });

        } catch (error) {
            console.error('Analytics Error:', error);
            toast.error('Veriler yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);


    const fetchConversionMetrics = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Total sent messages
            const { data: allConversions, error } = await supabase
                .from('platform_customer_conversions')
                .select('*')
                .eq('tenant_id', user.id);

            if (error) throw error;

            const sent = allConversions?.filter(c => c.message_sent_at) || [];
            const converted = allConversions?.filter(c => c.converted_at) || [];

            // Group by platform
            const platformMap = {};
            sent.forEach(c => {
                const platform = c.platform_code || 'Bilinmeyen';
                if (!platformMap[platform]) {
                    platformMap[platform] = { sent: 0, converted: 0 };
                }
                platformMap[platform].sent++;
                if (c.converted_at) {
                    platformMap[platform].converted++;
                }
            });

            const byPlatform = Object.keys(platformMap).map(platform => ({
                name: platform === 'getir' ? 'Getir' : platform === 'yemeksepeti' ? 'Yemeksepeti' : platform === 'trendyol' ? 'Trendyol' : platform,
                sent: platformMap[platform].sent,
                converted: platformMap[platform].converted,
                rate: platformMap[platform].sent > 0
                    ? ((platformMap[platform].converted / platformMap[platform].sent) * 100).toFixed(1)
                    : 0
            }));

            // Recent conversions (last 10)
            const recentConversions = converted
                .sort((a, b) => new Date(b.converted_at) - new Date(a.converted_at))
                .slice(0, 10);

            setConversionMetrics({
                totalSent: sent.length,
                totalConverted: converted.length,
                conversionRate: sent.length > 0 ? ((converted.length / sent.length) * 100).toFixed(1) : 0,
                recentConversions,
                byPlatform
            });
        } catch (error) {
            console.error('Conversion metrics error:', error);
        }
    }, []);


    useEffect(() => {
        if (activeTab === 'conversion') {
            fetchConversionMetrics();
        }
    }, [activeTab, fetchConversionMetrics]);



    return (
        <div className="p-6 bg-slate-50 min-h-screen overflow-y-auto pb-20">
            {/* Header with Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/restore')}
                        className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Analitik & Raporlar</h1>
                        <p className="text-slate-500 text-sm">İşletmenizin performans özeti</p>
                    </div>
                </div>

                {/* Tab Selector */}
                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('standard')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'standard' ? 'bg-indigo-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Standart Raporlar
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'ai' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        AI Raporlar
                    </button>
                    <button
                        onClick={() => setActiveTab('conversion')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'conversion' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        Dönüşüm Raporları
                    </button>
                </div>
            </div>

            {/* AI Reports Tab */}
            {activeTab === 'ai' && <AIReportsPanel />}

            {/* Conversion Reports Tab */}
            {activeTab === 'conversion' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-blue-600" />
                                </div>
                                <span className="text-gray-500 text-sm">Gönderilen Mesaj</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-800">{conversionMetrics.totalSent}</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <ShoppingBag className="w-5 h-5 text-green-600" />
                                </div>
                                <span className="text-gray-500 text-sm">Dönüşen Müşteri</span>
                            </div>
                            <p className="text-3xl font-bold text-green-600">{conversionMetrics.totalConverted}</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-purple-600" />
                                </div>
                                <span className="text-gray-500 text-sm">Dönüşüm Oranı</span>
                            </div>
                            <p className="text-3xl font-bold text-purple-600">%{conversionMetrics.conversionRate}</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 shadow-sm text-white">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <span className="text-white/80 text-sm">Tahmini Tasarruf</span>
                            </div>
                            <p className="text-3xl font-bold">₺{(conversionMetrics.totalConverted * 50).toLocaleString()}</p>
                            <p className="text-xs text-white/60 mt-1">~50₺/sipariş komisyon</p>
                        </div>
                    </div>

                    {/* Platform Breakdown */}
                    {conversionMetrics.byPlatform.length > 0 && (
                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4">Platform Bazlı Dönüşüm</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {conversionMetrics.byPlatform.map(p => (
                                    <div key={p.name} className="bg-gray-50 rounded-lg p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-semibold text-gray-700">{p.name}</span>
                                            <span className="text-green-600 font-bold">%{p.rate}</span>
                                        </div>
                                        <div className="flex gap-4 text-sm text-gray-500">
                                            <span>📤 {p.sent} gönderildi</span>
                                            <span>✅ {p.converted} dönüştü</span>
                                        </div>
                                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                                                style={{ width: `${p.rate}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Conversions Table */}
                    {conversionMetrics.recentConversions.length > 0 && (
                        <div className="bg-white rounded-xl p-6 border shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4">Son Dönüşümler</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-gray-500">
                                            <th className="pb-3 font-medium">Müşteri</th>
                                            <th className="pb-3 font-medium">Telefon</th>
                                            <th className="pb-3 font-medium">Platform</th>
                                            <th className="pb-3 font-medium">Dönüşüm Tarihi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {conversionMetrics.recentConversions.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50">
                                                <td className="py-3 font-medium text-gray-800">{c.customer_name || 'İsimsiz'}</td>
                                                <td className="py-3 text-gray-600">{c.customer_phone}</td>
                                                <td className="py-3">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                        {c.platform_code || 'Bilinmiyor'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-gray-500">
                                                    {new Date(c.converted_at).toLocaleDateString('tr-TR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {conversionMetrics.totalSent === 0 && (
                        <div className="bg-white rounded-xl p-12 border shadow-sm text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <TrendingUp className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Henüz Veri Yok</h3>
                            <p className="text-gray-500 mb-4">Platform dönüştürme özelliğini aktifleştirin ve müşteri kazanmaya başlayın.</p>
                            <a
                                href="/restore/conversion"
                                className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                            >
                                <TrendingUp className="w-4 h-4" />
                                Dönüşüm Ayarları
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Standard Reports Tab */}
            {activeTab === 'standard' && (
                <>
                    {/* Time Range Selector */}
                    <div className="flex justify-end mb-6">
                        <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                            {[
                                { label: 'Son 7 Gün', value: '7' },
                                { label: 'Son 30 Gün', value: '30' },
                                { label: 'Son 90 Gün', value: '90' }
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setTimeRange(opt.value)}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${timeRange === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <KPICard
                            title="Toplam Ciro"
                            value={`₺${metrics.totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                            icon={DollarSign}
                            color="text-green-600"
                            bg="bg-green-50"
                        />
                        <KPICard
                            title="Toplam Sipariş"
                            value={metrics.totalOrders}
                            icon={ShoppingBag}
                            color="text-blue-600"
                            bg="bg-blue-50"
                        />
                        <KPICard
                            title="Ortalama Sepet"
                            value={`₺${metrics.averageOrderValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                            icon={CreditCard}
                            color="text-purple-600"
                            bg="bg-purple-50"
                        />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Sales Trend */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                Satış Grafiği
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={metrics.salesOverTime}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={val => `₺${val}`} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [`₺${value}`, 'Ciro']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="satis"
                                            stroke="#6366f1"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-orange-500" />
                                En Çok Satan Ürünler
                            </h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={metrics.topProducts} margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#4B5563', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                        <Bar dataKey="count" fill="#F97316" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const KPICard = ({ title, value, icon: CardIcon, color, bg }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg} ${color}`}>
            <CardIcon className="w-6 h-6" />
        </div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);


