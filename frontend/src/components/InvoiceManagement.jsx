import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    FileText, Plus, Download, Send, X, Search, Filter,
    CheckCircle, Clock, AlertTriangle, XCircle, RefreshCw, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getInvoices, createDraftInvoice, submitInvoiceToProvider,
    cancelInvoice, downloadInvoicePDF, getTenantLegalInfo
} from '../lib/eInvoiceService';

export const InvoiceManagement = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const [formData, setFormData] = useState({
        customerName: '',
        customerTaxId: '',
        items: [{ name: '', quantity: 1, price: 0 }],
        taxRate: 10
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [invoicesData, legalInfo] = await Promise.all([
                getInvoices(user.id),
                getTenantLegalInfo(user.id)
            ]);

            setInvoices(invoicesData);
            setCompanyInfo(legalInfo);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Veriler yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvoice = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const invoice = await createDraftInvoice(user.id, {
                customerName: formData.customerName || 'Perakende Satış',
                customerTaxId: formData.customerTaxId,
                items: formData.items.filter(i => i.name && i.price > 0),
                taxRate: formData.taxRate
            });

            toast.success('Fatura taslağı oluşturuldu');
            setShowCreateModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            toast.error('Fatura oluşturulamadı: ' + error.message);
        }
    };

    const handleSubmitInvoice = async (invoiceId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const result = await submitInvoiceToProvider(user.id, invoiceId);

            if (result.success) {
                toast.success(`Fatura gönderildi (${result.mode})`);
                fetchData();
            } else {
                toast.error('Gönderim hatası: ' + result.error);
            }
        } catch (error) {
            toast.error('Gönderim hatası');
        }
    };

    const handleCancelInvoice = async (invoiceId) => {
        if (!window.confirm('Faturayı iptal etmek istediğinize emin misiniz?')) return;

        try {
            await cancelInvoice(invoiceId);
            toast.success('Fatura iptal edildi');
            fetchData();
        } catch (error) {
            toast.error('İptal hatası');
        }
    };

    const handleDownloadPDF = (invoice) => {
        // For simplicity, use single item
        const items = [{
            name: 'Satış',
            quantity: 1,
            price: invoice.total_amount - invoice.tax_amount
        }];
        downloadInvoicePDF(invoice, companyInfo, items);
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { name: '', quantity: 1, price: 0 }]
        });
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index)
        });
    };

    const resetForm = () => {
        setFormData({
            customerName: '',
            customerTaxId: '',
            items: [{ name: '', quantity: 1, price: 0 }],
            taxRate: 10
        });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'signed': return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'draft': return <Clock className="w-4 h-4 text-yellow-600" />;
            case 'queue': return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
            case 'failed': return <AlertTriangle className="w-4 h-4 text-red-600" />;
            case 'cancelled': return <XCircle className="w-4 h-4 text-gray-600" />;
            default: return <Clock className="w-4 h-4 text-gray-600" />;
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            signed: 'bg-green-100 text-green-700',
            draft: 'bg-yellow-100 text-yellow-700',
            queue: 'bg-blue-100 text-blue-700',
            failed: 'bg-red-100 text-red-700',
            cancelled: 'bg-gray-100 text-gray-700'
        };
        const labels = {
            signed: 'Onaylı',
            draft: 'Taslak',
            queue: 'Kuyrukta',
            failed: 'Hatalı',
            cancelled: 'İptal'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${styles[status] || styles.draft}`}>
                {getStatusIcon(status)}
                {labels[status] || status}
            </span>
        );
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.gib_invoice_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-gray-400">Yükleniyor...</div></div>;
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">E-Fatura Yönetimi</h1>
                    <p className="text-gray-500">E-Fatura ve E-Arşiv faturalarınızı yönetin</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center shadow-lg"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Yeni Fatura
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Toplam Fatura', value: invoices.length, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Onaylı', value: invoices.filter(i => i.status === 'signed').length, color: 'bg-green-50 text-green-600' },
                    { label: 'Taslak', value: invoices.filter(i => i.status === 'draft').length, color: 'bg-yellow-50 text-yellow-600' },
                    { label: 'Toplam Tutar', value: `₺${totalAmount.toLocaleString('tr-TR')}`, color: 'bg-purple-50 text-purple-600' },
                ].map((stat, i) => (
                    <div key={i} className={`${stat.color} rounded-xl p-4 text-center`}>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-sm opacity-80">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Fatura no veya müşteri ara..."
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg bg-white"
                >
                    <option value="all">Tüm Durumlar</option>
                    <option value="draft">Taslak</option>
                    <option value="signed">Onaylı</option>
                    <option value="failed">Hatalı</option>
                    <option value="cancelled">İptal</option>
                </select>
            </div>

            {/* Invoice List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4 font-bold text-gray-600 text-sm">Fatura No</th>
                            <th className="text-left p-4 font-bold text-gray-600 text-sm">Müşteri</th>
                            <th className="text-left p-4 font-bold text-gray-600 text-sm">Tür</th>
                            <th className="text-right p-4 font-bold text-gray-600 text-sm">Tutar</th>
                            <th className="text-center p-4 font-bold text-gray-600 text-sm">Durum</th>
                            <th className="text-center p-4 font-bold text-gray-600 text-sm">Tarih</th>
                            <th className="text-center p-4 font-bold text-gray-600 text-sm">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-gray-500">
                                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    Fatura bulunamadı
                                </td>
                            </tr>
                        ) : (
                            filteredInvoices.map(invoice => (
                                <tr key={invoice.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-mono font-medium text-gray-800">{invoice.gib_invoice_no}</div>
                                        {invoice.ettn && <div className="text-xs text-gray-400">ETTN: {invoice.ettn.slice(0, 8)}...</div>}
                                    </td>
                                    <td className="p-4 text-gray-600">{invoice.customer_name}</td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded ${invoice.scenario === 'EFATURA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {invoice.scenario}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-bold text-gray-800">
                                        ₺{parseFloat(invoice.total_amount).toLocaleString('tr-TR')}
                                    </td>
                                    <td className="p-4 text-center">
                                        {getStatusBadge(invoice.status)}
                                    </td>
                                    <td className="p-4 text-center text-gray-500 text-sm">
                                        {new Date(invoice.issued_at).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button
                                                onClick={() => handleDownloadPDF(invoice)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="PDF İndir"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            {invoice.status === 'draft' && (
                                                <>
                                                    <button
                                                        onClick={() => handleSubmitInvoice(invoice.id)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                        title="Gönder"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelInvoice(invoice.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="İptal"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-800">Yeni Fatura Oluştur</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Customer Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı</label>
                                    <input
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Perakende Satış (boş bırakılabilir)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">VKN/TCKN</label>
                                    <input
                                        value={formData.customerTaxId}
                                        onChange={(e) => setFormData({ ...formData, customerTaxId: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Opsiyonel"
                                    />
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Ürünler/Hizmetler</label>
                                <div className="space-y-2">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <input
                                                value={item.name}
                                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                                                placeholder="Ürün/Hizmet adı"
                                            />
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                                className="w-20 border border-gray-300 rounded-lg p-2 text-sm text-center"
                                                min="1"
                                            />
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                                                className="w-28 border border-gray-300 rounded-lg p-2 text-sm text-right"
                                                placeholder="Fiyat"
                                                step="0.01"
                                            />
                                            {formData.items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addItem}
                                    className="mt-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                                >
                                    + Ürün Ekle
                                </button>
                            </div>

                            {/* Tax Rate */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">KDV Oranı (%)</label>
                                <select
                                    value={formData.taxRate}
                                    onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value) })}
                                    className="w-40 border border-gray-300 rounded-lg p-2.5 bg-white"
                                >
                                    <option value={1}>%1</option>
                                    <option value={10}>%10</option>
                                    <option value={20}>%20</option>
                                </select>
                            </div>

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-600">Ara Toplam:</span>
                                    <span className="font-medium">
                                        ₺{formData.items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-600">KDV (%{formData.taxRate}):</span>
                                    <span className="font-medium">
                                        ₺{(formData.items.reduce((sum, i) => sum + (i.price * i.quantity), 0) * formData.taxRate / 100).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-200">
                                    <span className="font-bold text-gray-800">Genel Toplam:</span>
                                    <span className="font-bold text-blue-600 text-lg">
                                        ₺{(formData.items.reduce((sum, i) => sum + (i.price * i.quantity), 0) * (1 + formData.taxRate / 100)).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleCreateInvoice}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                            >
                                Fatura Taslağı Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
