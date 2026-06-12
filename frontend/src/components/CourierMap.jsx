import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MapPin, Navigation, Phone, Clock, Package, ExternalLink, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const CourierMap = () => {
    const [activeDeliveries, setActiveDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDelivery, setSelectedDelivery] = useState(null);

    useEffect(() => {
        fetchActiveDeliveries();
    }, []);

    const fetchActiveDeliveries = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get courier's active deliveries
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    status,
                    total_amount,
                    delivery_address,
                    customer_name,
                    customer_phone,
                    note,
                    tenant:profiles!tenant_id(company_name, phone)
                `)
                .eq('assigned_courier_id', user.id)
                .in('status', ['assigned', 'picked_up', 'on_the_way'])
                .order('created_at', { ascending: true });

            if (error) throw error;
            setActiveDeliveries(data || []);

            if (data && data.length > 0 && !selectedDelivery) {
                setSelectedDelivery(data[0]);
            }
        } catch (error) {
            console.error('Error fetching deliveries:', error);
        } finally {
            setLoading(false);
        }
    };

    const openInMaps = (address) => {
        const encodedAddress = encodeURIComponent(address);
        // Try to open in Google Maps app first, fallback to web
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
        window.open(googleMapsUrl, '_blank');
        toast.success('Google Maps açılıyor...');
    };

    const callCustomer = (phone) => {
        window.location.href = `tel:${phone}`;
    };

    const updateDeliveryStatus = async (orderId, newStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            toast.success(
                newStatus === 'picked_up' ? 'Sipariş alındı!' :
                    newStatus === 'on_the_way' ? 'Yoldasınız!' :
                        newStatus === 'delivered' ? 'Teslim edildi!' : 'Güncellendi!'
            );

            fetchActiveDeliveries();
        } catch (error) {
            toast.error('Güncelleme hatası');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'assigned': return 'bg-yellow-100 text-yellow-700';
            case 'picked_up': return 'bg-blue-100 text-blue-700';
            case 'on_the_way': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'assigned': return 'Bekliyor';
            case 'picked_up': return 'Alındı';
            case 'on_the_way': return 'Yolda';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                <h1 className="font-bold text-lg text-gray-800">Aktif Teslimatlar</h1>
                <button
                    onClick={fetchActiveDeliveries}
                    className="p-2 text-gray-500 hover:text-gray-800"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {activeDeliveries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <Package className="w-16 h-16 text-gray-300 mb-4" />
                    <h2 className="text-xl font-bold text-gray-600 mb-2">Aktif Teslimat Yok</h2>
                    <p className="text-gray-400">Size atanan yeni siparişler burada görünecek.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeDeliveries.map((delivery, index) => (
                        <div
                            key={delivery.id}
                            className={`bg-white rounded-xl shadow-sm border-2 transition-all ${selectedDelivery?.id === delivery.id
                                    ? 'border-blue-500'
                                    : 'border-gray-100'
                                }`}
                            onClick={() => setSelectedDelivery(delivery)}
                        >
                            {/* Order Number & Status */}
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-gray-800">
                                        #{index + 1} - {delivery.tenant?.company_name}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(delivery.status)}`}>
                                        {getStatusText(delivery.status)}
                                    </span>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                    <Clock className="w-4 h-4 mr-1" />
                                    {new Date(delivery.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    <span className="mx-2">•</span>
                                    <span className="font-bold text-green-600">₺{delivery.total_amount}</span>
                                </div>
                            </div>

                            {/* Customer & Address */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Müşteri</p>
                                    <p className="font-medium text-gray-800">{delivery.customer_name}</p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Teslimat Adresi</p>
                                    <p className="text-gray-700 text-sm">{delivery.delivery_address}</p>
                                </div>

                                {delivery.note && (
                                    <div className="bg-yellow-50 p-2 rounded-lg">
                                        <p className="text-xs text-yellow-700">📝 {delivery.note}</p>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="p-4 bg-gray-50 flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openInMaps(delivery.delivery_address); }}
                                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                                >
                                    <Navigation className="w-5 h-5" />
                                    Navigasyon
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); callCustomer(delivery.customer_phone); }}
                                    className="flex items-center justify-center p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                                >
                                    <Phone className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Status Update Buttons */}
                            <div className="p-4 border-t border-gray-100 flex gap-2">
                                {delivery.status === 'assigned' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateDeliveryStatus(delivery.id, 'picked_up'); }}
                                        className="flex-1 py-2 bg-yellow-500 text-white rounded-lg font-bold text-sm"
                                    >
                                        Siparişi Aldım
                                    </button>
                                )}
                                {delivery.status === 'picked_up' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateDeliveryStatus(delivery.id, 'on_the_way'); }}
                                        className="flex-1 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm"
                                    >
                                        Yola Çıktım
                                    </button>
                                )}
                                {delivery.status === 'on_the_way' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateDeliveryStatus(delivery.id, 'delivered'); }}
                                        className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold text-sm"
                                    >
                                        Teslim Ettim ✓
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
