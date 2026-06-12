import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Phone, Mail, Bike, Car, Lock, Save, TrendingUp, Package, Clock, Star, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const CourierProfile = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState({
        totalDeliveries: 0,
        todayDeliveries: 0,
        totalEarnings: 0,
        averageRating: 0
    });
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        vehicle_type: 'moto',
        plate_number: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchStats();
    }, [fetchProfile, fetchStats]);

    const fetchProfile = React.useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/courier');
                return;
            }

            // Get courier details
            const { data, error } = await supabase
                .from('courier_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setFormData({
                    name: data.name || '',
                    phone: data.phone || '',
                    email: user.email || '',
                    vehicle_type: data.vehicle_type || 'moto',
                    plate_number: data.plate_number || ''
                });
            }
        } catch (error) {
            console.error('Profile fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    const fetchStats = React.useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Total deliveries
            const { count: totalDeliveries } = await supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('assigned_courier_id', user.id)
                .eq('status', 'delivered');

            // Today's deliveries
            const today = new Date().toISOString().split('T')[0];
            const { count: todayDeliveries } = await supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('assigned_courier_id', user.id)
                .eq('status', 'delivered')
                .gte('created_at', today);

            // Total earnings from courier_transactions
            const { data: earnings } = await supabase
                .from('courier_transactions')
                .select('amount')
                .eq('courier_id', user.id)
                .eq('transaction_type', 'delivery_fee');

            const totalEarnings = earnings?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

            setStats({
                totalDeliveries: totalDeliveries || 0,
                todayDeliveries: todayDeliveries || 0,
                totalEarnings: totalEarnings,
                averageRating: 4.8 // Placeholder
            });
        } catch (error) {
            console.error('Stats fetch error:', error);
        }
    }, []);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('courier_profiles')
                .update({
                    name: formData.name,
                    phone: formData.phone,
                    vehicle_type: formData.vehicle_type,
                    plate_number: formData.plate_number
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success('Profil güncellendi!');
        } catch (error) {
            toast.error('Güncelleme hatası: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Şifreler eşleşmiyor!');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error('Şifre en az 6 karakter olmalı!');
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) throw error;

            toast.success('Şifre değiştirildi!');
            setShowPasswordForm(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error('Şifre değişikliği hatası: ' + error.message);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gray-50 overflow-y-auto pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{formData.name || 'Kurye'}</h1>
                        <p className="text-blue-100 text-sm">{formData.phone}</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 p-4 -mt-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Package className="w-4 h-4" />
                        Toplam Teslimat
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalDeliveries}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Clock className="w-4 h-4" />
                        Bugün
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{stats.todayDeliveries}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <TrendingUp className="w-4 h-4" />
                        Toplam Kazanç
                    </div>
                    <p className="text-2xl font-bold text-green-600">₺{stats.totalEarnings.toFixed(0)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Star className="w-4 h-4" />
                        Puan
                    </div>
                    <p className="text-2xl font-bold text-yellow-600">{stats.averageRating}</p>
                </div>
            </div>

            {/* Profile Form */}
            <div className="p-4 space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        Profil Bilgileri
                    </h3>

                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Ad Soyad</label>
                        <input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ad Soyad"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Telefon</label>
                        <input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="0 5XX XXX XX XX"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">E-posta</label>
                        <input
                            value={formData.email}
                            disabled
                            className="w-full border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Araç Tipi</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'moto', label: 'Motosiklet', icon: Bike },
                                { id: 'car', label: 'Araba', icon: Car },
                                { id: 'bike', label: 'Bisiklet', icon: Bike },
                                { id: 'walker', label: 'Yaya / Elektrikli', icon: User },
                            ].map(v => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, vehicle_type: v.id })}
                                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${formData.vehicle_type === v.id
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-gray-600'
                                        }`}
                                >
                                    <v.icon className="w-5 h-5" />
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(formData.vehicle_type === 'moto' || formData.vehicle_type === 'car') && (
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Plaka Numarası</label>
                            <input
                                value={formData.plate_number}
                                onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                                className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                placeholder="34 ABC 123"
                            />
                        </div>
                    )}

                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Kaydet
                            </>
                        )}
                    </button>
                </div>

                {/* Password Change */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <button
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="w-full flex items-center justify-between text-gray-800 font-bold"
                    >
                        <span className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-blue-600" />
                            Şifre Değiştir
                        </span>
                        <span className="text-gray-400">{showPasswordForm ? '−' : '+'}</span>
                    </button>

                    {showPasswordForm && (
                        <div className="mt-4 space-y-3">
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Yeni Şifre"
                            />
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Yeni Şifre (Tekrar)"
                            />
                            <button
                                onClick={handleChangePassword}
                                className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold"
                            >
                                Şifreyi Güncelle
                            </button>
                        </div>
                    )}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-4 text-red-600 font-bold"
                >
                    <LogOut className="w-5 h-5" />
                    Çıkış Yap
                </button>
            </div>
        </div>
    );
};
