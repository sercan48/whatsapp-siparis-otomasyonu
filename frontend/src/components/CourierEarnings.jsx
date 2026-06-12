import React, { useState, useEffect } from 'react';
import {
    DollarSign, TrendingUp, Calendar, ChevronRight,
    Package, Award, Clock, Filter, Download, Loader2,
    ArrowUp, ArrowDown, Wallet, Gift, Star
} from 'lucide-react';
import { getCourierEarnings, getEarningsHistory, formatCurrency } from '../lib/courierService';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const CourierEarnings = () => {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('today');
    const [summary, setSummary] = useState(null);
    const [history, setHistory] = useState([]);
    const [courierId, setCourierId] = useState(null);

    useEffect(() => {
        initCourier();
    }, []);

    useEffect(() => {
        if (courierId) {
            loadEarnings();
        }
    }, [courierId, period]);

    const initCourier = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCourierId(user.id);
        }
    };

    const loadEarnings = async () => {
        setLoading(true);
        try {
            const [summaryData, historyData] = await Promise.all([
                getCourierEarnings(courierId, period),
                getEarningsHistory(courierId)
            ]);
            setSummary(summaryData);
            setHistory(historyData);
        } catch (error) {
            console.error('Error loading earnings:', error);
            toast.error('Kazanç bilgileri yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const periodLabels = {
        today: 'Bugün',
        week: 'Bu Hafta',
        month: 'Bu Ay'
    };

    const getEarningTypeIcon = (type) => {
        switch (type) {
            case 'delivery': return <Package className="w-4 h-4" />;
            case 'tip': return <Gift className="w-4 h-4" />;
            case 'bonus_peak_hour': return <Clock className="w-4 h-4" />;
            case 'bonus_night': return <Star className="w-4 h-4" />;
            case 'bonus_weekend': return <Award className="w-4 h-4" />;
            default: return <DollarSign className="w-4 h-4" />;
        }
    };

    const getEarningTypeLabel = (type) => {
        switch (type) {
            case 'delivery': return 'Teslimat';
            case 'tip': return 'Bahşiş';
            case 'bonus_peak_hour': return 'Öğle Bonusu';
            case 'bonus_night': return 'Gece Bonusu';
            case 'bonus_weekend': return 'Hafta Sonu';
            case 'bonus_daily': return 'Günlük Hedef';
            case 'bonus_rating': return 'Puan Bonusu';
            case 'penalty': return 'Kesinti';
            default: return type;
        }
    };

    const getEarningTypeColor = (type) => {
        if (type === 'penalty') return 'text-red-600 bg-red-50';
        if (type === 'tip') return 'text-purple-600 bg-purple-50';
        if (type.startsWith('bonus_')) return 'text-amber-600 bg-amber-50';
        return 'text-green-600 bg-green-50';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-green-500 mx-auto mb-3" />
                    <p className="text-slate-600">Kazançlar yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-600 pb-20">
            {/* Header */}
            <div className="p-6 text-white">
                <h1 className="text-2xl font-bold mb-1">Kazançlarım</h1>
                <p className="text-green-100 text-sm">Teslimat ve bonus kazançlarınız</p>
            </div>

            {/* Period Selector */}
            <div className="px-4 mb-4">
                <div className="bg-white/20 rounded-xl p-1 flex">
                    {Object.entries(periodLabels).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setPeriod(key)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${period === key
                                    ? 'bg-white text-green-600 shadow'
                                    : 'text-white hover:bg-white/10'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Card */}
            <div className="px-4 mb-6">
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    <div className="text-center mb-6">
                        <p className="text-slate-500 text-sm mb-1">Toplam Kazanç</p>
                        <p className="text-4xl font-bold text-slate-800">
                            {formatCurrency(summary?.total || 0)}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-xl">
                            <Package className="w-5 h-5 text-green-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-green-700">
                                {formatCurrency(summary?.deliveries || 0)}
                            </p>
                            <p className="text-xs text-green-600">Teslimat</p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-xl">
                            <Gift className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-purple-700">
                                {formatCurrency(summary?.tips || 0)}
                            </p>
                            <p className="text-xs text-purple-600">Bahşiş</p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-xl">
                            <Award className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-amber-700">
                                {formatCurrency(summary?.bonuses || 0)}
                            </p>
                            <p className="text-xs text-amber-600">Bonus</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="px-4 mb-6">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Teslimat Sayısı</p>
                                <p className="text-lg font-bold text-slate-800">
                                    {summary?.breakdown?.filter(e => e.earning_type === 'delivery').length || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Ortalama / Teslimat</p>
                                <p className="text-lg font-bold text-slate-800">
                                    {formatCurrency(
                                        summary?.deliveries && summary?.breakdown?.filter(e => e.earning_type === 'delivery').length
                                            ? summary.deliveries / summary.breakdown.filter(e => e.earning_type === 'delivery').length
                                            : 0
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Earnings History */}
            <div className="px-4">
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between">
                        <h2 className="font-semibold text-slate-800">Kazanç Geçmişi</h2>
                        <button className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
                            <Filter className="w-4 h-4" />
                            Filtrele
                        </button>
                    </div>

                    <div className="divide-y max-h-96 overflow-y-auto">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <Wallet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                <p>Henüz kazanç kaydı yok</p>
                            </div>
                        ) : (
                            history.map((earning) => (
                                <div key={earning.id} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getEarningTypeColor(earning.earning_type)}`}>
                                                {getEarningTypeIcon(earning.earning_type)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">
                                                    {getEarningTypeLabel(earning.earning_type)}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(earning.created_at).toLocaleDateString('tr-TR', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${earning.earning_type === 'penalty' ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                {earning.earning_type === 'penalty' ? '-' : '+'}
                                                {formatCurrency(earning.amount)}
                                            </p>
                                            {earning.distance_km && (
                                                <p className="text-xs text-slate-500">
                                                    {earning.distance_km.toFixed(1)} km
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Payout Request Button */}
            <div className="fixed bottom-20 left-4 right-4">
                <button className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold shadow-lg 
                                   hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" />
                    Ödeme Talep Et
                </button>
            </div>
        </div>
    );
};

export default CourierEarnings;
