import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Star, TrendingUp, ShoppingBag, Gift, CheckCircle, Clock, Calendar, Shield, Ban, AlertTriangle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export const Customers = ({ tenantId }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, vip, risky, blacklisted

    const fetchCustomers = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);

        // Fetch customers with all new fields
        const { data, error } = await supabase
            .from('customers')
            .select(`
                id, phone, name, 
                total_spend, loyalty_points_balance, order_count,
                trust_score, complaint_count, is_blacklisted,
                kvkk_consent, birth_date, created_at,
                customer_segments ( name, color )
            `)
            .eq('tenant_id', tenantId)
            .order('total_spend', { ascending: false });

        if (error) {
            console.error('Fetch error:', error);
        } else {
            setCustomers(data || []);
        }
        setLoading(false);
    }, [tenantId]);


    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchCustomers();
    }, [fetchCustomers]);




    const toggleBlacklist = async (customerId, currentStatus) => {
        const newStatus = !currentStatus;
        const { error } = await supabase
            .from('customers')
            .update({ is_blacklisted: newStatus })
            .eq('id', customerId);

        if (error) {
            toast.error('Güncelleme başarısız');
        } else {
            toast.success(newStatus ? 'Müşteri engellendi' : 'Engel kaldırıldı');
            fetchCustomers();
        }
    };

    // Filter logic
    const filteredCustomers = customers.filter(c => {
        if (filter === 'vip') return (c.order_count || 0) >= 10;
        if (filter === 'risky') return (c.trust_score || 50) < 30;
        if (filter === 'blacklisted') return c.is_blacklisted;
        return true;
    });

    // Stats
    const totalCustomers = customers.length;
    const vipCount = customers.filter(c => (c.order_count || 0) >= 10).length;
    const riskyCount = customers.filter(c => (c.trust_score || 50) < 30).length;
    const blacklistedCount = customers.filter(c => c.is_blacklisted).length;

    const getTrustColor = (score) => {
        if (!score) score = 50;
        if (score >= 70) return 'text-green-600 bg-green-100';
        if (score >= 40) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Müşteri Yönetimi (CRM)</h1>
                    <p className="text-gray-500">Güven skorları, kara liste ve sadakat takibi</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <button
                    onClick={() => setFilter('all')}
                    className={`p-4 rounded-xl border-2 transition-all ${filter === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-500" />
                        <div className="text-left">
                            <div className="text-2xl font-bold">{totalCustomers}</div>
                            <div className="text-xs text-gray-500">Toplam Müşteri</div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setFilter('vip')}
                    className={`p-4 rounded-xl border-2 transition-all ${filter === 'vip' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <Star className="w-8 h-8 text-purple-500" />
                        <div className="text-left">
                            <div className="text-2xl font-bold">{vipCount}</div>
                            <div className="text-xs text-gray-500">VIP (10+ Sipariş)</div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setFilter('risky')}
                    className={`p-4 rounded-xl border-2 transition-all ${filter === 'risky' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                        <div className="text-left">
                            <div className="text-2xl font-bold">{riskyCount}</div>
                            <div className="text-xs text-gray-500">Riskli (&lt;30 Puan)</div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setFilter('blacklisted')}
                    className={`p-4 rounded-xl border-2 transition-all ${filter === 'blacklisted' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-red-300'}`}
                >
                    <div className="flex items-center gap-3">
                        <Ban className="w-8 h-8 text-red-500" />
                        <div className="text-left">
                            <div className="text-2xl font-bold">{blacklistedCount}</div>
                            <div className="text-xs text-gray-500">Engelli</div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Müşteri</th>
                            <th className="p-4 font-semibold text-gray-600">Güven Skoru</th>
                            <th className="p-4 font-semibold text-gray-600">Toplam Harcama</th>
                            <th className="p-4 font-semibold text-gray-600">Şikayet</th>
                            <th className="p-4 font-semibold text-gray-600 text-center">Durum</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Aksiyon</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">Yükleniyor...</td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-400">Müşteri bulunamadı.</td></tr>
                        ) : (
                            filteredCustomers.map(c => {
                                const isVip = (c.order_count || 0) >= 10;
                                const trustScore = c.trust_score || 50;
                                return (
                                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.is_blacklisted ? 'bg-red-50/50' : ''}`}>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {isVip && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                                                {c.is_blacklisted && <Ban className="w-4 h-4 text-red-500" />}
                                                <div>
                                                    <div className="font-medium text-gray-800">{c.name || 'İsimsiz'}</div>
                                                    <div className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {c.phone}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-gray-400" />
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getTrustColor(trustScore)}`}>
                                                    {trustScore}/100
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{(c.total_spend || 0).toFixed(2)} ₺</div>
                                            {c.loyalty_points_balance > 0 && (
                                                <div className="text-xs text-orange-600 flex items-center gap-1">
                                                    <Gift className="w-3 h-3" />
                                                    {c.loyalty_points_balance} Puan
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {(c.complaint_count || 0) > 0 ? (
                                                <span className="px-2 py-1 rounded-full text-xs font-bold text-red-600 bg-red-100">
                                                    {c.complaint_count} şikayet
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {c.is_blacklisted ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-red-500">
                                                    ENGELLİ
                                                </span>
                                            ) : trustScore < 30 ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-orange-500">
                                                    RİSKLİ
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-green-500">
                                                    AKTİF
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => toggleBlacklist(c.id, c.is_blacklisted)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${c.is_blacklisted
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                            >
                                                {c.is_blacklisted ? 'Engeli Kaldır' : 'Engelle'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
