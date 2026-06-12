import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Power, LogOut, User, Store, Menu } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { IncomingCallPopup } from './IncomingCallPopup';
import { useNavigate } from 'react-router-dom';


export const RestaurantLayout = () => {
    const [isOpen, setIsOpen] = useState(true); // Shop Open/Close toggle (Mock)
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [tenantId, setTenantId] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Determine if we are on the dashboard (Grid)
    const isDashboard = location.pathname === '/restore';

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
            } else {
                setTenantId(session.user.id);
            }
        };
        checkAuth();
    }, [navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
            {/* ... (existing header code) ... */}
            <header className="bg-slate-900 text-white h-16 shadow-lg flex justify-between items-center px-4 md:px-8 z-50 sticky top-0">
                {/* Header content unchanged for brevity in this tool call, 
                    but I will maintain the full structure in the actual replacement */}
                <div className="flex items-center space-x-6">
                    <Link to="/restore" className="text-xl font-bold tracking-tight text-blue-400 flex items-center hover:opacity-80 transition-opacity">
                        <Store className="w-6 h-6 mr-2" />
                        <span className="hidden sm:inline">RestoPanel OS</span>
                        <span className="sm:hidden">OS</span>
                    </Link>

                    {!isDashboard && (
                        <div className="hidden md:flex items-center text-sm text-gray-400 border-l border-gray-700 pl-6">
                            <Link to="/restore" className="hover:text-white flex items-center mr-2">
                                <Home className="w-4 h-4 mr-1" /> Ana Ekran
                            </Link>
                            <span className="mr-2">/</span>
                            <span className="text-white capitalize">{location.pathname.split('/').pop()}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-4 md:space-x-8">
                    <div
                        className={`flex items-center cursor-pointer px-3 py-1.5 rounded-full border border-transparent transition-all ${isOpen ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <div className={`w-3 h-3 rounded-full mr-2 ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className={`text-sm font-bold ${isOpen ? 'text-green-400' : 'text-red-400'}`}>
                            {isOpen ? 'AÇIK' : 'KAPALI'}
                        </span>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800">
                                R
                            </div>
                            <span className="hidden sm:block text-sm font-medium">Restoran</span>
                        </button>

                        {userMenuOpen && (
                            <div className="absolute right-0 top-12 w-48 bg-white text-gray-800 rounded-xl shadow-2xl py-2 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-4 py-2 border-b border-gray-100 mb-2">
                                    <p className="text-sm font-bold">Muğla Şube</p>
                                    <p className="text-xs text-gray-500">Premium Plan</p>
                                </div>
                                <Link to="/restore/settings" className="block px-4 py-2 text-sm hover:bg-gray-50 flex items-center" onClick={() => setUserMenuOpen(false)}>
                                    <User className="w-4 h-4 mr-2" /> Profil
                                </Link>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                                    <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Wallpaper/Content Area */}
            <main className="flex-1 relative overflow-y-auto w-full max-w-[1920px] mx-auto">
                <Outlet context={{ tenantId }} />
            </main>

            {/* Incoming Call Popup - Shows on all pages */}
            <IncomingCallPopup
                onStartOrder={(data) => {
                    // Navigate to POS with customer data
                    navigate('/restore/pos', { state: data });
                }}
            />
        </div>
    );
};

