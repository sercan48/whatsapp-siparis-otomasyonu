import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Building2, Store, ArrowRight, Lock, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';

export const RegisterPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        restaurantName: '',
        phone: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Sign Up User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. Create Tenant Record (Auto-created via trigger usually, but we can do it manually if needed)
                // For now, we rely on the backend logic or just let them login.
                // NOTE: If you have a trigger that creates a tenant on new user, great.
                // If not, we might need to insert into 'tenants' table.

                // Let's create the tenant manually to be safe if no trigger exists.
                const { error: tenantError } = await supabase.from('tenants').insert({
                    id: authData.user.id, // Linked 1:1 for simplicity in this V2 model
                    name: formData.restaurantName,
                    slug: formData.restaurantName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, ''),
                    created_at: new Date()
                });

                if (tenantError) {
                    console.warn('Tenant creation warning (might already exist):', tenantError);
                }

                toast.success('Kayıt başarılı! Giriş yapabilirsiniz.');
                navigate('/login');
            }
        } catch (error) {
            console.error('Registration Error:', error);
            toast.error('Kayıt başarısız: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[128px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[128px]"></div>
            </div>

            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10">
                <div className="p-8 text-center border-b border-white/5">
                    <h2 className="text-2xl font-bold text-white mb-2">Restoran Kaydı 🚀</h2>
                    <p className="text-slate-400 text-sm">Hemen başlayın, işletmenizi dijitalleştirin.</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleRegister} className="space-y-4">

                        {/* Restaurant Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">Restoran Adı</label>
                            <div className="relative">
                                <Store className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    name="restaurantName"
                                    required
                                    value={formData.restaurantName}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    placeholder="Örn: Lezzet Durağı"
                                />
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">Ad Soyad</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    name="fullName"
                                    required
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    placeholder="Adınız Soyadınız"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">E-Posta</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    placeholder="mail@ornek.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">Şifre</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={6}
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    placeholder="En az 6 karakter"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all transform active:scale-95 flex items-center justify-center mt-6"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Kayıt Ol ve Başla
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="p-4 bg-black/20 text-center text-xs text-slate-500 border-t border-white/5">
                    Zaten hesabınız var mı? <Link to="/login" className="text-blue-400 cursor-pointer hover:underline">Giriş Yap</Link>
                </div>
            </div>
        </div>
    );
};
