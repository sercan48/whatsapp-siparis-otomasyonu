import React, { useState, useEffect, useCallback } from 'react';
import {
    Package, Clock, CheckCircle, XCircle, Truck, RefreshCw,
    Filter, ChevronDown, Phone, MapPin, CreditCard, Loader2,
    AlertCircle, Volume2, VolumeX, Settings, BarChart3
} from 'lucide-react';
import {
    getAllPlatformOrders, getActiveOrders, getPlatformConfigs,
    updateOrderStatus, confirmOrder, rejectOrder,
    getPlatformStats, getStatusText, getStatusColor
} from '../lib/externalPlatformService';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const UnifiedOrderPanel = () => {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [platforms, setPlatforms] = useState([]);
    const [stats, setStats] = useState(null);
    const [tenantId, setTenantId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeTab, setActiveTab] = useState('active'); // active, all, stats
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [soundEnabled, setSoundEnabled] = useState(true);

    const init = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setTenantId(user.id);
            const configs = await getPlatformConfigs(user.id);
            setPlatforms(configs);
        }
        setLoading(false);
    }, []);

    const loadOrders = useCallback(async () => {
        try {
            let data;
            if (activeTab === 'active') {
                data = await getActiveOrders(tenantId);
            } else {
                data = await getAllPlatformOrders(tenantId, {
                    platformCode: filterPlatform !== 'all' ? filterPlatform : undefined,
                    limit: 100
                });
            }
            setOrders(data);

            // Load stats
            const statsData = await getPlatformStats(tenantId, 'today');
            setStats(statsData);
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }, [tenantId, activeTab, filterPlatform]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        init();
    }, [init]);


    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (tenantId) loadOrders();
    }, [tenantId, loadOrders]);



    const handleConfirmOrder = async (orderId, minutes = 30) => {
        try {
            await confirmOrder(orderId, minutes);
            toast.success('Sipariş onaylandı');
            loadOrders();
            setSelectedOrder(null);
        } catch (error) {
            toast.error('İşlem başarısız');
        }
    };

    const handleRejectOrder = async (orderId) => {
        const reason = prompt('Red sebebi:');
        if (!reason) return;

        try {
            await rejectOrder(orderId, reason);
            toast.success('Sipariş reddedildi');
            loadOrders();
            setSelectedOrder(null);
        } catch (error) {
            toast.error('İşlem başarısız');
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        try {
            await updateOrderStatus(orderId, newStatus);
            toast.success('Durum güncellendi');
            loadOrders();

            // Trigger conversion message when delivered
            if (newStatus === 'delivered') {
                triggerConversionMessage(orderId);
            }
        } catch (error) {
            toast.error('İşlem başarısız');
        }
    };

    // Send post-delivery conversion message
    const triggerConversionMessage = async (orderId) => {
        try {
            await supabase.functions.invoke('platform-conversion-notifier', {
                body: { orderId, action: 'process_delivered' }
            });
            // Conversion message sent successfully
        } catch (error) {
            // Silent fail - don't disrupt main flow
        }
    };

    const playNotification = () => {
        if (soundEnabled) {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => { });
        }
    };

    // Real-time subscription for new orders
    useEffect(() => {
        if (!tenantId) return;

        const subscription = supabase
            .channel('platform-orders')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'external_platform_orders',
                filter: `tenant_id=eq.${tenantId}`
            }, (payload) => {
                playNotification();
                toast.success('Yeni sipariş geldi!', { icon: '🔔' });
                loadOrders();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [tenantId, soundEnabled]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const enabledPlatforms = platforms.filter(p => p.is_enabled);

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Tüm Platform Siparişleri</h1>
                        <p className="text-slate-500">Yemeksepeti, Getir, Hepsiburada - Tek Ekranda</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2 rounded-lg ${soundEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={loadOrders}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            {stats && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-sm text-slate-500">Bugünkü Siparişler</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalOrders}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-sm text-slate-500">Teslim Edilen</p>
                        <p className="text-2xl font-bold text-green-600">{stats.deliveredOrders}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-sm text-slate-500">İptal</p>
                        <p className="text-2xl font-bold text-red-600">{stats.cancelledOrders}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-sm text-slate-500">Toplam Ciro</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.totalRevenue.toFixed(0)} ₺</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-sm text-slate-500">Komisyon</p>
                        <p className="text-2xl font-bold text-amber-600">{stats.totalCommission.toFixed(0)} ₺</p>
                    </div>
                </div>
            )}

            {/* Platform Filter Pills */}
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => setFilterPlatform('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filterPlatform === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    Tümü
                </button>
                {enabledPlatforms.map(platform => (
                    <button
                        key={platform.platform_code}
                        onClick={() => setFilterPlatform(platform.platform_code)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${filterPlatform === platform.platform_code
                            ? 'text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        style={{
                            backgroundColor: filterPlatform === platform.platform_code ? platform.color : undefined
                        }}
                    >
                        <span>{platform.logo}</span>
                        {platform.platform_name}
                        {stats?.byPlatform[platform.platform_code]?.orders > 0 && (
                            <span className="bg-white/20 rounded-full px-2 text-xs">
                                {stats.byPlatform[platform.platform_code].orders}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b">
                {[
                    { id: 'active', label: 'Aktif Siparişler', icon: Clock },
                    { id: 'all', label: 'Tüm Siparişler', icon: Package },
                    { id: 'stats', label: 'İstatistikler', icon: BarChart3 }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 -mb-px transition-all ${activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Orders Grid */}
            {activeTab !== 'stats' && (
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {orders.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-slate-500">
                            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>Aktif sipariş bulunmuyor</p>
                        </div>
                    ) : (
                        orders.map(order => (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg ${order.status === 'new' ? 'border-blue-300 animate-pulse' : 'border-slate-200'
                                    }`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{order.platformInfo?.logo}</span>
                                        <span className="font-bold text-slate-800">
                                            #{order.platform_order_number || order.platform_order_id?.slice(-6)}
                                        </span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                        {getStatusText(order.status)}
                                    </span>
                                </div>

                                {/* Customer */}
                                <div className="mb-3">
                                    <p className="font-medium text-slate-800">{order.customer_name}</p>
                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {order.customer_address?.substring(0, 50)}...
                                    </p>
                                </div>

                                {/* Items Preview */}
                                <div className="mb-3 text-sm text-slate-600">
                                    {order.items?.slice(0, 2).map((item, i) => (
                                        <p key={i}>{item.quantity}x {item.name}</p>
                                    ))}
                                    {order.items?.length > 2 && (
                                        <p className="text-slate-400">+{order.items.length - 2} ürün daha</p>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-3 border-t">
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Clock className="w-4 h-4" />
                                        {new Date(order.ordered_at).toLocaleTimeString('tr-TR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                    <p className="font-bold text-lg text-slate-800">
                                        {parseFloat(order.total_amount).toFixed(0)} ₺
                                    </p>
                                </div>

                                {/* Quick Actions for New Orders */}
                                {order.status === 'new' && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleConfirmOrder(order.id); }}
                                            className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium 
                                                       hover:bg-green-600 flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Onayla
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRejectOrder(order.id); }}
                                            className="py-2 px-4 bg-red-100 text-red-600 rounded-lg font-medium 
                                                       hover:bg-red-200 flex items-center justify-center gap-1"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Platform Breakdown */}
                    <div className="bg-white rounded-xl border p-6">
                        <h3 className="font-semibold text-slate-800 mb-4">Platform Dağılımı</h3>
                        <div className="space-y-3">
                            {Object.entries(stats.byPlatform).map(([code, data]) => (
                                <div key={code} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{data.logo}</span>
                                        <div>
                                            <p className="font-medium text-slate-800">{data.name}</p>
                                            <p className="text-sm text-slate-500">{data.orders} sipariş</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800">{data.revenue.toFixed(0)} ₺</p>
                                        <p className="text-xs text-slate-500">{data.delivered} teslim</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                        <h3 className="font-semibold mb-4">💡 Öneriler</h3>
                        <ul className="space-y-2 text-blue-100">
                            <li>• En yoğun saatleriniz: 12:00-14:00</li>
                            <li>• En çok sipariş: Yemeksepeti</li>
                            <li>• Ortalama hazırlık süresi: 18 dk</li>
                            <li>• Bugünkü başarı oranı: %{stats.deliveredOrders ? Math.round((stats.deliveredOrders / stats.totalOrders) * 100) : 0}</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onStatusChange={handleStatusChange}
                    onConfirm={handleConfirmOrder}
                    onReject={handleRejectOrder}
                />
            )}
        </div>
    );
};

// Order Detail Modal Component
const OrderDetailModal = ({ order, onClose, onStatusChange, onConfirm, onReject }) => {
    const statusFlow = ['new', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered'];
    const currentIndex = statusFlow.indexOf(order.status);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div
                    className="p-4 rounded-t-2xl text-white"
                    style={{ backgroundColor: order.platformInfo?.color || '#3b82f6' }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{order.platformInfo?.logo}</span>
                            <div>
                                <p className="font-bold">#{order.platform_order_number || order.platform_order_id?.slice(-8)}</p>
                                <p className="text-sm opacity-80">{order.platformInfo?.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Status */}
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                    </div>

                    {/* Customer Info */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <h4 className="font-medium text-slate-800 mb-2">Müşteri Bilgileri</h4>
                        <p className="font-medium">{order.customer_name}</p>
                        <a href={`tel:${order.customer_phone}`} className="text-blue-600 flex items-center gap-1 text-sm">
                            <Phone className="w-4 h-4" /> {order.customer_phone}
                        </a>
                        <p className="text-sm text-slate-600 mt-2 flex items-start gap-1">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {order.customer_address}
                        </p>
                        {order.customer_note && (
                            <p className="text-sm text-amber-600 mt-2 bg-amber-50 p-2 rounded">
                                📝 {order.customer_note}
                            </p>
                        )}
                    </div>

                    {/* Items */}
                    <div>
                        <h4 className="font-medium text-slate-800 mb-2">Sipariş Detayı</h4>
                        <div className="space-y-2">
                            {order.items?.map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b">
                                    <div>
                                        <p className="font-medium">{item.quantity}x {item.name}</p>
                                        {item.options?.length > 0 && (
                                            <p className="text-xs text-slate-500">{item.options.join(', ')}</p>
                                        )}
                                    </div>
                                    <p className="font-medium">{(item.price * item.quantity).toFixed(2)} ₺</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span>Ara Toplam</span>
                            <span>{parseFloat(order.subtotal || 0).toFixed(2)} ₺</span>
                        </div>
                        {order.delivery_fee > 0 && (
                            <div className="flex justify-between text-sm mb-1">
                                <span>Teslimat</span>
                                <span>{parseFloat(order.delivery_fee).toFixed(2)} ₺</span>
                            </div>
                        )}
                        {order.discount_amount > 0 && (
                            <div className="flex justify-between text-sm text-green-600 mb-1">
                                <span>İndirim</span>
                                <span>-{parseFloat(order.discount_amount).toFixed(2)} ₺</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                            <span>Toplam</span>
                            <span>{parseFloat(order.total_amount).toFixed(2)} ₺</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <span className="capitalize">{order.payment_method}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${order.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {order.is_paid ? 'Ödendi' : 'Kapıda'}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    {order.status === 'new' && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => onConfirm(order.id)}
                                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600"
                            >
                                ✓ Onayla (30 dk)
                            </button>
                            <button
                                onClick={() => onReject(order.id)}
                                className="py-3 px-6 bg-red-100 text-red-600 rounded-xl font-medium hover:bg-red-200"
                            >
                                Reddet
                            </button>
                        </div>
                    )}

                    {order.status !== 'new' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex gap-2">
                            {currentIndex < statusFlow.length - 1 && (
                                <button
                                    onClick={() => onStatusChange(order.id, statusFlow[currentIndex + 1])}
                                    className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
                                >
                                    → {getStatusText(statusFlow[currentIndex + 1])}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedOrderPanel;
