import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react';

/**
 * AuthGuard - Route Protection Component
 * 
 * Korumalı route'lar için kimlik doğrulama ve yetkilendirme kontrolü sağlar.
 * 
 * @param {string} role - Gerekli rol: 'admin', 'tenant', 'courier', 'reseller', veya 'any'
 * @param {React.ReactNode} children - Korunan içerik
 * @param {string} redirectTo - Yetkisiz erişimde yönlendirilecek sayfa
 */
export const AuthGuard = ({
    role = 'any',
    children,
    redirectTo = '/login'
}) => {
    const [authState, setAuthState] = useState({
        isLoading: true,
        isAuthenticated: false,
        isAuthorized: false,
        user: null,
        error: null
    });

    const location = useLocation();

    const checkAuth = useCallback(async () => {
        try {
            // 1. Check if user is logged in
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                setAuthState({
                    isLoading: false,
                    isAuthenticated: false,
                    isAuthorized: false,
                    user: null,
                    error: 'Oturum bulunamadı'
                });
                return;
            }

            const user = session.user;
            let isAuthorized = false;

            // 2. Role-based authorization check
            switch (role) {
                case 'admin': {
                    // Check super_admins whitelist
                    const { data: adminCheck, error: adminError } = await supabase
                        .from('super_admins')
                        .select('id, role, is_active')
                        .eq('email', user.email)
                        .eq('is_active', true)
                        .single();

                    isAuthorized = !adminError && adminCheck;
                    break;
                }

                case 'tenant': {
                    // Strict Tenant Check
                    // User must have a profile linked to this tenant
                    const { data: tenantProfile, error: tenantError } = await supabase
                        .from('profiles')
                        .select('id, role, tenant_id')
                        .eq('id', user.id)
                        .single();

                    // Also check if user is the tenant owner in tenants table
                    const { data: tenantOwner, error: ownerError } = await supabase
                        .from('tenants')
                        .select('id')
                        .eq('id', user.id)
                        .single();

                    isAuthorized = (!tenantError && tenantProfile) || (!ownerError && tenantOwner);
                    break;
                }

                case 'courier': {
                    // 1. Check if user is a courier
                    const { data: courierCheck, error: courierError } = await supabase
                        .from('courier_profiles')
                        .select('id, is_active')
                        .eq('id', user.id)
                        .eq('is_active', true)
                        .single();

                    if (!courierError && courierCheck) {
                        isAuthorized = true;
                    } else {
                        // 2. Fallback: Check multi-tenant links (if profile exists but maybe inactive in main table?)
                        // Or simply check if they are in the link table
                        const { data: linkCheck } = await supabase
                            .from('courier_store_links')
                            .select('id')
                            .eq('courier_id', user.id)
                            .eq('is_active', true)
                            .limit(1);

                        if (linkCheck && linkCheck.length > 0) {
                            isAuthorized = true;
                        }
                    }
                    break;
                }

                case 'reseller': {
                    // Check if user is a reseller
                    const { data: resellerCheck, error: resellerError } = await supabase
                        .from('resellers')
                        .select('id, is_active')
                        .eq('user_id', user.id)
                        .eq('is_active', true)
                        .single();

                    isAuthorized = !resellerError && resellerCheck;
                    break;
                }

                case 'any':
                default:
                    // Any authenticated user is authorized
                    isAuthorized = true;
                    break;
            }

            setAuthState({
                isLoading: false,
                isAuthenticated: true,
                isAuthorized,
                user,
                error: isAuthorized ? null : 'Yetkisiz erişim'
            });

        } catch (error) {
            console.error('Auth check error:', error);
            setAuthState({
                isLoading: false,
                isAuthenticated: false,
                isAuthorized: false,
                user: null,
                error: 'Kimlik doğrulama hatası'
            });
        }
    }, [role]);

    useEffect(() => {
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Loading state
    if (authState.isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-400">Kimlik doğrulanıyor...</p>
                </div>
            </div>
        );
    }

    // Not authenticated - redirect to login
    if (!authState.isAuthenticated) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Authenticated but not authorized for this role
    if (!authState.isAuthorized) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Yetkisiz Erişim</h2>
                    <p className="text-slate-400 mb-6">
                        Bu sayfaya erişim yetkiniz bulunmamaktadır.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.history.back()}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Geri Dön
                        </button>
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }}
                            className="w-full px-4 py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            Farklı Hesapla Giriş Yap
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Authorized - render children
    return children;
};

export default AuthGuard;
