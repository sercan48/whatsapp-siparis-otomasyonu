import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogOut, LayoutGrid, Coffee, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModernTouchPOS } from './ModernTouchPOS';

export const WaiterView = () => {
    const navigate = useNavigate();
    // const [loading, setLoading] = useState(true); // Unused for now

    // This component acts as a wrapper around ModernTouchPOS
    // but with specific props to restrict feature access.

    return (
        <div className="relative h-screen bg-gray-100 overflow-hidden flex flex-col">
            {/* Minimal Header for Waiter */}
            <div className="bg-white h-14 border-b px-4 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 font-bold">
                        W
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-800 text-sm">Garson Paneli</h1>
                        <p className="text-xs text-gray-500">Sipariş Modu</p>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        await supabase.auth.signOut();
                        navigate('/');
                    }}
                    className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                >
                    <LogOut className="w-4 h-4" /> Çıkış
                </button>
            </div>

            {/* 
               We reuse the robust POS logic but pass `role="waiter"` prop.
               ModernTouchPOS needs to be updated to handle this prop and conditional rendering.
             */}
            <div className="flex-1 overflow-hidden">
                <ModernTouchPOS role="waiter" />
            </div>
        </div>
    );
};
