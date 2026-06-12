import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    Truck, ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight,
    Check, X, Clock, RefreshCw, ChevronDown, ChevronUp,
    Banknote, CreditCard, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export const CourierSettlement = () => {
    const [loading, setLoading] = useState(true);
    const [couriers, setCouriers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [showSettlementModal, setShowSettlementModal] = useState(false);
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementType, setSettlementType] = useState('collect'); // 'collect' or 'pay'
    const [expandedCourier, setExpandedCourier] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch courier accounts with courier details
            const { data: accounts } = await supabase
                .from('courier_accounts')
                .select('*, couriers(id, name, phone, status)')
                .eq('tenant_id', user.id);

            // Fetch recent transactions
            const { data: txns } = await supabase
                .from('courier_transactions')
                .select('*, couriers(name)')
                .eq('tenant_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            setCouriers(accounts || []);
            setTransactions(txns || []);

        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Veri yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleSettlement = async () => {
        if (!selectedCourier || !settlementAmount || Number(settlementAmount) <= 0) {
            toast.error('Lütfen geçerli bir tutar girin');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const txn = {
                tenant_id: user.id,
                courier_id: selectedCourier.couriers.id,
                transaction_type: 'settlement',
                amount: Number(settlementAmount),
                direction: settlementType === 'collect' ? 'debit' : 'credit',
                description: settlementType === 'collect'
                    ? `Kuryeden tahsilat`
                    : `Kuryeye ödeme`,
                status: 'completed',
                created_by: user.id
            };

            const { error } = await supabase
                .from('courier_transactions')
                .insert(txn);

            if (error) throw error;

            // Also create ledger entry
            await supabase.from('ledger_entries').insert({
                tenant_id: user.id,
                entry_type: settlementType === 'collect' ? 'income' : 'expense',
                category: settlementType === 'collect' ? 'courier_collection' : 'courier_payment',
                amount: Number(settlementAmount),
                payment_method: 'cash',
                description: `${selectedCourier.couriers.name} - ${settlementType === 'collect' ? 'Tahsilat' : 'Ödeme'}`,
                reference_type: 'courier',
                reference_id: selectedCourier.couriers.id,
                created_by: user.id
            });

            toast.success(`₺${settlementAmount} ${settlementType === 'collect' ? 'tahsil edildi' : 'ödendi'}`);
            setShowSettlementModal(false);
            setSettlementAmount('');
            setSelectedCourier(null);
            fetchData();

        } catch (error) {
            console.error('Settlement error:', error);
            toast.error('İşlem başarısız: ' + error.message);
        }
    };

    const getCourierTransactions = (courierId) => {
        return transactions.filter(t => t.courier_id === courierId).slice(0, 10);
    };

    const totalBalance = couriers.reduce((sum, c) => sum + Number(c.balance || 0), 0);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link to="/restore/accounting" className="p-2 hover:bg-gray-200 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Kurye Hesaplaşma</h1>
                    <p className="text-gray-500">Nakit tahsilat ve ödeme yönetimi</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <Truck className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Aktif Kurye</p>
                            <p className="text-2xl font-bold text-gray-800">{couriers.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${totalBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                            <Wallet className={`w-6 h-6 ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Toplam Bakiye</p>
                            <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₺{Math.abs(totalBalance).toLocaleString('tr-TR')}
                            </p>
                            <p className="text-xs text-gray-400">
                                {totalBalance >= 0 ? 'Kuryelerden alacak' : 'Kuryelere borç'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Bugünkü İşlem</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {transactions.filter(t =>
                                    new Date(t.created_at).toDateString() === new Date().toDateString()
                                ).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Courier List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Kurye Hesapları</h3>
                </div>

                {couriers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        Kurye hesabı bulunmuyor
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {couriers.map(courier => (
                            <div key={courier.id}>
                                {/* Courier Row */}
                                <div
                                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                    onClick={() => setExpandedCourier(expandedCourier === courier.id ? null : courier.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                                            {courier.couriers?.name?.charAt(0) || 'K'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{courier.couriers?.name}</p>
                                            <p className="text-sm text-gray-400">{courier.couriers?.phone}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${courier.couriers?.status === 'online'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {courier.couriers?.status === 'online' ? 'Aktif' : 'Offline'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${courier.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                ₺{Math.abs(Number(courier.balance)).toLocaleString('tr-TR')}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {courier.balance >= 0 ? 'Alacak' : 'Borç'}
                                            </p>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedCourier(courier);
                                                setSettlementType(courier.balance >= 0 ? 'collect' : 'pay');
                                                setSettlementAmount(Math.abs(courier.balance).toString());
                                                setShowSettlementModal(true);
                                            }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                        >
                                            Hesaplaş
                                        </button>

                                        {expandedCourier === courier.id ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Transaction List */}
                                {expandedCourier === courier.id && (
                                    <div className="bg-gray-50 px-4 pb-4">
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="bg-white p-3 rounded-lg text-center">
                                                <p className="text-xs text-gray-500">Toplam Kazanç</p>
                                                <p className="font-bold text-green-600">₺{Number(courier.total_earned).toLocaleString('tr-TR')}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg text-center">
                                                <p className="text-xs text-gray-500">Tahsil Edilen</p>
                                                <p className="font-bold text-blue-600">₺{Number(courier.total_collected).toLocaleString('tr-TR')}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg text-center">
                                                <p className="text-xs text-gray-500">Son Hesaplaşma</p>
                                                <p className="font-bold text-gray-600">
                                                    {courier.last_settlement_date
                                                        ? new Date(courier.last_settlement_date).toLocaleDateString('tr-TR')
                                                        : '-'
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-medium text-gray-600 mb-2">Son İşlemler</h4>
                                        <div className="bg-white rounded-lg divide-y divide-gray-50">
                                            {getCourierTransactions(courier.couriers.id).length === 0 ? (
                                                <div className="p-4 text-center text-gray-400 text-sm">
                                                    Henüz işlem yok
                                                </div>
                                            ) : getCourierTransactions(courier.couriers.id).map(txn => (
                                                <div key={txn.id} className="p-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${txn.direction === 'credit' ? 'bg-red-500' : 'bg-green-500'
                                                            }`} />
                                                        <div>
                                                            <p className="text-sm text-gray-700">{txn.description || txn.transaction_type}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {new Date(txn.created_at).toLocaleString('tr-TR')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`font-medium ${txn.direction === 'credit' ? 'text-red-600' : 'text-green-600'
                                                        }`}>
                                                        {txn.direction === 'credit' ? '-' : '+'}₺{Number(txn.amount).toLocaleString('tr-TR')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Settlement Modal */}
            {showSettlementModal && selectedCourier && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Kurye Hesaplaşma</h3>

                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                                    {selectedCourier.couriers?.name?.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium">{selectedCourier.couriers?.name}</p>
                                    <p className="text-sm text-gray-400">{selectedCourier.couriers?.phone}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                                <span className="text-sm text-gray-500">Mevcut Bakiye:</span>
                                <span className={`font-bold ${selectedCourier.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₺{Math.abs(Number(selectedCourier.balance)).toLocaleString('tr-TR')}
                                    <span className="text-xs font-normal ml-1">
                                        ({selectedCourier.balance >= 0 ? 'Alacak' : 'Borç'})
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Settlement Type */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setSettlementType('collect')}
                                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${settlementType === 'collect'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                <ArrowDownRight className="w-4 h-4" />
                                Tahsil Et
                            </button>
                            <button
                                onClick={() => setSettlementType('pay')}
                                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${settlementType === 'pay'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                <ArrowUpRight className="w-4 h-4" />
                                Öde
                            </button>
                        </div>

                        {/* Amount Input */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tutar (₺)</label>
                            <input
                                type="number"
                                value={settlementAmount}
                                onChange={(e) => setSettlementAmount(e.target.value)}
                                className="w-full p-3 text-xl font-bold text-center border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0.00"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowSettlementModal(false);
                                    setSelectedCourier(null);
                                    setSettlementAmount('');
                                }}
                                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSettlement}
                                className={`flex-1 py-3 rounded-lg text-white font-bold ${settlementType === 'collect' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {settlementType === 'collect' ? 'Tahsil Et' : 'Öde'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
