import React, { useState, useEffect } from 'react';
import {
    BookOpen, DollarSign, FileText, Calculator, Plus, Loader2,
    ArrowUpRight, ArrowDownRight, Calendar, Filter, Download
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const AccountingLedger = () => {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [tenantId, setTenantId] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [filter, setFilter] = useState({ type: 'all', dateFrom: '', dateTo: '' });

    const [newEntry, setNewEntry] = useState({
        type: 'income',
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = {
        income: ['Satış', 'Hizmet', 'Diğer Gelir'],
        expense: ['Hammadde', 'Personel', 'Kira', 'Faturalar', 'Pazarlama', 'Diğer Gider']
    };

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        if (tenantId) loadEntries();
    }, [tenantId, filter]);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setTenantId(user.id);
        setLoading(false);
    };

    const loadEntries = async () => {
        try {
            let query = supabase
                .from('accounting_entries')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('entry_date', { ascending: false });

            if (filter.type !== 'all') {
                query = query.eq('entry_type', filter.type);
            }
            if (filter.dateFrom) {
                query = query.gte('entry_date', filter.dateFrom);
            }
            if (filter.dateTo) {
                query = query.lte('entry_date', filter.dateTo);
            }

            const { data, error } = await query.limit(100);
            if (error) throw error;

            setEntries(data || []);

            // Calculate summary
            const income = (data || []).filter(e => e.entry_type === 'income').reduce((sum, e) => sum + parseFloat(e.amount), 0);
            const expense = (data || []).filter(e => e.entry_type === 'expense').reduce((sum, e) => sum + parseFloat(e.amount), 0);
            setSummary({ income, expense, balance: income - expense });
        } catch (error) {
            console.error('Error loading entries:', error);
        }
    };

    const handleAddEntry = async () => {
        if (!newEntry.amount || !newEntry.category) {
            toast.error('Tutar ve kategori zorunludur');
            return;
        }

        try {
            const { error } = await supabase.from('accounting_entries').insert({
                tenant_id: tenantId,
                entry_type: newEntry.type,
                category: newEntry.category,
                description: newEntry.description,
                amount: parseFloat(newEntry.amount),
                entry_date: newEntry.date
            });

            if (error) throw error;

            toast.success('Kayıt eklendi');
            setShowAddModal(false);
            setNewEntry({
                type: 'income',
                category: '',
                description: '',
                amount: '',
                date: new Date().toISOString().split('T')[0]
            });
            loadEntries();
        } catch (error) {
            toast.error('Kayıt eklenemedi');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                        <span className="text-green-700 font-medium">Gelirler</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800">{summary.income.toLocaleString('tr-TR')} ₺</p>
                </div>
                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                        <span className="text-red-700 font-medium">Giderler</span>
                    </div>
                    <p className="text-2xl font-bold text-red-800">{summary.expense.toLocaleString('tr-TR')} ₺</p>
                </div>
                <div className={`rounded-xl p-5 border ${summary.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className={`w-5 h-5 ${summary.balance >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
                        <span className={`font-medium ${summary.balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>Bakiye</span>
                    </div>
                    <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>
                        {summary.balance.toLocaleString('tr-TR')} ₺
                    </p>
                </div>
            </div>

            {/* Actions & Filters */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <select
                        value={filter.type}
                        onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                    >
                        <option value="all">Tümü</option>
                        <option value="income">Gelirler</option>
                        <option value="expense">Giderler</option>
                    </select>
                    <input
                        type="date"
                        value={filter.dateFrom}
                        onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                    />
                    <span className="text-slate-400">-</span>
                    <input
                        type="date"
                        value={filter.dateTo}
                        onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                    />
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Kayıt
                </button>
            </div>

            {/* Entries Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 text-sm text-slate-600">
                        <tr>
                            <th className="px-4 py-3 text-left">Tarih</th>
                            <th className="px-4 py-3 text-left">Tür</th>
                            <th className="px-4 py-3 text-left">Kategori</th>
                            <th className="px-4 py-3 text-left">Açıklama</th>
                            <th className="px-4 py-3 text-right">Tutar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                    Henüz kayıt yok
                                </td>
                            </tr>
                        ) : (
                            entries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm">
                                        {new Date(entry.entry_date).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${entry.entry_type === 'income'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {entry.entry_type === 'income' ? (
                                                <><ArrowUpRight className="w-3 h-3" /> Gelir</>
                                            ) : (
                                                <><ArrowDownRight className="w-3 h-3" /> Gider</>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{entry.category}</td>
                                    <td className="px-4 py-3 text-sm text-slate-500">{entry.description || '-'}</td>
                                    <td className={`px-4 py-3 text-right font-medium ${entry.entry_type === 'income' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {entry.entry_type === 'income' ? '+' : '-'}
                                        {parseFloat(entry.amount).toLocaleString('tr-TR')} ₺
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Entry Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Yeni Kayıt Ekle</h3>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setNewEntry({ ...newEntry, type: 'income', category: '' })}
                                    className={`flex-1 py-3 rounded-lg font-medium ${newEntry.type === 'income'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                >
                                    Gelir
                                </button>
                                <button
                                    onClick={() => setNewEntry({ ...newEntry, type: 'expense', category: '' })}
                                    className={`flex-1 py-3 rounded-lg font-medium ${newEntry.type === 'expense'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                >
                                    Gider
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Kategori</label>
                                <select
                                    value={newEntry.category}
                                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="">Seçiniz</option>
                                    {categories[newEntry.type].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Tutar (₺)</label>
                                <input
                                    type="number"
                                    value={newEntry.amount}
                                    onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Tarih</label>
                                <input
                                    type="date"
                                    value={newEntry.date}
                                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Açıklama</label>
                                <input
                                    type="text"
                                    value={newEntry.description}
                                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="İsteğe bağlı"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleAddEntry}
                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountingLedger;
