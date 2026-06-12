import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, MapPin, Truck, CheckCircle, XCircle, Battery } from 'lucide-react';
import toast from 'react-hot-toast';

export const CourierManager = () => {
    const [couriers, setCouriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [email, setEmail] = useState('');

    useEffect(() => {
        fetchCouriers();

        // Real-time updates for courier status/location
        const subscription = supabase
            .channel('courier_manager_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_profiles' },
                () => fetchCouriers()
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchCouriers = async () => {
        setLoading(true);
        try {
            // Fetch profiles joined with auth metadata if possible, 
            // but Supabase JS client doesn't join auth.users easily.
            // We will rely on what we have or fetch public profiles if we have them.
            // Assuming 'courier_profiles' has the data we need or we join with 'profiles'.

            const { data, error } = await supabase
                .from('courier_profiles')
                .select(`
                    *,
                    profile:profiles(full_name, phone)
                `); // Assuming profiles table exists and has foreign key relationship (or implicit join)

            // Note: If foreign key isn't set up in SQL explicitly for 'profiles' table (it is usually 'id' -> 'auth.users'), 
            // we might need to fetch profiles separately. 
            // Let's assume standard join works if I added the FK. If not, I'll patch it.
            // In migration_courier_system.sql: id REFERENCES auth.users(id).
            // In migration_roles.sql: profiles.id REFERENCES auth.users(id).
            // So they share the same ID.

            if (error) {
                console.error("Error fetching couriers:", error);
                // Fallback: fetch courier_profiles only
                const { data: rawCouriers } = await supabase.from('courier_profiles').select('*');
                // metrics?
                setCouriers(rawCouriers || []);
            } else {
                setCouriers(data || []);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleInviteCourier = async (e) => {
        e.preventDefault();
        try {
            // Assuming tenant_id is available from context or user profile
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase.rpc('add_staff_or_courier', {
                p_email: email,
                p_role: 'courier',
                p_tenant_id: user.id // In single-tenant model, user.id is largely treated as tenant_id
            });

            if (error) throw error;

            toast.success(data.message || 'Kurye eklendi.');
            setShowInviteModal(false);
            setEmail('');
            fetchCouriers();

        } catch (error) {
            console.error(error);
            toast.error('Hata: ' + error.message);
        }
    };

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Kurye Yönetimi</h1>
                    <p className="text-gray-500">Filo durumu ve kurye takibi</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700"
                >
                    + Kurye Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {couriers.map(courier => (
                    <div key={courier.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
                        {/* Status Stripe */}
                        <div className={`h-2 w-full ${courier.status === 'available' ? 'bg-green-500' :
                            courier.status === 'busy' ? 'bg-orange-500' : 'bg-gray-300'
                            }`} />

                        <div className="p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-3 rounded-full">
                                        <User className="w-6 h-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800">
                                            {courier.profile?.full_name || 'İsimsiz Kurye'}
                                        </h3>
                                        <p className="text-xs text-gray-500 font-mono">{courier.plate_number || 'Plaka Yok'}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                    ${courier.status === 'available' ? 'bg-green-100 text-green-700' :
                                        courier.status === 'busy' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}
                                `}>
                                    {courier.status === 'available' ? 'Müsait' :
                                        courier.status === 'busy' ? 'Meşgul' : 'Çevrimdışı'}
                                </span>
                            </div>

                            <div className="mt-6 space-y-3">
                                <div className="flex items-center text-sm text-gray-600">
                                    <Truck className="w-4 h-4 mr-2 opacity-50" />
                                    <span className="capitalize">
                                        {courier.vehicle_type === 'moto' ? 'Motosiklet' :
                                            courier.vehicle_type === 'car' ? 'Araba' :
                                                courier.vehicle_type === 'bike' ? 'Bisiklet' :
                                                    courier.vehicle_type === 'walker' ? 'Yaya' :
                                                        courier.vehicle_type || 'Araç Tipi Yok'}
                                    </span>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 mr-2 opacity-50" />
                                    {courier.current_lat ? 'Konum Paylaşılıyor' : 'Konum Yok'}
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                    <Battery className="w-4 h-4 mr-2 opacity-50" />
                                    Son Görülme: {new Date(courier.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2">
                                <button className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition">
                                    Geçmiş
                                </button>
                                <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition">
                                    Ara
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {couriers.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Henüz kayıtlı kurye yok.</p>
                        <p className="text-sm">Sisteme giren kuryeler burada görünecektir.</p>
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Kurye Ekle</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Kuryenin e-posta adresini girin. Eğer sistemde kayıtlıysa otomatik olarak mağazanıza bağlanacaktır.
                        </p>
                        <form onSubmit={handleInviteCourier}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-1">E-Posta Adresi</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full border p-2 rounded-lg"
                                    placeholder="kurye@email.com"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 py-2 bg-gray-100 rounded-lg text-gray-700"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                                >
                                    Ekle / Davet Et
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
