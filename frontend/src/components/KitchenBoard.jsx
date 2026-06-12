import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Clock, CheckCircle, ChefHat, AlertCircle, RefreshCw, Bike, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { AssignCourierModal } from './AssignCourierModal';
import { playNotificationSound, enterFullscreen, exitFullscreen, isFullscreen } from '../utils/kioskUtils';

export const KitchenBoard = ({ session }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [draggedOrder, setDraggedOrder] = useState(null);

    // Courier Modal State
    const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
    const [selectedOrderForCourier, setSelectedOrderForCourier] = useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [currentTenantId, setCurrentTenantId] = useState(null);

    // Kiosk Mode State
    const [kioskMode, setKioskMode] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const previousOrderCount = useRef(0);

    // Columns Configuration
    const columns = [
        { id: 'pending', title: 'Bekleyen', color: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: Clock },
        { id: 'preparing', title: 'Hazırlanıyor', color: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: ChefHat },
        { id: 'ready', title: 'Hazır', color: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle },
    ];

    useEffect(() => {
        fetchOrders();
        // subscribeToOrders(); // Realtime subscription (Optional for MVP)
        const interval = setInterval(fetchOrders, 10000); // Polling every 10s as backup
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log("KDS DEBUG - User:", user?.id);

            // Get tenant_id from user metadata or fallback to user.id for tenant owners
            const tenantId = user?.user_metadata?.tenant_id || user?.app_metadata?.tenant_id || user?.id;
            console.log("KDS DEBUG - Tenant ID:", tenantId);

            if (tenantId) setCurrentTenantId(tenantId);

            // Fetch POS Orders (and potentially online orders)
            // Ideally use a view or unified query. keeping simple for now.
            const { data, error } = await supabase
                .from('pos_order_items')
                .select(`
                    *,
                    order:pos_orders(
                        *,
                        session:pos_sessions(
                            session_type,
                            table:restaurant_tables(name)
                        )
                    )
                `)
                .eq('tenant_id', tenantId) // Use correct tenant_id
                .in('status', ['pending', 'preparing', 'ready']) // valid kds statuses
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Sound notification for new orders
            const newPendingCount = (data || []).filter(o => o.status === 'pending').length;
            if (soundEnabled && newPendingCount > previousOrderCount.current && previousOrderCount.current > 0) {
                playNotificationSound();
                toast('🔔 Yeni Sipariş Geldi!', { icon: '🍳' });
            }
            previousOrderCount.current = newPendingCount;

            setOrders(data || []);
        } catch (error) {
            console.error('KDS Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (itemId, newStatus) => {
        // Optimistic Update
        const oldOrders = [...orders];
        setOrders(prev => prev.map(o => o.id === itemId ? { ...o, status: newStatus } : o));

        try {
            const { error } = await supabase
                .from('pos_order_items')
                .update({ status: newStatus })
                .eq('id', itemId);

            if (error) throw error;
            toast.success(`Sipariş durumu: ${newStatus === 'preparing' ? 'Hazırlanıyor' : newStatus === 'ready' ? 'Hazır!' : newStatus}`);

            // Get order info for notification
            const item = orders.find(o => o.id === itemId);
            if (item?.order?.id && item?.order?.customer_phone) {
                // Send WhatsApp notification via Edge Function
                try {
                    await supabase.functions.invoke('order-status-notifier', {
                        body: {
                            order_id: item.order.id,
                            new_status: newStatus,
                            tracking_url: item.order.tracking_url || null
                        }
                    });
                } catch (notifyError) {
                    console.log('Notification skipped:', notifyError);
                }
            }

            if (newStatus === 'served' || newStatus === 'delivered') {
                // Remove from board logic if we had a 4th column, but here we likely remove ready ones manually or have a "Served" button
                fetchOrders();
            }

        } catch (error) {
            console.error('Update Error:', error);
            toast.error('Güncelleme başarısız');
            setOrders(oldOrders); // Rollback
        }
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e, order) => {
        setDraggedOrder(order);
        e.dataTransfer.setData('text/plain', order.id);
        e.dataTransfer.effectAllowed = 'move';
        // Add a ghost class or styling
        e.currentTarget.classList.add('opacity-50');
    };

    const handleDragEnd = (e) => {
        e.currentTarget.classList.remove('opacity-50');
        setDraggedOrder(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetStatus) => {
        e.preventDefault();
        const orderId = parseInt(e.dataTransfer.getData('text/plain')); // Assuming ID is int, standard supabase ID is usually uuid or int. Let's check type.
        // Actually dragStart sets order object to state, cleaner to use that.

        if (draggedOrder && draggedOrder.status !== targetStatus) {
            updateStatus(draggedOrder.id, targetStatus);
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Mutfak Ekranı Yükleniyor...</div>;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-100 p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ChefHat className="w-8 h-8 text-orange-600" />
                    Mutfak Ekranı (KDS)
                </h1>

                {/* Kiosk Controls */}
                <div className="flex items-center gap-2">
                    {/* Sound Toggle */}
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2 rounded-full shadow-sm transition-colors ${soundEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                        title={soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={() => {
                            if (isFullscreen()) {
                                exitFullscreen();
                                setKioskMode(false);
                            } else {
                                enterFullscreen();
                                setKioskMode(true);
                            }
                        }}
                        className={`p-2 rounded-full shadow-sm transition-colors ${kioskMode ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        title={kioskMode ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
                    >
                        {kioskMode ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>

                    {/* Refresh */}
                    <button onClick={fetchOrders} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50">
                        <RefreshCw className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden min-h-0">
                {columns.map(col => (
                    <div
                        key={col.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                        className={`flex flex-col h-full min-h-0 rounded-xl border-2 ${col.border} ${col.color} transition-colors overflow-hidden`}
                    >
                        {/* Column Header */}
                        <div className={`p-4 lg:p-5 border-b ${col.border} bg-white/50 flex justify-between items-center backdrop-blur-sm`}>
                            <h2 className={`font-bold text-lg lg:text-xl flex items-center gap-2 ${col.text}`}>
                                <col.icon className="w-6 h-6" />
                                {col.title}
                            </h2>
                            <div className="flex items-center gap-2">
                                {/* Advance All Button */}
                                {col.id !== 'ready' && orders.filter(o => o.status === col.id).length > 0 && (
                                    <button
                                        onClick={() => {
                                            const nextStatus = col.id === 'pending' ? 'preparing' : 'ready';
                                            orders.filter(o => o.status === col.id).forEach(item => {
                                                updateStatus(item.id, nextStatus);
                                            });
                                        }}
                                        className="bg-white/80 hover:bg-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1 touch-manipulation active:scale-95"
                                        title="Tümünü İlerlet"
                                    >
                                        → Tümü
                                    </button>
                                )}
                                <span className="bg-white px-3 py-1.5 rounded-full text-sm font-bold shadow-sm text-gray-600">
                                    {orders.filter(o => o.status === col.id).length}
                                </span>
                            </div>
                        </div>

                        {/* Order List - with explicit max height for scrolling */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                            {orders.filter(o => o.status === col.id).map(item => {
                                const isDelivery = item.order?.order_source === 'whatsapp' || item.order?.session?.session_type === 'delivery';

                                return (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item)}
                                        onDragEnd={handleDragEnd}
                                        className={`bg-white p-4 lg:p-5 rounded-xl shadow-sm border-2 cursor-pointer hover:shadow-lg transition-all touch-manipulation active:scale-[0.98] group relative ${isDelivery ? 'border-green-400 bg-green-50/30' : 'border-gray-200 hover:border-blue-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                                {/* Order Source Icon */}
                                                {item.order?.order_source === 'whatsapp' && (
                                                    <span className="text-green-600" title="WhatsApp Sipariş">📱</span>
                                                )}
                                                {item.order?.order_source === 'qr_menu' && (
                                                    <span className="text-blue-600" title="QR Menü">📲</span>
                                                )}
                                                {/* Suspicious Order Warning */}
                                                {item.order?.risk_flag && (
                                                    <span className="text-red-600 animate-pulse" title="⚠️ Şüpheli Sipariş - Müşteriyi arayın!">🚨</span>
                                                )}
                                                {isDelivery ? '🚀 Paket' : (item.order?.session?.table?.name || 'Masa')}
                                            </div>
                                            <div className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        {/* Customer Info for Delivery Orders */}
                                        {isDelivery && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2 space-y-1">
                                                {item.order?.customer_phone && (
                                                    <div className="text-xs text-green-800 flex items-center gap-1">
                                                        <span>📞</span>
                                                        <span className="font-semibold">{item.order.customer_phone}</span>
                                                    </div>
                                                )}
                                                {item.order?.customer_name && (
                                                    <div className="text-xs text-green-700">
                                                        👤 {item.order.customer_name}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Delivery Address - More Prominent */}
                                        {item.order?.delivery_address && (
                                            <div className="bg-orange-100 text-orange-800 p-3 rounded-lg text-sm mb-3 border-2 border-orange-300 flex items-start gap-2">
                                                <span className="text-lg">📍</span>
                                                <span className="leading-tight font-medium">{item.order.delivery_address}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="bg-blue-100 text-blue-800 text-lg font-bold px-2 py-0.5 rounded-lg">
                                                {item.quantity}x
                                            </span>
                                            <span className="font-medium text-gray-700 text-lg leading-tight">
                                                {item.name}
                                            </span>
                                        </div>

                                        {item.note && (
                                            <div className="bg-red-50 text-red-600 p-2 rounded-lg text-sm mb-3 border border-red-100 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                {item.note}
                                            </div>
                                        )}

                                        {/* Quick Actions (Touch Friendly) */}
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                            {col.id === 'pending' && (
                                                <button
                                                    onClick={() => updateStatus(item.id, 'preparing')}
                                                    className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-bold hover:bg-blue-200"
                                                >
                                                    🍳 Hazırla
                                                </button>
                                            )}
                                            {col.id === 'preparing' && (
                                                <button
                                                    onClick={() => updateStatus(item.id, 'ready')}
                                                    className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg text-sm font-bold hover:bg-green-200"
                                                >
                                                    ✅ Hazır
                                                </button>
                                            )}
                                            {col.id === 'ready' && (
                                                <>
                                                    {isDelivery ? (
                                                        /* Delivery Order: Only show Courier button */
                                                        <button
                                                            onClick={() => {
                                                                setSelectedOrderForCourier(item.order?.id || item.pos_order_id);
                                                                setSelectedOrderDetails({
                                                                    delivery_address: item.order?.delivery_address,
                                                                    customer_phone: item.order?.customer_phone,
                                                                    customer_name: item.order?.customer_name
                                                                });
                                                                setIsCourierModalOpen(true);
                                                            }}
                                                            className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-600 flex items-center justify-center gap-1"
                                                        >
                                                            <Bike className="w-4 h-4" />
                                                            Kuryeye Ata
                                                        </button>
                                                    ) : (
                                                        /* Dine-in Order: Only show Serve button */
                                                        <button
                                                            onClick={() => updateStatus(item.id, 'served')}
                                                            className="flex-1 bg-purple-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-600"
                                                        >
                                                            🍽️ Masaya Teslim Et
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>


            {/* Courier Modal */}
            <AssignCourierModal
                isOpen={isCourierModalOpen}
                onClose={() => {
                    setIsCourierModalOpen(false);
                    setSelectedOrderDetails(null);
                }}
                orderId={selectedOrderForCourier}
                tenantId={currentTenantId}
                orderDetails={selectedOrderDetails}
            />
        </div >
    );
};
