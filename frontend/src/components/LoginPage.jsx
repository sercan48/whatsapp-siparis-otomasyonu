import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Store, ArrowRight, Lock, Mail, Bike } from 'lucide-react';
import toast from 'react-hot-toast';

import { supabase } from '../lib/supabaseClient';

export const LoginPage = () => {
    const navigate = useNavigate();
    const [role, setRole] = useState('restaurant'); // 'reseller', 'restaurant'
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Special handling for reseller login (custom auth, not Supabase Auth)
            if (role === 'reseller') {
                const { data, error } = await supabase
                    .rpc('verify_reseller_login', {
                        p_email: email,
                        p_password: password
                    });

                if (error) throw error;

                if (data && data.length > 0) {
                    const reseller = data[0];
                    // Save reseller session to localStorage (custom session)
                    localStorage.setItem('reseller_session', JSON.stringify(reseller));
                    toast.success(`Hoş geldin, ${reseller.name}!`);
                    navigate('/reseller/dashboard');
                } else {
                    throw new Error('Hatalı email veya şifre');
                }
            } else {
                // Standard Supabase Auth for restaurant and courier
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');

                if (role === 'courier') {
                    navigate('/courier');
                } else {
                    navigate('/restore');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            toast.error('Giriş başarısız: ' + error.message);
        } finally {
            setLoading(false);
        }
    };


    // Google OAuth Login
    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}${role === 'reseller' ? '/partner' : '/restore'}`,
                }
            });

            if (error) throw error;
            // Redirect happens automatically
        } catch (error) {
            console.error('Google login error:', error);
            toast.error('Google girişi başarısız: ' + error.message);
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[128px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[128px]"></div>
            </div>

            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10">
                {/* Header */}
                <div className="p-8 text-center border-b border-white/5">
                    <h2 className="text-2xl font-bold text-white mb-2">Sisteme Giriş</h2>
                    <p className="text-slate-400 text-sm">Devam etmek için hesap türünüzü seçin</p>
                </div>

                <div className="grid grid-cols-3 p-2 bg-black/20 gap-2">
                    {[
                        { id: 'restaurant', label: 'Restoran', icon: Store },
                        { id: 'courier', label: 'Kurye', icon: Bike },
                        { id: 'reseller', label: 'Bayi', icon: Building2 }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setRole(tab.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${role === tab.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon className={`w-5 h-5 mb-1 ${role === tab.id ? 'text-white' : ''}`} />
                            <span className="text-xs font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Login Form */}
                <div className="p-8">
                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 py-3 rounded-xl font-medium shadow-lg transition-all mb-6"
                    >
                        {googleLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Google ile Giriş Yap
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 h-px bg-slate-700"></div>
                        <span className="text-xs text-slate-500">veya e-posta ile</span>
                        <div className="flex-1 h-px bg-slate-700"></div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">E-Posta Adresi</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    placeholder="info@isletme.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">Şifre</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                            <label className="flex items-center cursor-pointer hover:text-slate-300">
                                <input type="checkbox" className="mr-2 rounded bg-slate-800 border-slate-600" />
                                Beni Hatırla
                            </label>
                            <a href="#" className="hover:text-blue-400 transition-colors">Şifremi Unuttum</a>
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
                                    {role === 'reseller' && 'Bayi Girişi Yap'}
                                    {role === 'restaurant' && 'Restoranı Aç'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/20 text-center text-xs text-slate-500 border-t border-white/5">
                    Hesabınız yok mu? <Link to="/register" className="text-blue-400 cursor-pointer hover:underline">Hemen Başvurun</Link>
                </div>
            </div>
        </div>
    );
};

