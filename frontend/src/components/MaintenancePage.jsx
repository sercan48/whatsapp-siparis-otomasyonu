import React from 'react';
import { Settings, Clock, Phone } from 'lucide-react';

export const MaintenancePage = () => {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
            <div className="animate-spin-slow mb-8">
                <Settings className="w-24 h-24 text-amber-500" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Sistem Bakım Modunda
            </h1>

            <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-8">
                Sizlere daha iyi hizmet verebilmek için kısa bir bakım çalışması yapıyoruz.
                Lütfen daha sonra tekrar deneyiniz.
            </p>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 max-w-md w-full">
                <div className="flex items-center justify-center gap-3 text-emerald-400 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Tahmini Bitiş: 1 Saat</span>
                </div>
                <p className="text-gray-500 text-sm">
                    Acil durumlar için WhatsApp hattımızdan bize ulaşabilirsiniz.
                </p>
            </div>
        </div>
    );
};
