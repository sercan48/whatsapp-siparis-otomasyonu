import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    PhoneIncoming, X, User, MapPin, Clock, Package,
    Plus, History, ShoppingBag, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * IncomingCallPopup - Gelen Arama Bildirimi
 * - Müşteri bilgisi gösterimi
 * - Son siparişler
 * - Hızlı sipariş başlatma
 * - Realtime subscription ile otomatik açılır
 */
export const IncomingCallPopup = ({ onStartOrder }) => {
    const [call, setCall] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [visible, setVisible] = useState(false);
    const [countdown, setCountdown] = useState(30);

    useEffect(() => {
        // Subscribe to incoming_calls table for realtime updates
        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const channel = supabase
                .channel('incoming-calls')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'incoming_calls',
                        filter: `tenant_id=eq.${user.id}`
                    },
                    async (payload) => {
                        console.log('Incoming call:', payload);
                        const newCall = payload.new;

                        // Only show if not already handled
                        if (!newCall.handled) {
                            setCall(newCall);
                            setVisible(true);
                            setCountdown(30);

                            // Fetch customer details if exists
                            if (newCall.customer_id) {
                                await fetchCustomerDetails(newCall.customer_id);
                            } else {
                                setCustomer(null);
                                setRecentOrders([]);
                            }

                            // Play notification sound
                            playRingSound();
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        setupSubscription();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!visible) return;

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setVisible(false);
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [visible]);

    const playRingSound = () => {
        try {
            const audio = new Audio('/sounds/phone-ring.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) {
            console.log('Could not play sound');
        }
    };

    const fetchCustomerDetails = async (customerId) => {
        const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        setCustomer(customerData);

        // Fetch recent orders
        const { data: ordersData } = await supabase
            .from('orders')
            .select('id, created_at, total, status')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(3);

        setRecentOrders(ordersData || []);
    };

    const handleClose = async () => {
        setVisible(false);

        // Mark call as handled (dismissed)
        if (call?.id) {
            await supabase
                .from('incoming_calls')
                .update({
                    handled: true,
                    handled_at: new Date().toISOString(),
                    notes: 'Popup dismissed'
                })
                .eq('id', call.id);
        }
    };

    const handleStartOrder = async () => {
        // Mark call as handled with order
        if (call?.id) {
            await supabase
                .from('incoming_calls')
                .update({
                    handled: true,
                    handled_at: new Date().toISOString(),
                    notes: 'Order started from popup'
                })
                .eq('id', call.id);
        }

        // Callback to parent component to start order
        if (onStartOrder) {
            onStartOrder({
                phone: call?.caller_phone,
                customer: customer,
                isNewCustomer: call?.is_new_customer
            });
        }

        setVisible(false);
        toast.success('Sipariş başlatıldı!');
    };

    const handleCreateCustomer = async () => {
        // Navigate to customer creation with phone pre-filled
        // This would typically be handled by the parent component
        toast('Müşteri oluşturma ekranına yönlendiriliyor...', { icon: '👤' });

        // For now, just mark as handled
        if (call?.id) {
            await supabase
                .from('incoming_calls')
                .update({
                    handled: true,
                    handled_at: new Date().toISOString(),
                    notes: 'Customer creation initiated'
                })
                .eq('id', call.id);
        }

        setVisible(false);
    };

    if (!visible || !call) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] animate-slide-up">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-500 w-96 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                            <PhoneIncoming className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-white font-bold">Gelen Arama</div>
                            <div className="text-white/80 text-sm">{call.caller_phone}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-white/80 text-sm">{countdown}s</div>
                        <button
                            onClick={handleClose}
                            className="p-1 bg-white/20 rounded-lg hover:bg-white/30"
                        >
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    {customer ? (
                        // Known Customer
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800 text-lg">{customer.name}</div>
                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {customer.phone}
                                    </div>
                                </div>
                            </div>

                            {customer.default_address && (
                                <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400" />
                                    <span>{customer.default_address}</span>
                                </div>
                            )}

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-orange-50 p-2 rounded-lg text-center">
                                    <div className="text-xs text-orange-600">Toplam Sipariş</div>
                                    <div className="font-bold text-orange-700">{customer.total_orders || 0}</div>
                                </div>
                                <div className="bg-purple-50 p-2 rounded-lg text-center">
                                    <div className="text-xs text-purple-600">Puan</div>
                                    <div className="font-bold text-purple-700">{customer.loyalty_points_balance || 0}</div>
                                </div>
                            </div>

                            {/* Recent Orders */}
                            {recentOrders.length > 0 && (
                                <div>
                                    <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                                        <History className="w-3 h-3" />
                                        Son Siparişler
                                    </div>
                                    <div className="space-y-1">
                                        {recentOrders.map(order => (
                                            <div key={order.id} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1 rounded">
                                                <span className="text-gray-600">
                                                    {new Date(order.created_at).toLocaleDateString('tr-TR')}
                                                </span>
                                                <span className="font-bold text-gray-800">{order.total} TL</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // New Customer
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <User className="w-8 h-8 text-orange-600" />
                            </div>
                            <div className="font-bold text-gray-800 text-lg mb-1">Yeni Müşteri</div>
                            <div className="text-gray-500">{call.caller_phone}</div>
                            <button
                                onClick={handleCreateCustomer}
                                className="mt-3 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                            >
                                <Plus className="w-4 h-4 inline mr-1" />
                                Müşteri Oluştur
                            </button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t bg-gray-50 flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        Kapat
                    </button>
                    <button
                        onClick={handleStartOrder}
                        className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <ShoppingBag className="w-5 h-5" />
                        Sipariş Başlat
                    </button>
                </div>
            </div>

            {/* Custom animation styles */}
            <style>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default IncomingCallPopup;
