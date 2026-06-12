import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, List, User, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

import { UnifiedCourierDashboard } from './UnifiedCourierDashboard';
import { CourierMapOperations } from './CourierMapOperations';
import { CourierProfile } from './CourierProfile';

export const CourierLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const navItems = [
        { path: '/courier/dashboard', icon: List, label: 'Siparişler' },
        { path: '/courier/map', icon: MapPin, label: 'Harita' },
        { path: '/courier/profile', icon: User, label: 'Profil' },
    ];

    return (
        <div className="flex flex-col h-screen bg-slate-100">
            {/* Mobile Header */}
            <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10">
                <div className="font-bold text-lg tracking-wide">Kurye<span className="text-indigo-400">App</span></div>
                <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
                    <LogOut className="w-4 h-4" />
                </button>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-20">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                {navItems.map(item => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-full ${isActive ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-current' : ''}`} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};
