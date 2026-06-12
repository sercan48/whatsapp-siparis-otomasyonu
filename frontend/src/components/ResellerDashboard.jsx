import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
    Building2, Plus, Users, LogOut, Settings,
    Store, ExternalLink, Loader2, X, Clock, CheckCircle, AlertCircle, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BrandingSettings } from './BrandingSettings';

export const ResellerDashboard = () => {
    const navigate = useNavigate();
    const [reseller, setReseller] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null); // For Management Mode

    // Form state
    const [formData, setFormData] = useState({
        business_name: '',
        business_phone: '',
        business_email: '',
        business_address: '',
        owner_name: '',
        notes: ''
    });

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = () => {
        const session = localStorage.getItem('reseller_session');
        if (!session) {
            navigate('/reseller/login');
            return;
        }
        const user = JSON.parse(session);
        setReseller(user);
        fetchTenants(user.id);
        fetchPendingRequests(user.id);
    };

    const fetchTenants = async (resellerId) => {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('reseller_id', resellerId);

            if (error) throw error;
            setTenants(data || []);
        } catch (error) {
            console.error('Fetch tenants error:', error);
            toast.error('Restoranlar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingRequests = async (resellerId) => {
        try {
            const { data, error } = await supabase
                .from('tenant_requests')
                .select('*')
                .eq('reseller_id', resellerId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPendingRequests(data || []);
        } catch (error) {
            console.error('Fetch requests error:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('reseller_session');
        navigate('/reseller/login');
    };

    const openPasswordModal = () => {
        const newPass = prompt("Yeni şifrenizi girin:");
        if (newPass && newPass.length >= 6) {
            updatePassword(newPass);
        } else if (newPass) {
            toast.error("Şifre en az 6 karakter olmalı");
        }
    };

    const updatePassword = async (newPassword) => {
        try {
            const { error } = await supabase
                .from('resellers')
                .update({ password: newPassword })
                .eq('id', reseller.id);

            if (error) throw error;
            toast.success("Şifreniz güncellendi");
        } catch (error) {
            console.error('Password update error:', error);
            toast.error("Şifre güncellenemedi");
        }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();

        if (!formData.business_name || !formData.business_phone || !formData.owner_name) {
            toast.error('Lütfen zorunlu alanları doldurun');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('tenant_requests')
                .insert({
                    reseller_id: reseller.id,
                    ...formData,
                    status: 'pending'
                });

            if (error) throw error;

            toast.success('İşletme başvurunuz alındı! Onay bekleniyor.');
            setShowAddModal(false);
            setFormData({
                business_name: '',
                business_phone: '',
                business_email: '',
                business_address: '',
                owner_name: '',
                notes: ''
            });
            fetchPendingRequests(reseller.id);
        } catch (error) {
            console.error('Submit request error:', error);
            toast.error('Başvuru gönderilemedi: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Onay Bekliyor</span>;
            case 'approved':
                return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Onaylandı</span>;
            case 'rejected':
                return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Reddedildi</span>;
            default:
                return null;
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-800">Bayi Paneli</h1>
                            <p className="text-xs text-slate-500">{reseller?.name}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={openPasswordModal}
                            className="text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1"
                        >
                            <Settings className="w-4 h-4" />
                            Şifre Değiştir
                        </button>
                        <button
                            onClick={handleLogout}
                            className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                            <LogOut className="w-4 h-4" />
                            Çıkış
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">

                {selectedTenant ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <button
                            onClick={() => setSelectedTenant(null)}
                            className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            İşletmelere Dön
                        </button>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Pass isReseller=true to use the RPC for secure updates */}
                            <BrandingSettings tenantId={selectedTenant.id} isReseller={true} />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats / Overview */}
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                        <Store className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Toplam İşletme</p>
                                        <p className="text-2xl font-bold text-slate-800">{tenants.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-green-50 rounded-lg text-green-600">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Aktif Abonelik</p>
                                        <p className="text-2xl font-bold text-slate-800">{tenants.filter(t => t.subscription_status === 'active').length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Onay Bekleyen</p>
                                        <p className="text-2xl font-bold text-slate-800">{pendingRequests.filter(r => r.status === 'pending').length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pending Requests */}
                        {pendingRequests.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="font-bold text-lg text-slate-800">Başvurularım</h2>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {pendingRequests.map(req => (
                                        <div key={req.id} className="p-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-slate-800">{req.business_name}</p>
                                                <p className="text-sm text-slate-500">{req.owner_name} - {req.business_phone}</p>
                                            </div>
                                            {getStatusBadge(req.status)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tenants List */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                <h2 className="font-bold text-lg text-slate-800">İşletmelerim</h2>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Yeni İşletme Ekle
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-600 text-sm">
                                        <tr>
                                            <th className="p-4">İşletme Adı</th>
                                            <th className="p-4">Slug (Link)</th>
                                            <th className="p-4">Durum</th>
                                            <th className="p-4">Oluşturulma</th>
                                            <th className="p-4 text-right">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tenants.map(tenant => (
                                            <tr key={tenant.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-medium text-slate-800">{tenant.name}</td>
                                                <td className="p-4 text-slate-500">
                                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                                        /m/{tenant.slug || 'Yok'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.subscription_status === 'active'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {tenant.subscription_status === 'active' ? 'Aktif' : 'Pasif'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-500 text-sm">
                                                    {new Date(tenant.created_at).toLocaleDateString('tr-TR')}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedTenant(tenant)}
                                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-end gap-1 ml-auto"
                                                    >
                                                        Yönet
                                                        <Settings className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {tenants.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-8 text-center text-slate-500">
                                                    Henüz işletme eklememişsiniz.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* Add Business Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-800">Yeni İşletme Başvurusu</h2>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
                                <p className="text-sm text-slate-500 bg-blue-50 p-3 rounded-lg">
                                    ℹ️ Başvurunuz Super Admin tarafından incelenecek ve onaylandığında işletme aktif hale gelecektir.
                                </p>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">İşletme Adı *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.business_name}
                                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Örn: XLarge Burger"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">İşletme Sahibi Adı *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.owner_name}
                                        onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ad Soyad"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefon *</label>
                                        <input
                                            type="tel"
                                            required
                                            value={formData.business_phone}
                                            onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="05XX XXX XX XX"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={formData.business_email}
                                            onChange={(e) => setFormData({ ...formData, business_email: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="ornek@isletme.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                                    <textarea
                                        value={formData.business_address}
                                        onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={2}
                                        placeholder="İşletme adresi"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={2}
                                        placeholder="Eklemek istediğiniz notlar..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Başvuru Gönder
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ResellerDashboard;
