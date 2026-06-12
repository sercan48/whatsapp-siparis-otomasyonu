import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ShoppingCart, Plus, Minus, ChefHat, ArrowRight, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductDetailModal } from './ProductDetailModal';
import { generateUUID } from '../lib/utils';

export const PublicMenuPage = () => {
    const { tableId } = useParams();
    const [searchParams] = useSearchParams();
    const isWhatsAppMode = searchParams.get('whatsapp') === 'true';

    const [table, setTable] = useState(null);
    const [tenant, setTenant] = useState(null);
    const [branding, setBranding] = useState({
        logo_url: null,
        primary_color: '#FF6B00',
        secondary_color: '#1F2937',
        accent_color: '#10B981',
        background_type: 'light',
        font_family: 'Inter'
    });
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [activeCategory, setActiveCategory] = useState('Hepsi');
    const [loading, setLoading] = useState(true);
    const [orderSent, setOrderSent] = useState(false);
    const [orderCount, setOrderCount] = useState(0);
    const [isBlocked, setIsBlocked] = useState(false);

    // NEW: Modal state
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showCart, setShowCart] = useState(false);

    // --- SECURITY & DEVICE ID ---
    const [deviceId, setDeviceId] = useState('');
    const [viewState, setViewState] = useState('loading'); // loading, menu, waiting_approval, join_request, blocked
    const [activeSession, setActiveSession] = useState(null);

    useEffect(() => {
        // Generate or retrieve persistent Device ID
        let id = localStorage.getItem('pos_device_id');
        if (!id) {
            id = generateUUID();
            localStorage.setItem('pos_device_id', id);
        }
        setDeviceId(id);
    }, []);

    useEffect(() => {
        if (tableId && deviceId) fetchMenuData();

        // Subscription for real-time status updates
        if (tableId) {
            const channel = supabase
                .channel(`public:table_${tableId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'restaurant_tables',
                    filter: `id=eq.${tableId}`
                }, (payload) => {
                    // Refresh if table status changes (e.g. waiter approves)
                    if (deviceId) fetchMenuData();
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [tableId, deviceId]);

    // Apply branding CSS variables
    useEffect(() => {
        if (branding) {
            document.documentElement.style.setProperty('--primary-color', branding.primary_color);
            document.documentElement.style.setProperty('--secondary-color', branding.secondary_color);
            document.documentElement.style.setProperty('--accent-color', branding.accent_color);
            document.documentElement.style.setProperty('--font-family', branding.font_family);
        }
    }, [branding]);

    const fetchMenuData = async () => {
        try {
            // 1. Get Table & Tenant Data
            const { data: tableData, error: tableError } = await supabase
                .from('restaurant_tables')
                .select(`
                    *,
                    current_session:pos_sessions(*)
                `)
                .eq('id', tableId)
                .single();

            if (tableError) throw tableError;
            setTable(tableData);

            // --- SECURITY CHECK ---
            const session = Array.isArray(tableData.current_session)
                ? tableData.current_session[0]
                : tableData.current_session;

            setActiveSession(session);

            // Scenario A: Table is Empty -> Show "Start Session" Request UI (or auto-request)
            if (tableData.status === 'empty' || !session) {
                // If we already requested and are just waiting
                // We need to check if we have a pending session for this table created by THIS device
                // But simplified: checking status logic below
                setViewState('empty_table'); // Will show "Click to Open Table"
            }
            // Scenario B: Table Occupied
            else {
                // Session exists. Check checks:
                // 1. Is status 'active'?
                // 2. Is my device authorized?
                const isAuthorized = session.device_ids?.includes(deviceId);
                const isPending = session.status === 'pending_approval';

                if (isPending) {
                    // Check if *I* am the one who requested it
                    if (session.device_ids?.includes(deviceId)) {
                        setViewState('waiting_approval');
                    } else {
                        // Someone else requested, but not approved yet
                        setViewState('table_busy_pending');
                    }
                } else if (session.status === 'active') {
                    if (isAuthorized) {
                        setViewState('menu'); // PROCEED TO MENU
                    } else {
                        // Table active, but I'm new -> Request Join
                        setViewState('join_request');
                    }
                }
            }

            // 2. Get Tenant/Profile info for branding
            const { data: profileData } = await supabase
                .from('profiles')
                .select('company_name, whatsapp_number, branding, menu_settings')
                .eq('id', tableData.tenant_id)
                .single();

            if (profileData) {
                setTenant(profileData);
                if (profileData.branding) setBranding(prev => ({ ...prev, ...profileData.branding }));
            }

            // 3. Get Menu Items
            const { data: menuData } = await supabase
                .from('menu')
                .select('*')
                .eq('tenant_id', tableData.tenant_id);

            setProducts(menuData || []);
            const cats = ['Hepsi', ...new Set((menuData || []).map(p => p.category).filter(Boolean))];
            setCategories(cats);

        } catch (error) {
            console.error('Menu load error:', error);
            toast.error('Menüye erişilemedi.');
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleRequestTable = async () => {
        try {
            setLoading(true);
            // check if session already created by race condition
            if (table.status !== 'empty') {
                fetchMenuData(); // retry
                return;
            }

            // Create Pending Session
            const { error } = await supabase
                .from('pos_sessions')
                .insert({
                    tenant_id: table.tenant_id,
                    table_id: table.id,
                    status: 'pending_approval', // NEW STATUS
                    device_ids: [deviceId],     // Authorize me
                    opened_at: new Date().toISOString(),
                    total_amount: 0
                });

            if (error) throw error;

            // Note: Trigger/Function usually updates table status to 'occupied' or similar
            // But if we want to keep it empty until approved, we just insert session.
            // AND we update table to link this session but maybe keep status 'pending'? 
            // Let's stick to plan: Table status 'occupied' but session 'pending_approval' is safest for visibility.

            // Actually, better: Update table to 'occupied' so no one else scans it as empty.
            // The constraint is checks on 'pos_orders' preventing orders.

            // Wait, we need the ID of created session to link table.
            // Let's redo insert to select.

            setViewState('waiting_approval');
            toast.success('Garsona bildirim gönderildi.', { icon: '👋' });

            // We need to re-fetch to get the 'pending' session correctly linked
            // But we can't link it if we don't have the ID. 
            // Refetching will handle it if we update table. Let's do it properly inside this function.

            // We'll rely on a subsequent fetch or the realtime subscription to catch the update
            // For now, let's assume we just insert.
            const { data: newSession, error: createError } = await supabase
                .from('pos_sessions')
                .insert({
                    tenant_id: table.tenant_id,
                    table_id: table.id,
                    status: 'pending_approval',
                    device_ids: [deviceId],
                    opened_at: new Date().toISOString(),
                    total_amount: 0
                })
                .select()
                .single();

            if (createError) throw createError;

            await supabase.from('restaurant_tables')
                .update({ current_session_id: newSession.id, status: 'occupied' })
                .eq('id', table.id);

            fetchMenuData();

        } catch (error) {
            console.error(error);
            toast.error('İstek gönderilemedi.');
            setLoading(false);
        }
    };

    const handleJoinRequest = async () => {
        try {
            setLoading(true);
            // Add my device to pending_devices
            // We need to append to the array.

            // Fetch current pending first to be safe
            const currentPending = activeSession.pending_devices || [];
            // check if already requested
            if (currentPending.some(d => d.device_id === deviceId)) {
                setViewState('waiting_approval');
                setLoading(false);
                return;
            }

            const newRequest = {
                device_id: deviceId,
                requested_at: new Date().toISOString(),
                user_agent: navigator.userAgent
            };

            const updatedPending = [...currentPending, newRequest];

            const { error } = await supabase
                .from('pos_sessions')
                .update({ pending_devices: updatedPending })
                .eq('id', activeSession.id);

            if (error) throw error;

            setViewState('waiting_approval');
            toast.success('Katılma isteği gönderildi.');
        } catch (error) {
            console.error(error);
            toast.error('İstek başarısız.');
        } finally {
            setLoading(false);
        }
    };


    // Open product detail modal
    const openProductModal = (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    // NEW: Add customized item to cart
    const addCustomizedToCart = (cartItem) => {
        setCart(prev => {
            // For customized items, always add as new (don't merge)
            const uniqueId = `${cartItem.id}_${Date.now()}`;
            return [...prev, { ...cartItem, cartId: uniqueId }];
        });
        toast.success('Sepete eklendi!', { position: 'bottom-center', duration: 1000, icon: '🛒' });
    };

    // Quick add (for simple items without customization)
    const quickAddToCart = (product) => {
        const cartItem = {
            id: product.id,
            cartId: `${product.id}_${Date.now()}`,
            name: product.name,
            basePrice: product.price,
            quantity: 1,
            removedIngredients: [],
            addedExtras: [],
            note: '',
            totalPrice: product.price,
            customizationSummary: null,
        };
        setCart(prev => [...prev, cartItem]);
        toast.success('Sepete eklendi!', { position: 'bottom-center', duration: 1000, icon: '🛒' });
    };

    const removeFromCart = (cartId) => {
        setCart(prev => prev.filter(item => item.cartId !== cartId));
    };

    const updateCartItemQuantity = (cartId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                const newQty = Math.max(0, item.quantity + delta);
                if (newQty === 0) return null;
                const perItemPrice = item.basePrice + item.addedExtras.reduce((s, e) => s + e.price, 0);
                return { ...item, quantity: newQty, totalPrice: perItemPrice * newQty };
            }
            return item;
        }).filter(Boolean));
    };

    // Send order to WhatsApp
    const sendToWhatsApp = () => {
        if (cart.length === 0) return;

        const whatsappNumber = tenant?.whatsapp_number || '905XXXXXXXXX';

        // Build order message
        let message = `🛒 *Yeni Sipariş*\n\n`;
        message += `📍 Masa: ${table?.name || 'Bilgi Yok'}\n`;
        message += `🏪 ${tenant?.company_name || 'Restoran'}\n\n`;
        message += `*Ürünler:*\n`;

        cart.forEach((item, idx) => {
            message += `${idx + 1}. ${item.quantity}x ${item.name}`;
            if (item.customizationSummary) {
                message += ` (${item.customizationSummary})`;
            }
            message += ` - ₺${item.totalPrice.toFixed(2)}\n`;
        });

        message += `\n💰 *Toplam: ₺${cartTotal.toFixed(2)}*`;

        // Encode and open WhatsApp
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
        toast.success('WhatsApp açılıyor...');
    };

    // Place order (for in-restaurant QR orders)
    const placeOrder = async () => {
        if (cart.length === 0) return;

        if (isBlocked) {
            toast.error('Çok fazla sipariş gönderildi. Lütfen bekleyin.');
            return;
        }

        if (orderCount >= 3) {
            setIsBlocked(true);
            toast.error('Sipariş limiti aşıldı. 5 dakika bekleyin.');
            setTimeout(() => {
                setIsBlocked(false);
                setOrderCount(0);
            }, 5 * 60 * 1000);
            return;
        }

        try {
            const loadingToast = toast.loading('Sipariş gönderiliyor...');

            let sessionId = table.current_session_id;

            if (!sessionId) {
                const { data: session, error: sessionError } = await supabase
                    .from('pos_sessions')
                    .insert({
                        tenant_id: table.tenant_id,
                        table_id: table.id,
                        status: 'active',
                        opened_at: new Date().toISOString(),
                        total_amount: 0
                    })
                    .select()
                    .single();

                if (sessionError) throw sessionError;

                await supabase.from('restaurant_tables').update({
                    status: 'occupied',
                    current_session_id: session.id
                }).eq('id', table.id);

                sessionId = session.id;
            }

            const { data: order, error: orderError } = await supabase
                .from('pos_orders')
                .insert({
                    tenant_id: table.tenant_id,
                    pos_session_id: sessionId,
                    status: 'pending',
                    note: 'Müşteri QR Siparişi'
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const items = cart.map(item => ({
                tenant_id: table.tenant_id,
                pos_order_id: order.id,
                product_id: item.id,
                name: item.name,
                price: item.basePrice,
                quantity: item.quantity,
                status: 'pending',
                modifications: JSON.stringify({
                    removed: item.removedIngredients,
                    extras: item.addedExtras,
                    note: item.note
                })
            }));

            const { error: itemsError } = await supabase.from('pos_order_items').insert(items);
            if (itemsError) throw itemsError;

            const { data: currentSession } = await supabase
                .from('pos_sessions')
                .select('total_amount')
                .eq('id', sessionId)
                .single();

            await supabase
                .from('pos_sessions')
                .update({ total_amount: (currentSession?.total_amount || 0) + cartTotal })
                .eq('id', sessionId);

            toast.dismiss(loadingToast);
            setOrderSent(true);
            setCart([]);
            setOrderCount(prev => prev + 1);
            toast.success('Siparişiniz Mutfakta! Afiyet olsun. 👨‍🍳');

        } catch (error) {
            console.error('Order Error:', error);
            toast.dismiss();
            toast.error('Sipariş gönderilemedi. Lütfen garson çağırın.');
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse flex flex-col items-center"><ChefHat className="w-12 h-12 text-gray-300 mb-4" />Menü Yükleniyor...</div></div>;

    if (!table) return <div className="h-screen flex items-center justify-center text-red-500">Masa bulunamadı veya QR kod geçersiz.</div>;

    // --- SECURITY SCREENS ---

    if (viewState === 'waiting_approval') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-blue-50 p-6 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Clock className="w-10 h-10 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-blue-800 mb-2">Garson Onayı Bekleniyor</h1>
                <p className="text-blue-600 mb-8 max-w-xs mx-auto">Masa açılış isteğiniz garsona iletildi. Lütfen bekleyiniz.</p>
                <div className="text-sm text-blue-400">ID: {deviceId?.slice(0, 8)}</div>
            </div>
        );
    }

    if (viewState === 'empty_table') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-8">
                    <ChefHat className="w-12 h-12 text-orange-500" />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Hoş Geldiniz!</h1>
                <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                    {table.name} masasına oturdunuz. Menüyü görüntülemek için masayı açın.
                </p>
                <button
                    onClick={handleRequestTable}
                    disabled={loading}
                    className="bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-orange-700 transition w-full max-w-xs flex items-center justify-center gap-2"
                >
                    <Utensils className="w-5 h-5" />
                    Masayı Aç & Menüyü Gör
                </button>
            </div>
        );
    }

    if (viewState === 'join_request') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                    <Users className="w-10 h-10 text-orange-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Masa Şu An Dolu</h1>
                <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                    Bu masada aktif bir oturum var. Katılmak istiyor musunuz?
                </p>
                <button
                    onClick={handleJoinRequest}
                    className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-700 transition w-full max-w-xs"
                >
                    Katılma İsteği Gönder
                </button>
            </div>
        );
    }

    if (viewState === 'table_busy_pending') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10 text-gray-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-800 mb-2">Masa Meşgul</h1>
                <p className="text-gray-500 max-w-xs mx-auto">
                    Başka bir müşteri bu masayı açmak için bekliyor.
                </p>
            </div>
        );
    }

    if (orderSent) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-green-50 p-6 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <ChefHat className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-green-800 mb-2">Siparişiniz Alındı!</h1>
                <p className="text-green-600 mb-8">Mutfağımız siparişinizi hazırlamaya başladı.</p>
                <button
                    onClick={() => setOrderSent(false)}
                    className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition"
                >
                    Menüye Dön / Yeni Sipariş
                </button>
            </div>
        );
    }

    const filteredProducts = activeCategory === 'Hepsi'
        ? products
        : products.filter(p => p.category === activeCategory);

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 shadow-sm">
                <div className="px-4 py-4 md:px-6 md:py-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{tenant?.company_name || 'Restoran'}</h1>
                        <p className="text-sm text-gray-500 font-medium">{table.name}</p>
                    </div>
                    {/* Cart Icon */}
                    <button
                        onClick={() => setShowCart(true)}
                        className="relative w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center"
                    >
                        <ShoppingCart className="w-6 h-6 text-orange-600" />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Categories */}
                <div className="flex overflow-x-auto gap-2 p-2 md:p-4 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors
                                ${activeCategory === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                    <div
                        key={product.id}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer hover:shadow-md transition"
                        onClick={() => openProductModal(product)}
                    >
                        <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center text-4xl flex-shrink-0">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                            ) : '🍔'}
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800">{product.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-2">{product.description || 'Lezzetli bir seçenek.'}</p>
                            </div>
                            <div className="flex justify-between items-center mt-3">
                                <div className="font-bold text-lg text-gray-900">₺{product.price}</div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openProductModal(product);
                                    }}
                                    className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 transition"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* View Cart Floating Bar */}
            {cart.length > 0 && !showCart && (
                <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] z-20">
                    <div
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center cursor-pointer"
                        onClick={() => setShowCart(true)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 px-3 py-1 rounded-lg font-bold">
                                {cartCount}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm text-white/80">Sepet Toplamı</span>
                                <span className="font-bold text-lg">₺{cartTotal.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 font-bold pr-2">
                            Sepeti Gör
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            )}

            {/* Cart Drawer */}
            {showCart && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
                        {/* Cart Header */}
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold">Sepetiniz ({cartCount})</h2>
                            <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.map((item) => (
                                <div key={item.cartId} className="bg-gray-50 p-3 rounded-xl">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h4 className="font-bold">{item.name}</h4>
                                            {item.customizationSummary && (
                                                <p className="text-xs text-gray-500 mt-1">{item.customizationSummary}</p>
                                            )}
                                        </div>
                                        <span className="font-bold">₺{item.totalPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center gap-1 bg-white rounded-lg p-1">
                                            <button
                                                onClick={() => updateCartItemQuantity(item.cartId, -1)}
                                                className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-8 text-center font-bold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateCartItemQuantity(item.cartId, 1)}
                                                className="w-8 h-8 rounded flex items-center justify-center hover:bg-gray-100"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.cartId)}
                                            className="text-red-500 text-sm font-medium"
                                        >
                                            Kaldır
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cart Footer */}
                        <div className="border-t p-4 space-y-3">
                            <div className="flex justify-between text-lg font-bold">
                                <span>Toplam</span>
                                <span>₺{cartTotal.toFixed(2)}</span>
                            </div>

                            {isWhatsAppMode ? (
                                <button
                                    onClick={sendToWhatsApp}
                                    className="w-full bg-green-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition"
                                >
                                    <Send className="w-5 h-5" />
                                    WhatsApp'a Gönder
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        onClick={placeOrder}
                                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-xl font-bold hover:shadow-lg transition"
                                    >
                                        Siparişi Ver
                                    </button>
                                    <button
                                        onClick={sendToWhatsApp}
                                        className="w-full bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition"
                                    >
                                        <Send className="w-5 h-5" />
                                        WhatsApp ile Gönder
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Product Detail Modal */}
            <ProductDetailModal
                product={selectedProduct}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedProduct(null);
                }}
                onAddToCart={addCustomizedToCart}
            />
        </div>
    );
};
