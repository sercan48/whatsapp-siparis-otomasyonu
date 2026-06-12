import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    TrendingUp, TrendingDown, Wallet, Truck, Calendar,
    ArrowUpRight, ArrowDownRight, DollarSign, CreditCard, Banknote,
    FileText, PieChart, BarChart3, RefreshCw, ChevronRight

} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export const AccountingDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('today'); // today, week, month
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
        cashBalance: 0,
        cardTotal: 0,
        courierBalance: 0,
        vatCollected: 0,
        posCount: 0,
        deliveryCount: 0
    });
    const [recentEntries, setRecentEntries] = useState([]);
    const [courierBalances, setCourierBalances] = useState([]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);





    const fetchData = useCallback(async () => {
        const getDateFilter = () => {
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
                    startDate = new Date(now.setHours(0, 0, 0, 0));
            }
            return startDate.toISOString();
        };

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const startDate = getDateFilter();

            // Fetch ledger entries
            const { data: entries } = await supabase
                .from('ledger_entries')
                .select('*')
                .eq('tenant_id', user.id)
                .gte('created_at', startDate)
                .order('created_at', { ascending: false });

            // Fetch courier balances
            const { data: couriers } = await supabase
                .from('courier_accounts')
                .select('*, couriers(name, phone)')
                .eq('tenant_id', user.id);

            // Calculate stats
            const income = (entries || []).filter(e => e.entry_type === 'income').reduce((sum, e) => sum + Number(e.amount), 0);
            const expense = (entries || []).filter(e => e.entry_type === 'expense').reduce((sum, e) => sum + Number(e.amount), 0);
            const vat = (entries || []).reduce((sum, e) => sum + Number(e.vat_amount || 0), 0);
            const cashEntries = (entries || []).filter(e => e.payment_method === 'cash' && e.entry_type === 'income');
            const cardEntries = (entries || []).filter(e => e.payment_method === 'card' && e.entry_type === 'income');
            const posEntries = (entries || []).filter(e => e.category === 'pos_sale');
            const deliveryEntries = (entries || []).filter(e => e.category === 'delivery_sale');

            const courierTotal = (couriers || []).reduce((sum, c) => sum + Number(c.balance || 0), 0);

            setStats({
                totalIncome: income,
                totalExpense: expense,
                netProfit: income - expense,
                cashBalance: cashEntries.reduce((sum, e) => sum + Number(e.amount), 0),
                cardTotal: cardEntries.reduce((sum, e) => sum + Number(e.amount), 0),
                courierBalance: courierTotal,
                vatCollected: vat,
                posCount: posEntries.length,
                deliveryCount: deliveryEntries.length
            });

            setRecentEntries((entries || []).slice(0, 10));
            setCourierBalances(couriers || []);

        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Veri yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [dateRange]);



    const StatCard = ({ title, value, icon: CardIcon, color, trend, subtitle }) => (
        <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${color}`}>
                    <CardIcon className="w-5 h-5" />
                </div>
                {trend && (
                    <span className={`flex items-center text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-gray-800">₺{value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            <p className="text-sm text-gray-500 mt-1">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
    );


    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                    <p className="text-gray-500">Muhasebe verileri yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Muhasebe Paneli</h1>
                    <p className="text-gray-500">Gelir, gider ve kurye hesapları</p>
                </div>

                {/* Date Range Selector */}
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg shadow-sm border">
                    {[
                        { id: 'today', label: 'Bugün' },
                        { id: 'week', label: 'Hafta' },
                        { id: 'month', label: 'Ay' }
                    ].map(d => (
                        <button
                            key={d.id}
                            onClick={() => setDateRange(d.id)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${dateRange === d.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    title="Toplam Gelir"
                    value={stats.totalIncome}
                    icon={TrendingUp}
                    color="bg-green-100 text-green-600"
                    subtitle={`${stats.posCount} POS + ${stats.deliveryCount} Paket`}
                />
                <StatCard
                    title="Toplam Gider"
                    value={stats.totalExpense}
                    icon={TrendingDown}
                    color="bg-red-100 text-red-600"
                />
                <StatCard
                    title="Net Kar"
                    value={stats.netProfit}
                    icon={Wallet}
                    color="bg-blue-100 text-blue-600"
                />
                <StatCard
                    title="KDV Tahsilatı"
                    value={stats.vatCollected}
                    icon={FileText}
                    color="bg-purple-100 text-purple-600"
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Banknote className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Nakit Satış</p>
                            <p className="text-xl font-bold text-gray-800">₺{stats.cashBalance.toLocaleString('tr-TR')}</p>
                        </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${stats.totalIncome > 0 ? (stats.cashBalance / stats.totalIncome * 100) : 0}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Kart Satış</p>
                            <p className="text-xl font-bold text-gray-800">₺{stats.cardTotal.toLocaleString('tr-TR')}</p>
                        </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${stats.totalIncome > 0 ? (stats.cardTotal / stats.totalIncome * 100) : 0}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Truck className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Kurye Bakiyesi</p>
                            <p className={`text-xl font-bold ${stats.courierBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₺{Math.abs(stats.courierBalance).toLocaleString('tr-TR')}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400">
                        {stats.courierBalance >= 0 ? 'Kuryelerden alacak' : 'Kuryelere borç'}
                    </p>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800">Son İşlemler</h3>
                        <Link to="/restore/ledger" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            Tümünü Gör <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {recentEntries.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                Henüz işlem yok
                            </div>
                        ) : recentEntries.map(entry => (
                            <div key={entry.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${entry.entry_type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{entry.description || entry.category}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(entry.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`font-bold ${entry.entry_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                    {entry.entry_type === 'income' ? '+' : '-'}₺{Number(entry.amount).toLocaleString('tr-TR')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Courier Balances */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800">Kurye Hesapları</h3>
                        <Link to="/restore/courier-settlement" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            Hesaplaşma <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {courierBalances.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                Kurye hesabı bulunmuyor
                            </div>
                        ) : courierBalances.map(courier => (
                            <div key={courier.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                                        {courier.couriers?.name?.charAt(0) || 'K'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{courier.couriers?.name || 'Kurye'}</p>
                                        <p className="text-xs text-gray-400">{courier.couriers?.phone}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${courier.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ₺{Math.abs(Number(courier.balance)).toLocaleString('tr-TR')}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {courier.balance >= 0 ? 'Alacak' : 'Borç'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link to="/restore/ledger" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                        <p className="font-medium text-gray-800">Muhasebe Defteri</p>
                        <p className="text-xs text-gray-400">Tüm kayıtlar</p>
                    </div>
                </Link>
                <Link to="/restore/courier-settlement" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-3">
                    <Truck className="w-8 h-8 text-orange-600" />
                    <div>
                        <p className="font-medium text-gray-800">Kurye Hesaplaşma</p>
                        <p className="text-xs text-gray-400">Ödeme al/ver</p>
                    </div>
                </Link>
                <Link to="/restore/cash-register" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-3">
                    <Wallet className="w-8 h-8 text-green-600" />
                    <div>
                        <p className="font-medium text-gray-800">Kasa</p>
                        <p className="text-xs text-gray-400">Günlük hareket</p>
                    </div>
                </Link>
                <Link to="/restore/vat-report" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-3">
                    <PieChart className="w-8 h-8 text-purple-600" />
                    <div>
                        <p className="font-medium text-gray-800">KDV Raporu</p>
                        <p className="text-xs text-gray-400">Vergi özeti</p>
                    </div>
                </Link>
            </div>
        </div>
    );
};
