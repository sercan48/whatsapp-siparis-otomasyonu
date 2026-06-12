import { MapPin } from 'lucide-react';

export const CourierMapOperations = () => {
    // Placeholder for Google Maps implementation
    // In a real scenario, this would import @react-google-maps/api

    return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500">
            <MapPin className="w-16 h-16 mb-4 text-indigo-300" />
            <h2 className="text-xl font-bold text-slate-700">Harita Modu</h2>
            <p className="max-w-xs text-center mt-2">
                Bu özellik Google Maps API anahtarı yapılandırıldığında aktif olacaktır.
            </p>
            <p className="text-sm mt-4 bg-white p-4 rounded-lg shadow-sm">
                Şu an için "Siparişler" sekmesindeki "Harita" butonunu kullanarak
                cihazınızın harita uygulamasını (Google Maps/Apple Maps) açabilirsiniz.
            </p>
        </div>
    );
};
