import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    Wallet, Plus, Minus, Clock, ArrowUpRight, ArrowDownRight,
    RefreshCw, Calendar, DollarSign, CreditCard, Banknote, Save
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CashRegister = () => {
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [cashData, setCashData] = useState({
        openingBalance: 0,
        currentBalance: 0,
        totalIn: 0,
        totalOut: 0,
        transactions: []
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTransaction, setNewTransaction] = useState({
        type: 'in',
        amount: '',
        description: '',
        payment_method: 'cash'
    });

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        if (tenantId) fetchCashData();
    }, [selectedDate, tenantId]);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setTenantId(user.id);
        }
    };

    const fetchCashData = async () => {
        setLoading(true);
        try {
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Fetch transactions for selected date
            const { data: transactions } = await supabase
                .from('ledger_entries')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('created_at', startOfDay.toISOString())
                .lte('created_at', endOfDay.toISOString())
                .order('created_at', { ascending: false });

            const txns = transactions || [];
            const totalIn = txns.filter(t => t.entry_type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
            const totalOut = txns.filter(t => t.entry_type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

            // Get opening balance (simplified - sum of all previous transactions)
            const { data: prevTransactions } = await supabase
                .from('ledger_entries')
                .select('entry_type, amount')
                .eq('tenant_id', tenantId)
                .lt('created_at', startOfDay.toISOString());

            const openingBalance = (prevTransactions || []).reduce((sum, t) => {
                return t.entry_type === 'income' ? sum + Number(t.amount) : sum - Number(t.amount);
            }, 0);

            setCashData({
                openingBalance,
                currentBalance: openingBalance + totalIn - totalOut,
                totalIn,
                totalOut,
                transactions: txns
            });

        } catch (error) {
            console.error('Cash data error:', error);
            toast.error('Kasa verileri yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const addTransaction = async () => {
        if (!newTransaction.amount || !newTransaction.description) {
            toast.error('Lütfen tüm alanları doldurun');
            return;
        }

        try {
            const { error } = await supabase
                .from('ledger_entries')
                .insert({
                    tenant_id: tenantId,
                    entry_type: newTransaction.type === 'in' ? 'income' : 'expense',
                    amount: parseFloat(newTransaction.amount),
                    description: newTransaction.description,
                    payment_method: newTransaction.payment_method,
                    category: 'cash_register'
                });

            if (error) throw error;

            toast.success('İşlem kaydedildi');
            setShowAddModal(false);
            setNewTransaction({ type: 'in', amount: '', description: '', payment_method: 'cash' });
            fetchCashData();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500 rounded-xl text-white">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Kasa</h1>
                        <p className="text-gray-500">Günlük nakit hareketleri</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="border-none focus:outline-none text-gray-700"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                        <Plus className="w-4 h-4" />
                        İşlem Ekle
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-5 border">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">Açılış</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        ₺{cashData.openingBalance.toLocaleString('tr-TR')}
                    </p>
                </div>

                <div className="bg-white rounded-xl p-5 border">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-500">Giriş</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                        +₺{cashData.totalIn.toLocaleString('tr-TR')}
                    </p>
                </div>

                <div className="bg-white rounded-xl p-5 border">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-gray-500">Çıkış</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">
                        -₺{cashData.totalOut.toLocaleString('tr-TR')}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 opacity-80" />
                        <span className="text-sm opacity-80">Mevcut Bakiye</span>
                    </div>
                    <p className="text-2xl font-bold">
                        ₺{cashData.currentBalance.toLocaleString('tr-TR')}
                    </p>
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b">
                    <h3 className="font-bold text-gray-800">Günlük Hareketler</h3>
                </div>
                <div className="divide-y">
                    {cashData.transactions.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Bu tarihte işlem bulunamadı</p>
                        </div>
                    ) : cashData.transactions.map(tx => (
                        <div key={tx.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${tx.entry_type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                                    {tx.entry_type === 'income' ? (
                                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">{tx.description || tx.category}</p>
                                    <p className="text-sm text-gray-400">
                                        {new Date(tx.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        {' • '}
                                        {tx.payment_method === 'cash' ? '💵 Nakit' : '💳 Kart'}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-lg font-bold ${tx.entry_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.entry_type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Transaction Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Yeni İşlem</h3>

                        <div className="space-y-4">
                            {/* Type Selection */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setNewTransaction({ ...newTransaction, type: 'in' })}
                                    className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${newTransaction.type === 'in'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    <Plus className="w-4 h-4" /> Para Girişi
                                </button>
                                <button
                                    onClick={() => setNewTransaction({ ...newTransaction, type: 'out' })}
                                    className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${newTransaction.type === 'out'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    <Minus className="w-4 h-4" /> Para Çıkışı
                                </button>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Tutar</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₺</span>
                                    <input
                                        type="number"
                                        value={newTransaction.amount}
                                        onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                                        className="w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Açıklama</label>
                                <input
                                    type="text"
                                    value={newTransaction.description}
                                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500"
                                    placeholder="İşlem açıklaması..."
                                />
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Ödeme Yöntemi</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNewTransaction({ ...newTransaction, payment_method: 'cash' })}
                                        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${newTransaction.payment_method === 'cash' ? 'bg-amber-100 border-amber-500 border-2' : 'bg-gray-100'}`}
                                    >
                                        <Banknote className="w-4 h-4" /> Nakit
                                    </button>
                                    <button
                                        onClick={() => setNewTransaction({ ...newTransaction, payment_method: 'card' })}
                                        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${newTransaction.payment_method === 'card' ? 'bg-blue-100 border-blue-500 border-2' : 'bg-gray-100'}`}
                                    >
                                        <CreditCard className="w-4 h-4" /> Kart
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-3 border rounded-lg font-medium text-gray-600"
                            >
                                İptal
                            </button>
                            <button
                                onClick={addTransaction}
                                className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashRegister;
