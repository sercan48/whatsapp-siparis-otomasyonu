import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- CONFIG ---
const supabase = createClient('https://your-project.supabase.co', 'public-anon-key');

// =====================================================================
// 1. SUPER ADMIN PANEL (SaaS Yönetimi - Kiracı & Konfigürasyon Girişi)
// =====================================================================

export const SuperAdminDashboard = () => {
    const [tenants, setTenants] = useState([]);
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantSlug, setNewTenantSlug] = useState('');
    const [businessType, setBusinessType] = useState('retail');

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        const { data } = await supabase.from('tenants').select('*, tenant_configs(business_type)');
        setTenants(data || []);
    };

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        
        // 1. Create Tenant
        const { data: tenant, error } = await supabase
            .from('tenants')
            .insert([{ name: newTenantName, slug: newTenantSlug }])
            .select()
            .single();

        if (error) return alert('Hata: ' + error.message);

        // 2. Initialize default dynamic configs for the selected business type
        const defaultConfigs = {
            tenant_id: tenant.id,
            business_type: businessType,
            ai_config: {
                tone: "friendly",
                rules: ["Müşteriye karşı kibar ol", "Sadece katalogdaki ürünleri sun"]
            },
            commerce_config: {
                currency: "TRY",
                delivery_types: businessType === 'restaurant' ? ["delivery", "table"] : ["delivery"],
                payment_methods: ["cash", "credit_card"],
                checkout_questions: businessType === 'restaurant' 
                    ? [
                        { "id": "table_no", "question": "Masa numaranız nedir?", "required_for": ["table"] },
                        { "id": "address", "question": "Teslimat adresiniz nedir?", "required_for": ["delivery"] }
                      ]
                    : [
                        { "id": "address", "question": "Teslimat adresiniz nedir?", "required_for": ["delivery"] }
                      ]
            },
            order_states: {
                states: [
                    { "name": "received", "label": "Yeni Sipariş" },
                    { "name": "processing", "label": "Hazırlanıyor" },
                    { "name": "ready", "label": "Teslimata Hazır" },
                    { "name": "completed", "label": "Tamamlandı" }
                ]
            }
        };

        await supabase.from('tenant_configs').insert([defaultConfigs]);
        
        setNewTenantName('');
        setNewTenantSlug('');
        fetchTenants();
    };

    const toggleStatus = async (id, currentStatus) => {
        await supabase.from('tenants').update({ is_active: !currentStatus }).eq('id', id);
        fetchTenants();
    };

    return (
        <div className="p-10 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-6">SaaS Super Admin</h1>

            {/* Tenant Creation Form */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h2 className="text-xl font-bold mb-4">Yeni İşletme (Tenant) Ekle</h2>
                <form onSubmit={handleCreateTenant} className="grid grid-cols-2 gap-4">
                    <input 
                        value={newTenantName} 
                        onChange={e => setNewTenantName(e.target.value)} 
                        placeholder="Firma Adı (Örn: Çiçek Bahçesi)" 
                        className="border p-2 rounded" 
                        required 
                    />
                    <input 
                        value={newTenantSlug} 
                        onChange={e => setNewTenantSlug(e.target.value)} 
                        placeholder="Subdomain / Slug (Örn: cicek-bahcesi)" 
                        className="border p-2 rounded" 
                        required 
                    />
                    <select 
                        value={businessType} 
                        onChange={e => setBusinessType(e.target.value)} 
                        className="border p-2 rounded col-span-2"
                    >
                        <option value="retail">Perakende / Ticaret</option>
                        <option value="restaurant">Yeme-İçme / Restoran</option>
                        <option value="services">Hizmet / Kuru Temizleme vb.</option>
                        <option value="florist">Çiçek / Butik</option>
                    </select>
                    <button type="submit" className="bg-blue-600 text-white p-2 rounded col-span-2 hover:bg-blue-700">Kaydet ve Başlat</button>
                </form>
            </div>

            {/* Tenants List */}
            <div className="bg-white p-6 rounded shadow">
                <table className="w-full">
                    <thead>
                        <tr className="text-left border-b-2 pb-2">
                            <th>Firma</th>
                            <th>Sektör Türü</th>
                            <th>Durum</th>
                            <th>Aksiyon</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map(t => (
                            <tr key={t.id} className="border-t">
                                <td className="p-3">{t.name} ({t.slug})</td>
                                <td className="p-3 capitalize">{t.tenant_configs?.[0]?.business_type || 'Belirtilmemiş'}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-sm ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {t.is_active ? 'Aktif' : 'Pasif'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <button
                                        onClick={() => toggleStatus(t.id, t.is_active)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {t.is_active ? 'Pasife Al' : 'Aktifleştir'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// =====================================================================
// 2. UNIVERSAL MERCHANT DASHBOARD (Dinamik Kanban Sipariş Ekranı)
// =====================================================================

export const UniversalMerchantDashboard = ({ tenantId }) => {
    const [config, setConfig] = useState(null);
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        fetchConfigsAndOrders();

        // Realtime Subscription
        const channel = supabase
            .channel('public:orders')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `tenant_id=eq.${tenantId}`
            }, () => {
                fetchConfigsAndOrders();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const fetchConfigsAndOrders = async () => {
        // 1. Fetch Tenant configs (read dynamic states flow)
        const { data: tenantConfig } = await supabase
            .from('tenant_configs')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        setConfig(tenantConfig);

        // 2. Fetch Active orders
        const { data: activeOrders } = await supabase
            .from('orders')
            .select('*, customers(name, phone)')
            .eq('tenant_id', tenantId)
            .neq('status', 'completed')
            .neq('status', 'cancelled');

        setOrders(activeOrders || []);
    };

    const handleNextStatus = async (orderId, currentStatus) => {
        if (!config || !config.order_states.states) return;
        
        const statesList = config.order_states.states;
        const currentIndex = statesList.findIndex(s => s.name === currentStatus);
        
        if (currentIndex !== -1 && currentIndex < statesList.length - 1) {
            const nextStatus = statesList[currentIndex + 1].name;
            await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
            fetchConfigsAndOrders();
        }
    };

    if (!config) return <div className="p-10">Yükleniyor...</div>;

    const columns = config.order_states.states || [];

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-slate-900 text-white p-5 flex flex-col justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-wider mb-2">Commerce Core</h1>
                    <p className="text-xs text-slate-400 mb-8 capitalize">Sektör: {config.business_type}</p>
                    {/* Navigation list */}
                    <nav className="space-y-2">
                        <a href="#orders" className="block bg-slate-800 p-2 rounded text-sm">Sipariş Yönetimi</a>
                        <a href="#products" className="block p-2 text-slate-400 hover:bg-slate-800 rounded text-sm">Ürün Kataloğu</a>
                        <a href="#settings" className="block p-2 text-slate-400 hover:bg-slate-800 rounded text-sm">SaaS Ayarları</a>
                    </nav>
                </div>
                <div className="text-xs text-slate-500">
                    Power by Conversational Core
                </div>
            </div>

            {/* Main Area: Dynamic Kanban Columns */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex space-x-4 h-full">
                    {columns.map(col => (
                        <div key={col.name} className="w-80 flex-shrink-0 flex flex-col bg-slate-100 rounded-lg p-4 h-full">
                            <h3 className="font-bold text-gray-700 mb-4 flex justify-between">
                                <span>{col.label}</span>
                                <span className="bg-slate-300 text-xs px-2 py-0.5 rounded-full">
                                    {orders.filter(o => o.status === col.name).length}
                                </span>
                            </h3>
                            <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                                {orders
                                    .filter(o => o.status === col.name)
                                    .map(order => (
                                        <OrderCard 
                                            key={order.id} 
                                            order={order} 
                                            onNextStatus={handleNextStatus}
                                            statesList={columns}
                                        />
                                    ))
                                }
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const OrderCard = ({ order, onNextStatus, statesList }) => {
    const currentIndex = statesList.findIndex(s => s.name === order.status);
    const hasNext = currentIndex !== -1 && currentIndex < statesList.length - 1;
    const nextLabel = hasNext ? statesList[currentIndex + 1].label : null;

    return (
        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500 hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-sm">#{order.id.slice(0, 5)}</span>
                <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString('tr-TR')}</span>
            </div>

            <div className="text-xs text-gray-500 mb-2">
                <strong>Müşteri:</strong> {order.customers?.name || 'Bilinmiyor'} ({order.customers?.phone})
            </div>

            {/* Sepet Elemanları */}
            <div className="mb-3 space-y-1">
                {order.items.map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-800">
                        {item.quantity}x {item.name} 
                        {item.selected_options && Object.keys(item.selected_options).length > 0 && (
                            <span className="text-xs text-gray-500 block pl-2">
                                ({Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(', ')})
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Sektörel Esneklik - Dynamic checkout answers */}
            {order.meta_data && Object.keys(order.meta_data).length > 0 && (
                <div className="border-t pt-2 mt-2 space-y-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {Object.entries(order.meta_data).map(([key, val]) => (
                        <div key={key}>
                            <span className="font-semibold capitalize">{key.replace('_', ' ')}:</span> {typeof val === 'object' ? JSON.stringify(val) : val}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center mt-4 border-t pt-2">
                <span className="font-bold text-md text-slate-800">{order.final_amount} TL</span>
                
                {hasNext && (
                    <button
                        onClick={() => onNextStatus(order.id, order.status)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition"
                    >
                        {nextLabel} &rarr;
                    </button>
                )}
            </div>
        </div>
    );
};
