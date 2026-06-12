import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, CheckCircle, XCircle, Banknote, Bike, Coffee, User, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export const PastOrders = ({ tenantId = 'DEFAULT_TENANT_ID_HERE' }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, delivered, cancelled

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // 1. Fetch Delivery Orders (Completed)
            const { data: deliveryOrders } = await supabase
                .from('orders')
                .select('*')
                .in('status', ['delivered', 'cancelled', 'refunded'])
                .order('created_at', { ascending: false })
                .limit(50);

            // 2. Fetch POS Orders (Completed/Served)
            // Note: In POS, 'served' generally means done. We also include 'cancelled'.
            const { data: posOrders } = await supabase
                .from('pos_orders')
                .select(`
                    *,
                    items:pos_order_items(*),
                    session:pos_sessions(
                        table:restaurant_tables(name)
                    )
                `)
                .in('status', ['served', 'cancelled'])
                .order('created_at', { ascending: false })
                .limit(50);

            // 3. Unify Datasets
            const unified = [
                ...(deliveryOrders || []).map(o => ({
                    ...o,
                    type: 'delivery',
                    displaySource: o.source === 'whatsapp' ? 'WhatsApp' : 'Web',
                    displayName: o.user_id || 'Misafir',
                    handler: o.courier_name || 'Kurye',
                    finalAmount: parseFloat(o.final_amount) || parseFloat(o.total_amount) || 0
                })),
                ...(posOrders || []).map(o => ({
                    id: o.id,
                    created_at: o.created_at,
                    status: o.status === 'served' ? 'delivered' : o.status,
                    // Check if this is a WhatsApp order or table order
                    type: o.order_source === 'whatsapp' ? 'whatsapp' : 'pos',
                    displaySource: o.order_source === 'whatsapp' ? '📱 WhatsApp' : 'Masa',
                    displayName: o.order_source === 'whatsapp'
                        ? (o.customer_name || o.customer_phone || 'WhatsApp Müşteri')
                        : `Masa ${o.session?.table?.name || '?'}`,
                    handler: o.order_source === 'whatsapp' ? 'Online' : 'Garson',
                    finalAmount: o.total_amount || (o.items || []).reduce((sum, i) => sum + (i.price * i.quantity), 0),
                    delivery_address: o.delivery_address,
                    payment_method: o.payment_method
                }))
            ];

            // Sort Unified List
            unified.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setOrders(unified);
        } catch (error) {
            console.error('History Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculations
    const filteredOrders = orders.filter(o => filter === 'all' || o.status === filter);

    const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.finalAmount, 0);

    const deliveredCount = orders.filter(o => o.status === 'delivered').length;
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

    const deliveryRevenue = orders.filter(o => o.status === 'delivered' && o.type === 'delivery').reduce((sum, o) => sum + o.finalAmount, 0);
    const posRevenue = orders.filter(o => o.status === 'delivered' && o.type === 'pos').reduce((sum, o) => sum + o.finalAmount, 0);

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Geçmiş Siparişler & Raporlar</h1>
            <p className="text-gray-500 mb-6">Tüm satış kanallarının (Masa ve Paket) birleştirilmiş dökümü.</p>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <SummaryCard
                    title="Toplam Ciro"
                    value={`${totalRevenue.toFixed(2)} ₺`}
                    icon={<Banknote className="w-6 h-6" />}
                    color="green"
                />
                <SummaryCard
                    title="Masa Cirosu"
                    value={`${posRevenue.toFixed(2)} ₺`}
                    icon={<Coffee className="w-6 h-6" />}
                    color="purple"
                />
                <SummaryCard
                    title="Paket Cirosu"
                    value={`${deliveryRevenue.toFixed(2)} ₺`}
                    icon={<Bike className="w-6 h-6" />}
                    color="orange"
                />
                <SummaryCard
                    title="Toplam Sipariş"
                    value={`${deliveredCount} Adet`}
                    icon={<CheckCircle className="w-6 h-6" />}
                    color="blue"
                />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                    {['all', 'delivered', 'cancelled'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize 
                                ${filter === f ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            {{ all: 'Tümü', delivered: 'Tamamlanan', cancelled: 'İptal' }[f]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Sipariş No</th>
                            <th className="p-4 font-semibold text-gray-600">Kanal</th>
                            <th className="p-4 font-semibold text-gray-600">Tarih</th>
                            <th className="p-4 font-semibold text-gray-600">Müşteri / Masa</th>
                            <th className="p-4 font-semibold text-gray-600">Teslim Eden</th>
                            <th className="p-4 font-semibold text-gray-600">Tutar</th>
                            <th className="p-4 font-semibold text-gray-600">Durum</th>
                            <th className="p-4 font-semibold text-gray-600">Fatura</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-400">Yükleniyor...</td></tr>
                        ) : filteredOrders.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
                        ) : (
                            filteredOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-mono text-gray-500 text-xs">#{order.id.slice(0, 6)}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold
                                            ${order.type === 'pos' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {order.type === 'pos' ? <Coffee className="w-3 h-3 mr-1" /> : <Bike className="w-3 h-3 mr-1" />}
                                            {order.displaySource}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 text-sm">
                                        {new Date(order.created_at).toLocaleString('tr-TR')}
                                    </td>
                                    <td className="p-4 font-medium text-gray-800">
                                        {order.displayName}
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">
                                        <div className="flex items-center">
                                            <User className="w-3 h-3 mr-1 opacity-50" />
                                            {order.handler}
                                        </div>
                                    </td>
                                    <td className="p-4 font-bold text-gray-800">
                                        {order.finalAmount.toFixed(2)} ₺
                                    </td>
                                    <td className="p-4">
                                        <StatusBadge status={order.status} />
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => toast('E-Fatura entegrasyonu yakında aktifleşecek! 🧾', { icon: '🚧' })}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
                                        >
                                            <FileText className="w-4 h-4" />
                                            Oluştur
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, value, icon, color }) => {
    const colors = {
        green: 'bg-green-100 text-green-600',
        blue: 'bg-blue-100 text-blue-600',
        red: 'bg-red-100 text-red-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600'
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${colors[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles = {
        delivered: "bg-green-100 text-green-700",
        cancelled: "bg-red-100 text-red-700",
        refunded: "bg-orange-100 text-orange-700"
    };

    const labels = {
        delivered: "Tamamlandı",
        cancelled: "İptal",
        refunded: "İade"
    };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {labels[status] || status}
        </span>
    );
};
