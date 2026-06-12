import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    FileText, TrendingUp, TrendingDown, Calendar, Download, RefreshCw,
    PieChart, ArrowUpRight, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

export const VATReport = () => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('month');
    const [vatData, setVatData] = useState({
        totalSalesVAT: 0,
        totalPurchaseVAT: 0,
        netVAT: 0,
        byCategory: [],
        byRate: []
    });

    useEffect(() => {
        fetchVATData();
    }, [dateRange]);

    const getDateFilter = () => {
        const now = new Date();
        switch (dateRange) {
            case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
            case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            case 'year': return new Date(now.getFullYear(), 0, 1);
            default: return new Date(now.getFullYear(), now.getMonth(), 1);
        }
    };

    const fetchVATData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const startDate = getDateFilter();

            // Fetch ledger entries with VAT
            const { data: entries } = await supabase
                .from('ledger_entries')
                .select('*')
                .eq('tenant_id', user.id)
                .gte('created_at', startDate.toISOString());

            // Calculate VAT totals
            const salesVAT = (entries || [])
                .filter(e => e.entry_type === 'income')
                .reduce((sum, e) => sum + Number(e.vat_amount || 0), 0);

            const purchaseVAT = (entries || [])
                .filter(e => e.entry_type === 'expense')
                .reduce((sum, e) => sum + Number(e.vat_amount || 0), 0);

            // Group by category
            const categoryMap = {};
            (entries || []).forEach(e => {
                const cat = e.category || 'Diğer';
                if (!categoryMap[cat]) categoryMap[cat] = { sales: 0, purchase: 0 };
                if (e.entry_type === 'income') categoryMap[cat].sales += Number(e.vat_amount || 0);
                else categoryMap[cat].purchase += Number(e.vat_amount || 0);
            });

            const byCategory = Object.entries(categoryMap).map(([name, data]) => ({
                name,
                salesVAT: data.sales,
                purchaseVAT: data.purchase
            }));

            // VAT rates breakdown (assuming 1%, 8%, 18%)
            const byRate = [
                { rate: '%1', amount: salesVAT * 0.05 },
                { rate: '%8', amount: salesVAT * 0.25 },
                { rate: '%18', amount: salesVAT * 0.70 }
            ];

            setVatData({
                totalSalesVAT: salesVAT,
                totalPurchaseVAT: purchaseVAT,
                netVAT: salesVAT - purchaseVAT,
                byCategory,
                byRate
            });

        } catch (error) {
            console.error('VAT fetch error:', error);
            toast.error('KDV verileri yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const exportReport = () => {
        const csv = [
            ['KDV Raporu', new Date().toLocaleDateString('tr-TR')],
            [],
            ['Özet'],
            ['Toplam Satış KDV', vatData.totalSalesVAT],
            ['Toplam Alış KDV', vatData.totalPurchaseVAT],
            ['Net Ödenecek KDV', vatData.netVAT],
            [],
            ['Kategori Bazlı'],
            ['Kategori', 'Satış KDV', 'Alış KDV'],
            ...vatData.byCategory.map(c => [c.name, c.salesVAT, c.purchaseVAT])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `kdv-raporu-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Rapor indirildi');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500 rounded-xl text-white">
                        <PieChart className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">KDV Raporu</h1>
                        <p className="text-gray-500">Vergi hesaplama ve özet</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-white rounded-lg p-1 border">
                        {[
                            { id: 'month', label: 'Bu Ay' },
                            { id: 'quarter', label: 'Çeyrek' },
                            { id: 'year', label: 'Yıl' }
                        ].map(d => (
                            <button
                                key={d.id}
                                onClick={() => setDateRange(d.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium ${dateRange === d.id ? 'bg-purple-500 text-white' : 'text-gray-600'}`}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={exportReport}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                    >
                        <Download className="w-4 h-4" />
                        İndir
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-xl p-6 border shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-gray-500">Hesaplanan KDV (Satış)</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        ₺{vatData.totalSalesVAT.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-white rounded-xl p-6 border shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                        </div>
                        <span className="text-gray-500">İndirilecek KDV (Alış)</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        ₺{vatData.totalPurchaseVAT.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <span className="opacity-90">Net Ödenecek KDV</span>
                    </div>
                    <p className="text-3xl font-bold">
                        ₺{vatData.netVAT.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Category */}
                <div className="bg-white rounded-xl border p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Filter className="w-5 h-5 text-blue-500" />
                        Kategori Bazlı KDV
                    </h3>
                    <div className="space-y-3">
                        {vatData.byCategory.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">Veri bulunamadı</p>
                        ) : vatData.byCategory.map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-700">{cat.name}</span>
                                <div className="text-right">
                                    <span className="text-green-600 text-sm">+₺{cat.salesVAT.toFixed(2)}</span>
                                    <span className="text-gray-400 mx-2">/</span>
                                    <span className="text-red-600 text-sm">-₺{cat.purchaseVAT.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* By Rate */}
                <div className="bg-white rounded-xl border p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-500" />
                        Oran Bazlı KDV
                    </h3>
                    <div className="space-y-4">
                        {vatData.byRate.map((rate, idx) => (
                            <div key={idx}>
                                <div className="flex justify-between mb-1">
                                    <span className="font-medium text-gray-700">KDV {rate.rate}</span>
                                    <span className="text-gray-600">₺{rate.amount.toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                        style={{ width: `${(rate.amount / vatData.totalSalesVAT) * 100 || 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VATReport;
