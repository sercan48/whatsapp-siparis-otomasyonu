import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MapPin, Navigation, Package, Clock, Building2, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
// import { useNavigate } from 'react-router-dom';

export const UnifiedCourierDashboard = () => {
    // const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('active'); // active | pool
    const [loading, setLoading] = useState(true);
    const [myDeliveries, setMyDeliveries] = useState([]);
    const [poolOrders, setPoolOrders] = useState([]);
    const [stats, setStats] = useState({ today: 0, pending: 0 }); // eslint-disable-line no-unused-vars
    const [currentLocation, setCurrentLocation] = useState(null); // eslint-disable-line no-unused-vars

    useEffect(() => {
        fetchData();
        // Setup Realtime
        const channel = supabase
            .channel('courier-unified')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_orders' }, () => {
                fetchData();
            })
            .subscribe({}, (status, err) => {
                if (err) console.error(err);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch My Active Deliveries
            const { data: activeData } = await supabase
                .from('deliveries')
                .select('*, tenant:tenants(name)')
                .eq('courier_id', user.id)
                .in('status', ['assigned', 'picked_up', 'delivering'])
                .order('created_at', { ascending: true });

            setMyDeliveries(activeData || []);

            // 2. Fetch Pool Orders (Secure Server-Side Filtering)
            // Uses get_secure_courier_pool RPC ensuring RLS compliance
            const { data: poolData, error: poolError } = await supabase
                .rpc('get_secure_courier_pool', { p_courier_id: user.id });

            if (poolError) {
                console.error('Error fetching secure pool:', poolError);
            } else {
                setPoolOrders(poolData || []);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching unified dashboard:', error);
            setLoading(false);
        }
    };

    const handleAcceptOrder = async (orderId, tenantId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Insert into deliveries
            const { error } = await supabase
                .from('deliveries')
                .insert([{
                    tenant_id: tenantId,
                    order_id: orderId,
                    courier_id: user.id,
                    status: 'assigned',
                    source: 'pos',
                    courier_type: 'internal'
                }]);

            if (error) throw error;

            // Update Order Status
            await supabase
                .from('pos_orders')
                .update({ status: 'delivering' }) // Or 'awaiting_pickup'
                .eq('id', orderId);

            toast.success('Sipariş kabul edildi! 🚀');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Bu sipariş başkası tarafından alınmış olabilir.');
        }
    };

    const handleUpdateStatus = async (deliveryId, newStatus) => {
        try {
            await supabase
                .from('deliveries')
                .update({ status: newStatus })
                .eq('id', deliveryId);

            toast.success('Durum güncellendi');
            fetchData();
        } catch (error) {
            console.error('Update status error:', error);
            toast.error('Hata oluştu');
        }
    };

    const openGoogleMaps = (address) => {
        const query = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    };

    if (loading) return <div className="p-8 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></div>;

    return (
        <div className="pb-20 bg-slate-50 min-h-screen">
            {/* Stats Header */}
            <div className="bg-indigo-600 p-6 text-white rounded-b-3xl shadow-lg mb-4">
                <h1 className="text-2xl font-bold mb-1">Merhaba Kurye 👋</h1>
                <p className="opacity-80 text-sm">Bugün {myDeliveries.length} aktif teslimatın var</p>
            </div>

            {/* Tabs */}
            <div className="px-4 mb-4">
                <div className="bg-white p-1 rounded-xl flex shadow-sm">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'active' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}
                    >
                        Aktif Görevler ({myDeliveries.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('pool')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pool' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}
                    >
                        Havuz ({poolOrders.length})
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="px-4 space-y-3">
                {activeTab === 'active' && myDeliveries.map(delivery => (
                    <div key={delivery.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {delivery.tenant?.name || 'Restoran'}
                            </span>
                            <span className="text-slate-400 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(delivery.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <h3 className="font-bold text-slate-800 mb-1">{delivery.customer_name || 'Müşteri'}</h3>
                        <p className="text-sm text-slate-500 mb-3 flex items-start gap-1">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            {delivery.delivery_address || 'Adres bilgisi yok'}
                        </p>

                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => openGoogleMaps(delivery.delivery_address)}
                                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                            >
                                <Navigation className="w-4 h-4" /> Harita
                            </button>
                            {delivery.status === 'assigned' && (
                                <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'picked_up')}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium"
                                >
                                    Teslim Aldım
                                </button>
                            )}
                            {delivery.status === 'picked_up' && (
                                <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'delivered')}
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
                                >
                                    Teslim Et
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {activeTab === 'pool' && poolOrders.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 opacity-90 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {order.tenant?.name || 'Restoran'}
                            </span>
                            <span className="text-slate-400 text-xs">#{order.id.toString().slice(-4)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-sm">
                                <p className="font-bold text-slate-800">{order.customer_name || 'Masa Siparişi'}</p>
                                <p className="text-slate-500">{order.total_amount} ₺</p>
                            </div>
                            <span className="bg-green-50 text-green-600 text-xs px-2 py-1 rounded">Hazır</span>
                        </div>
                        <button
                            onClick={() => handleAcceptOrder(order.id, order.tenant_id)}
                            className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-bold shadow-orange-200 shadow-lg"
                        >
                            Görev Al (Kurye Ol)
                        </button>
                    </div>
                ))}

                {activeTab === 'active' && myDeliveries.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Aktif teslimatın yok.</p>
                        <button onClick={() => setActiveTab('pool')} className="text-indigo-500 font-medium mt-2">Havuzdan iş al</button>
                    </div>
                )}
            </div>
        </div>
    );
};
