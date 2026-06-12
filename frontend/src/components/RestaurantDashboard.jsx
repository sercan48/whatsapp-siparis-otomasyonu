import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Coffee, Bike, CheckCircle, Package, AlertTriangle, ChefHat } from 'lucide-react';
import { KitchenBoard } from './KitchenBoard'; // Import KDS
import { playNotificationSound } from '../utils/kioskUtils'; // Use Web Audio API instead of MP3

export const RestaurantDashboard = ({ tenantId = 'DEFAULT_TENANT_ID_HERE' }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertMsg, setAlertMsg] = useState(null);
    // Removed: audioRef - now using playNotificationSound() from kioskUtils

    useEffect(() => {
        fetchAllOrders();

        const channel = supabase
            .channel('public:orders_unified')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_orders' }, () => {
                // For POS orders, complex joins make partial updates hard, simpler to refetch
                fetchAllOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId]);

    const fetchAllOrders = async () => {
        try {
            // 1. Fetch Delivery Orders
            const { data: deliveryOrders } = await supabase
                .from('orders')
                .select('*')
                .in('status', ['new', 'paid', 'preparing', 'shipping'])
                .order('created_at', { ascending: true });

            // 2. Fetch POS Orders (Dine-in) with joined data
            // We only want active orders (not closed ones)
            // Note: 'served' or 'completed' might be equivalent to delivered.
            const { data: posOrders } = await supabase
                .from('pos_orders')
                .select(`
                    *,
                    items:pos_order_items(*),
                    session:pos_sessions(
                        table:restaurant_tables(name)
                    )
                `)
                .in('status', ['pending', 'preparing', 'ready', 'served']) // 'served' = Delivered to table
                .order('created_at', { ascending: true });

            // 3. Unify Data
            const unified = [
                ...(deliveryOrders || []).map(o => ({ ...o, type: 'delivery', displaySource: (o.source === 'whatsapp' ? 'WhatsApp' : 'Web') })),
                ...(posOrders || []).map(o => unifyPosOrder(o))
            ];

            // Sort by creation time
            unified.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            setOrders(unified);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const unifyPosOrder = (po) => {
        // Flatten POS structure to match Order structure
        return {
            id: po.id,
            created_at: po.created_at,
            status: mapPosStatus(po.status), // map 'pending' to 'new' if needed
            total_amount: 0, // Calculated from items usually, or 0
            items: po.items.map(i => ({ name: i.name, quantity: i.quantity, note: i.note })),
            note: po.note,
            source: 'Masa ' + (po.session?.table?.name || '?'),
            displaySource: 'Masa',
            type: 'pos'
        };
    };

    // Map POS status to Dashboard status pillars
    // Dashboard Pillars: new/paid -> preparing -> shipping -> delivered
    // POS Flow: pending -> preparing -> ready -> served
    const mapPosStatus = (s) => {
        if (s === 'pending') return 'new';
        if (s === 'ready') return 'shipping'; // 'shipping' column implies 'Ready to Serve' for dine-in
        if (s === 'served') return 'delivered';
        return s; // 'preparing' is same
    };

    const handleRealtimeUpdate = (payload) => {
        if (payload.table === 'orders') {
            fetchAllOrders(); // Simplest strategy for mixed sources
        }
    };

    const updateStatus = async (order, nextStatus) => {
        if (order.type === 'pos') {
            // Map Back to POS status
            let posStatus = nextStatus;
            if (nextStatus === 'new') posStatus = 'pending';
            if (nextStatus === 'shipping') posStatus = 'ready'; // Ready to Serve
            if (nextStatus === 'delivered') posStatus = 'served'; // Done

            await supabase.from('pos_orders').update({ status: posStatus }).eq('id', order.id);
            // Also update items? Usually yes, but for simplicity just order status for now.
        } else {
            // Delivery
            await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
        }
        fetchAllOrders(); // Optimistic update or refetch
    };

    return (
        <div className="flex-1 p-8 overflow-x-auto overflow-y-hidden bg-gray-100 h-full">
            <div className="flex space-x-6 h-full min-w-max">

                <OrderColumn
                    title="Yeni Siparişler"
                    orders={orders.filter(o => o.status === 'new' || o.status === 'paid')}
                    color="border-yellow-400 bg-yellow-50"
                    icon={<Coffee className="w-5 h-5 text-yellow-600" />}
                    onAction={updateStatus}
                    actionLabel="Hazırla"
                    nextStatus="preparing"
                    btnColor="bg-blue-600 hover:bg-blue-700"
                />

                <OrderColumn
                    title="Hazırlanıyor"
                    orders={orders.filter(o => o.status === 'preparing')}
                    color="border-blue-400 bg-blue-50"
                    icon={<ChefHat className="w-5 h-5 text-blue-600" />}
                    onAction={updateStatus}
                    actionLabel={(order) => order.type === 'pos' ? 'Servise Hazır' : 'Kurye Çağır'}
                    nextStatus="shipping"
                    btnColor="bg-purple-600 hover:bg-purple-700"
                />

                <OrderColumn
                    title="Servis / Yolda"
                    orders={orders.filter(o => o.status === 'shipping')}
                    color="border-purple-400 bg-purple-50"
                    icon={<Package className="w-5 h-5 text-purple-600" />}
                    onAction={updateStatus}
                    actionLabel={(order) => order.type === 'pos' ? 'Masaya Teslim Et' : 'Teslim Edildi'}
                    nextStatus="delivered"
                    btnColor="bg-green-600 hover:bg-green-700"
                />
            </div>
        </div>
    );
};

const OrderColumn = ({ title, orders, color, icon, onAction, actionLabel, nextStatus, btnColor }) => (
    <div className={`flex-1 min-w-[350px] bg-white rounded-xl shadow-sm border-t-4 ${color.split(' ')[0]} flex flex-col`}>
        <div className={`p-4 border-b border-gray-100 flex justify-between items-center rounded-t-xl ${color.split(' ')[1]}`}>
            <div className="flex items-center space-x-2">
                {icon}
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
            </div>
            <span className="bg-white/50 text-gray-800 px-2 py-0.5 rounded-full text-sm font-bold">{orders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
            {orders.map(order => (
                <OrderCard
                    key={order.id}
                    order={order}
                    onAction={() => onAction(order, nextStatus)}
                    label={typeof actionLabel === 'function' ? actionLabel(order) : actionLabel}
                    btnColor={btnColor}
                />
            ))}
            {orders.length === 0 && (
                <div className="text-center text-gray-400 py-10 opacity-60 italic">Sipariş bekleniyor...</div>
            )}
        </div>
    </div>
);

const OrderCard = ({ order, onAction, label, btnColor }) => {
    const isPos = order.type === 'pos';
    const isWhatsapp = order.source === 'whatsapp';

    // Parse items carefully
    let items = order.items || [];
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { }
    }

    return (
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            {/* Context Badge */}
            <div className={`absolute top-0 right-0 px-2 py-1 text-[10px] font-bold text-white rounded-bl-lg
                ${isPos ? 'bg-purple-500' : (isWhatsapp ? 'bg-green-500' : 'bg-orange-500')}`}>
                {isPos ? 'MASA' : (isWhatsapp ? 'WHATSAPP' : 'WEB')}
            </div>

            <div className="flex justify-between items-start mb-3 pl-1">
                <div>
                    <span className="block font-bold text-gray-800 text-lg">
                        {isPos ? order.source : `#${order.id.slice(0, 4)}`}
                    </span>
                    <span className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            {/* Note Alert */}
            {order.note && (
                <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-3 border border-red-100 font-bold animate-pulse">
                    NOT: {order.note}
                </div>
            )}

            <div className="mb-4 space-y-2 border-t border-b border-gray-50 py-2">
                {items.map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-700 flex flex-col">
                        <div className="flex justify-between">
                            <span><span className="font-bold text-gray-900">{item.quantity}x</span> {item.name}</span>
                        </div>
                        {item.note && <span className="text-[10px] text-red-500 italic pl-5">- {item.note}</span>}
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={onAction}
                    className={`${btnColor} text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transform active:scale-95 transition-all flex items-center w-full justify-center`}
                >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {label}
                </button>
            </div>
        </div>
    );
};
