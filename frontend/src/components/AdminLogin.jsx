import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

export const AdminLogin = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [blocked, setBlocked] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();

        // Rate limiting - block after 5 failed attempts
        if (blocked) {
            toast.error('Çok fazla deneme. 5 dakika bekleyin.');
            return;
        }

        setLoading(true);

        try {
            // 0. Server-side rate limiting check (additional layer)
            const { data: canProceed, error: rateLimitError } = await supabase
                .rpc('check_login_rate_limit', {
                    p_identifier: email,
                    p_max_attempts: 5,
                    p_block_minutes: 5
                });

            if (rateLimitError) {
                console.warn('Rate limit check failed, proceeding with client-side check');
            } else if (!canProceed) {
                setBlocked(true);
                toast.error('Çok fazla deneme. Lütfen 5 dakika bekleyin.');
                return;
            }

            // 1. Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                throw new Error('Geçersiz kimlik bilgileri');
            }


            // 2. Check if user is in super_admins whitelist
            const { data: adminCheck, error: adminError } = await supabase
                .from('super_admins')
                .select('id, role')
                .eq('email', email)
                .eq('is_active', true)
                .single();

            if (adminError || !adminCheck) {
                // Log unauthorized attempt
                await supabase.from('admin_login_audit').insert({
                    email,
                    ip_address: 'client',
                    success: false,
                    reason: 'Not in super_admins whitelist'
                });

                await supabase.auth.signOut();
                throw new Error('Yönetici yetkisi bulunamadı');
            }

            // 3. Log successful login
            await supabase.from('admin_login_audit').insert({
                email,
                admin_id: adminCheck.id,
                success: true,
                reason: 'Successful login'
            });

            toast.success('Yönetici girişi başarılı');
            navigate('/admin');

        } catch (error) {
            console.error('Admin login error:', error);

            // Increment failed attempts
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);

            if (newAttempts >= 5) {
                setBlocked(true);
                toast.error('Hesap geçici olarak kilitlendi. 5 dakika bekleyin.');
                setTimeout(() => {
                    setBlocked(false);
                    setAttempts(0);
                }, 5 * 60 * 1000); // 5 minutes
            } else {
                toast.error(error.message || 'Giriş başarısız');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[128px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[128px]"></div>
            </div>

            <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10">
                <div className="p-8 text-center border-b border-white/5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 mb-4 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/10">
                        <Shield className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Yönetici Erişimi</h2>
                    <p className="text-slate-400 text-xs mt-1">Sadece yetkili personel içindir.</p>
                </div>

                {blocked && (
                    <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Hesap geçici olarak kilitlendi</span>
                    </div>
                )}

                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">E-Posta Adresi</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={blocked}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm disabled:opacity-50"
                                    placeholder="admin@sistem.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-300 ml-1">Şifre</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={blocked}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {attempts > 0 && !blocked && (
                            <p className="text-xs text-orange-400 text-center">
                                Uyarı: {5 - attempts} deneme hakkınız kaldı
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || blocked}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all transform active:scale-95 flex items-center justify-center mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Sisteme Gir
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
                <div className="p-4 bg-black/20 text-center text-[10px] text-slate-500 border-t border-white/5">
                    <span className="font-mono">SECURE_LEVEL_3 // {new Date().getFullYear()}</span>
                </div>
            </div>
        </div>
    );
};
