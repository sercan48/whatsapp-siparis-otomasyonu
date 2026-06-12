import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Search, Trash2, Plus, Minus, ChefHat, CreditCard, Banknote, XCircle, Clock, CheckCircle, Users, Star, Gift, Shuffle, Printer, Monitor, UtensilsCrossed, Percent, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { printReceipt } from '../utils/receiptPrinter';
import { SplitPaymentModal } from './SplitPaymentModal';
import { TouchPaymentModal } from './TouchPaymentModal';
import { offlineOrderService } from '../lib/OfflineOrderService';


export const POSOrderView = ({ table, session, onBack }) => {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [loading, _setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');

    // New Order State
    const [orderNote, setOrderNote] = useState(''); // General Note for the new batch
    const [existingItems, setExistingItems] = useState([]); // Already confirmed items
    const [viewMode, setViewMode] = useState('new'); // 'new' or 'history'

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showTouchPayment, setShowTouchPayment] = useState(false); // New Touch Payment Modal
    const [paymentMethod, setPaymentMethod] = useState(null); // 'cash' | 'credit_card' | 'meal_voucher' | 'split'
    const [showSplitModal, setShowSplitModal] = useState(false); // For split payment modal


    // Table Transfer State
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [availableTables, setAvailableTables] = useState([]);

    // Delete Item Modal State
    const [deleteModal, setDeleteModal] = useState({ open: false, item: null, deleteQty: 1 });

    // Role State
    const [userRole, setUserRole] = useState(null); // 'waiter', 'cashier', 'admin'

    // Customer Selection State
    const [assignedCustomer, setAssignedCustomer] = useState(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, _setCustomers] = useState([]);


    // Local Session State (to prevent stale prop issues)
    const [currentSession, setCurrentSession] = useState(session);

    useEffect(() => {
        setCurrentSession(session);
    }, [session]);


    const fetchMenu = useCallback(async () => {
        try {
            const { data: categoriesData } = await supabase.from('product_categories').select('*').order('name');
            const { data: productsData } = await supabase.from('products').select('*').order('name');
            setCategories(categoriesData || []);
            setProducts(productsData || []);
            if (categoriesData?.length > 0) setActiveCategory(categoriesData[0].id);
        } catch (error) {
            console.error('Menu fetch error:', error);
        }
    }, []);

    const fetchCurrentOrders = useCallback(async () => {
        if (!session?.id) return;
        try {
            const { data, error } = await supabase
                .from('pos_orders')
                .select(`
                    *,
                    items:pos_order_items(*)
                `)
                .eq('pos_session_id', session.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setExistingItems(data || []);
        } catch (error) {
            console.error('Session orders fetch error:', error);
        }
    }, [session]);

    const fetchUserRole = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    setUserRole(data.role);
                } else {
                    setUserRole('admin');
                }
            }
        } catch (error) {
            console.error('Role fetch error:', error);
        }
    }, []);

    useEffect(() => {
        fetchMenu();
        fetchUserRole();
        if (session?.id) fetchCurrentOrders();

        const subscription = supabase
            .channel(`session_orders_${session.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pos_order_items',
                filter: `pos_session_id=eq.${session.id}`
            }, () => fetchCurrentOrders())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pos_orders',
                filter: `pos_session_id=eq.${session.id}`
            }, () => fetchCurrentOrders())
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [session, fetchMenu, fetchUserRole, fetchCurrentOrders]);


    // --- TABLE CLOSING (Self-Healing) ---
    const handleCloseTable = async () => {
        if (!window.confirm(`${table.table_number || table.name} masasını kapatmak istediğinize emin misiniz?`)) return;

        try {
            // 1. Update ALL Active/Open Sessions for this table
            const { error: sessionError } = await supabase
                .from('pos_sessions')
                .update({
                    status: 'paid',
                    payment_method: 'cancellation',
                    total_amount: 0,
                    closed_at: new Date().toISOString()
                })
                .eq('table_id', table.id)
                .in('status', ['active', 'open']);

            if (sessionError) {
                console.warn('Session close warning:', sessionError);
                toast.error('Oturumlar kapatılırken hata alındı.');
            }

            // 2. Update Table Status (Split to avoid Schema Cache lockups)
            const { error: statusError } = await supabase
                .from('restaurant_tables')
                .update({ status: 'empty' })
                .eq('id', table.id);

            if (statusError) {
                console.error('Table status update error:', statusError);
                throw new Error('Masa durumu güncellenemedi: ' + statusError.message);
            }

            // 3. Clear Session ID (Critical for state sync)
            const { error: linkError } = await supabase
                .from('restaurant_tables')
                .update({ current_session_id: null })
                .eq('id', table.id);

            if (linkError) {
                console.warn('Session unlink warning:', linkError);
            }

            toast.success('Masa kapatıldı.');
            onBack();
        } catch (error) {
            console.error('Close table fatal error:', error);
            toast.error(error.message || 'Masa kapatılırken hata oluştu');
        }
    };



    // Filter products
    const filteredProducts = products.filter(p => {
        const matchesCategory = activeCategory ? p.category === activeCategory : true;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Cart Actions
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1, note: '' }];
        });
        toast.success(`${product.name} eklendi`, { duration: 1000, position: 'bottom-center' });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const updateItemNote = (productId, note) => {
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, note } : item
        ));
    };

    const handleConfirmOrder = async () => {
        if (cart.length === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // --- OFFLINE MODE CHECK ---
            if (!navigator.onLine) {
                const offlineOrder = {
                    tenant_id: user.id,
                    pos_session_id: session.id, // Might be risky if session ID is not valid, but ok for now
                    note: orderNote || null,
                    status: 'pending',
                    items: cart.map(item => ({
                        product_id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        note: item.note || null,
                        status: 'pending'
                    }))
                };

                await offlineOrderService.saveOrderLocally(offlineOrder);
                toast.success('İnternet Yok. Sipariş Cihaza Kaydedildi! 💾');
                setCart([]);
                setOrderNote('');
                // Optimistic UI update could go here (add to existingItems visually)
                // For now just clearing cart to allow next order
                return;
            }
            // --------------------------

            // 1. Create Order via Secure RPC (Server-Side Price Validation)
            const { data: rpcResponse, error: rpcError } = await supabase.rpc('place_pos_order_secure', {
                p_session_id: session.id,
                p_order_note: orderNote || null,
                p_items: cart.map(item => ({
                    product_id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    note: item.note || null
                }))
            });

            if (rpcError) {
                console.error('❌ POS RPC Error:', rpcError.message);
                throw new Error('Sipariş kaydedilemedi: ' + rpcError.message);
            }

            if (!rpcResponse.success) {
                throw new Error(rpcResponse.message || 'Sipariş oluşturulamadı');
            }

            toast.success('Sipariş Mutfakta! 🔥');
            setCart([]);
            setOrderNote('');
            fetchCurrentOrders(); // Refresh history
            setViewMode('history'); // Switch to history view

        } catch (error) {
            console.error('Order Error:', error);
            toast.error('Sipariş kaydedilemedi.');
        }
    };

    const handlePayment = async () => {
        if (!paymentMethod) return;

        try {
            const loadingToast = toast.loading('Ödeme alınıyor...');

            // 1. Close Session
            await supabase
                .from('pos_sessions')
                .update({
                    status: 'paid',
                    closed_at: new Date().toISOString(),
                    payment_method: paymentMethod,
                    total_amount: Number(grandTotal) // Ensure final total is synced
                })
                .eq('id', currentSession.id);


            // 2. Set Table to Empty
            await supabase
                .from('restaurant_tables')
                .update({ status: 'empty', current_session_id: null })
                .eq('id', table.id);

            toast.dismiss(loadingToast);

            const methodLabels = {
                'cash': 'Nakit',
                'credit_card': 'Kredi Kartı',
                'meal_voucher': 'Yemek Çeki/Kartı',
                'split': 'Bölünmüş Ödeme'
            };
            toast.success(`Ödeme Alındı (${methodLabels[paymentMethod] || paymentMethod})`);

            setShowPaymentModal(false);
            onBack(); // Return to Table Management

        } catch (error) {
            console.error('Payment Error:', error);
            toast.error('Ödeme işleminde hata oluştu');
        }
    };

    // Fetch Available (Empty) Tables for Transfer
    const fetchAvailableTables = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
            .from('restaurant_tables')
            .select('id, table_number, section_id')
            .eq('tenant_id', user.id)
            .eq('status', 'empty')
            .order('table_number');
        setAvailableTables(data || []);
    };

    // Handle Table Transfer
    const handleTableTransfer = async (newTableId) => {
        try {
            const loadingToast = toast.loading('Masa değiştiriliyor...');

            // 1. Update session to point to new table
            await supabase
                .from('pos_sessions')
                .update({ table_id: newTableId })
                .eq('id', currentSession.id);


            // 2. Set old table to empty
            await supabase
                .from('restaurant_tables')
                .update({ status: 'empty', current_session_id: null })
                .eq('id', table.id);

            // 3. Set new table to occupied
            await supabase
                .from('restaurant_tables')
                .update({ status: 'occupied', current_session_id: session.id })
                .eq('id', newTableId);

            toast.dismiss(loadingToast);
            toast.success('Masa başarıyla değiştirildi!');
            setShowTransferModal(false);
            onBack(); // Return and refresh
        } catch (error) {
            console.error('Transfer Error:', error);
            toast.error('Masa aktarılamadı');
        }
    };

    // Delete Order Item (only for pending items - before kitchen takes it)
    const openDeleteModal = (item) => {
        setDeleteModal({ open: true, item, deleteQty: Math.min(1, item.quantity) });
    };

    const handleDeleteItem = async () => {
        const { item, deleteQty } = deleteModal;
        if (!item) return;

        try {
            const loadingToast = toast.loading('Siliniyor...');

            if (deleteQty >= item.quantity) {
                // Delete entire item
                const { error } = await supabase
                    .from('pos_order_items')
                    .delete()
                    .eq('id', item.id);
                if (error) throw error;
            } else {
                // Reduce quantity
                const { error } = await supabase
                    .from('pos_order_items')
                    .update({ quantity: item.quantity - deleteQty })
                    .eq('id', item.id);
                if (error) throw error;
            }

            toast.dismiss(loadingToast);
            toast.success(`${deleteQty}x "${item.name}" silindi!`);
            setDeleteModal({ open: false, item: null, deleteQty: 1 });
            fetchCurrentOrders(); // Refresh list
        } catch (error) {
            console.error('Delete Error:', error);
            toast.error('Silme işlemi başarısız: ' + error.message);
        }
    };

    // Open transfer modal
    const openTransferModal = () => {
        fetchAvailableTables();
        setShowTransferModal(true);
    };



    // Check if all items are ready for payment (not pending or preparing)

    const pendingItems = existingItems.filter(item => item.status === 'pending' || item.status === 'preparing');
    const hasUnfinishedItems = pendingItems.length > 0;

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const existingItemsTotal = existingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const sessionTotal = Number(currentSession?.total_amount || 0);

    // Logic: Source of truth = sum of items (LogicTotal)
    const logicTotal = existingItemsTotal + cartTotal;
    const grandTotal = logicTotal > 0 ? logicTotal : sessionTotal;

    if (loading) return <div className="p-10 text-center animate-pulse">Menü Yükleniyor...</div>;

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Masa {table.table_number || table.name}</h1>
                        <p className="text-sm text-green-600 font-medium">
                            Adisyon #{session?.id?.slice(0, 8)}
                        </p>
                    </div>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => {
                            fetchCurrentOrders();
                            toast.success('Durum güncellendi', { duration: 1000 });
                        }}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        title="Sipariş durumunu yenile"
                    >
                        <RefreshCw className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {/* Customer Selection Button */}
                    <button
                        onClick={() => setShowCustomerModal(true)}
                        className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${assignedCustomer ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <Users className="w-5 h-5" />
                        {assignedCustomer ? (
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-sm">{assignedCustomer.name || assignedCustomer.phone}</span>
                                {assignedCustomer.customer_segments && (
                                    <span
                                        className="text-[10px] px-1.5 rounded text-white"
                                        style={{ backgroundColor: assignedCustomer.customer_segments.color }}
                                    >
                                        {assignedCustomer.customer_segments.name}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-sm">Müşteri Seç</span>
                        )}
                    </button>

                    {/* Table Transfer Button - Admin/Cashier Only */}
                    {(userRole === 'admin' || userRole === 'cashier') && session?.id && (
                        <button
                            onClick={openTransferModal}
                            className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                        >
                            <Shuffle className="w-5 h-5" />
                            <span className="text-sm hidden md:inline">Masa Değiştir</span>
                        </button>
                    )}

                    <div className="text-right mr-2 hidden md:block">
                        <p className="text-xs text-gray-500 font-bold uppercase">Genel Toplam</p>
                        <p className="text-xl font-black text-slate-800">₺{grandTotal.toFixed(2)}</p>
                    </div>

                    {/* Payment button - visible for Admin/Cashier */}

                    {userRole !== 'waiter' && (
                        <div className="relative flex gap-2">
                            {/* CLOSE TABLE BUTTON (Only if NO balance and NO cart) */}
                            {Number(grandTotal) <= 0 && (
                                <button
                                    onClick={handleCloseTable}
                                    className="px-6 py-2 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Masayı Kapat
                                </button>
                            )}

                            {hasUnfinishedItems && (
                                <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 animate-pulse border border-yellow-500">
                                    ⏳ {pendingItems.length}
                                </div>
                            )}

                            {/* PAYMENT BUTTON (Only if there IS a balance or cart) */}
                            {Number(grandTotal) > 0 && (
                                <button
                                    onClick={() => {
                                        if (Number(grandTotal) <= 0) {
                                            toast.error('Ödenecek tutar yok.', { duration: 2000 });
                                            return;
                                        }
                                        setShowTouchPayment(true);
                                    }}
                                    className="px-6 py-2 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 active:scale-95"
                                >
                                    <Banknote className="w-5 h-5" />
                                    Ödeme Al
                                </button>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Content Grid */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left: Categories - Touch Friendly Vertical Layout */}
                <div className="w-full lg:w-52 bg-slate-900 border-b lg:border-r border-slate-700 overflow-x-auto lg:overflow-y-auto flex-shrink-0 flex lg:flex-col">
                    {/* Mobile: Horizontal scroll */}
                    <div className="flex lg:flex-col gap-1 p-2 min-w-max lg:min-w-0">
                        {categories.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm mt-10 hidden lg:block">
                                <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p>Menü Boş</p>
                            </div>
                        ) : (
                            categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`
                                        whitespace-nowrap px-4 py-4 lg:py-5 rounded-lg font-bold text-sm lg:text-base transition-all
                                        text-left lg:text-left w-full touch-manipulation active:scale-95
                                        ${activeCategory === cat
                                            ? 'bg-orange-500 text-white shadow-lg border-l-4 border-orange-300'
                                            : 'bg-slate-800 text-white/70 hover:bg-slate-700 hover:text-white'}
                                    `}
                                >
                                    {cat}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Middle: Products */}
                <div className="flex-1 bg-gray-50 p-4 lg:p-6 overflow-y-auto">
                    {/* Search Bar & View Toggle */}
                    <div className="mb-4 lg:mb-6 relative flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Ürün ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Products Grid - Touch Friendly Visual Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="bg-white rounded-xl shadow-md hover:shadow-lg cursor-pointer transition-all border-2 border-transparent hover:border-orange-400 group overflow-hidden touch-manipulation active:scale-95"
                            >
                                {/* Product Image */}
                                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-5xl">
                                            {product.category?.toLowerCase().includes('içecek') ? '🥤' :
                                                product.category?.toLowerCase().includes('tatlı') ? '🍰' :
                                                    product.category?.toLowerCase().includes('salata') ? '🥗' :
                                                        product.category?.toLowerCase().includes('çorba') ? '🍲' :
                                                            product.category?.toLowerCase().includes('pizza') ? '🍕' :
                                                                product.category?.toLowerCase().includes('makarna') ? '🍝' :
                                                                    '🍔'}
                                        </div>
                                    )}
                                    {/* Price Badge */}
                                    <div className="absolute bottom-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-lg font-bold text-sm shadow-lg">
                                        ₺{product.price}
                                    </div>
                                </div>
                                {/* Product Name */}
                                <div className="p-3 text-center">
                                    <h3 className="font-bold text-gray-800 text-sm lg:text-base line-clamp-2 group-hover:text-orange-600 transition-colors">
                                        {product.name}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Cart (Adisyon) & History */}
                <div className="w-96 bg-white border-l flex flex-col shadow-xl z-10">
                    <div className="flex border-b bg-gray-50">
                        <button
                            onClick={() => setViewMode('new')}
                            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${viewMode === 'new' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Yeni Sipariş ({cart.length})
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${viewMode === 'history' ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Geçmiş ({existingItems.length})
                        </button>
                    </div>

                    {viewMode === 'new' ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <ChefHat className="w-12 h-12 mb-2 opacity-20" />
                                        <p>Sepet boş</p>
                                        <p className="text-xs opacity-60">Ürün eklemek için tıklayın</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                                                    <p className="text-xs text-gray-500">₺{item.price} x {item.quantity}</p>
                                                </div>
                                                <div className="font-bold text-gray-700">
                                                    ₺{(item.price * item.quantity).toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="flex items-center bg-gray-50 rounded border border-gray-200 h-8">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="px-2 hover:bg-gray-200 text-red-500 font-bold">-</button>
                                                    <span className="px-2 text-sm font-bold w-6 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id, 1)} className="px-2 hover:bg-gray-200 text-green-500 font-bold">+</button>
                                                </div>
                                                <input
                                                    className="flex-1 bg-gray-50 border border-gray-200 rounded h-8 px-2 text-xs focus:border-blue-500 outline-none placeholder-gray-400 transition-all focus:bg-white"
                                                    placeholder="Ürün notu... (Örn: Az pişmiş)"
                                                    value={item.note || ''}
                                                    onChange={(e) => updateItemNote(item.id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 border-t bg-white shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)] space-y-3">
                                {/* Order Note Input */}
                                <div className="relative">
                                    <textarea
                                        className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none h-16 placeholder-yellow-400/70 text-gray-700"
                                        placeholder="Tüm sipariş için not... (Örn: Mutfak Acele Etsin)"
                                        value={orderNote}
                                        onChange={(e) => setOrderNote(e.target.value)}
                                    ></textarea>
                                </div>

                                <div className="flex justify-between items-center text-lg font-bold text-gray-800 pt-2">
                                    <span>Ara Toplam</span>
                                    <span>₺{cartTotal.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={handleConfirmOrder}
                                    disabled={cart.length === 0}
                                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold shadow-lg transition-all transform active:scale-95
                                        ${cart.length > 0 ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-orange-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}`}
                                >
                                    <Banknote className="w-5 h-5" />
                                    Siparişi Onayla & Mutfak
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                            {existingItems.length === 0 ? (
                                <div className="text-center text-gray-400 mt-20">
                                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>Henüz geçmiş sipariş yok</p>
                                </div>
                            ) : (
                                existingItems.map((item, i) => (
                                    <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-1 relative overflow-hidden">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{item.quantity}x</span>
                                                    {item.name}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold
                                                        ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                            item.status === 'preparing' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-green-100 text-green-700'}`}>
                                                        {item.status === 'pending' ? 'Bekliyor' : item.status === 'preparing' ? 'Hazırlanıyor' : 'Hazır'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-600 text-sm">₺{(item.price * item.quantity).toFixed(2)}</span>
                                                {/* Delete button - only for pending items */}
                                                {item.status === 'pending' && (
                                                    <button
                                                        onClick={() => openDeleteModal(item)}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Siparişi Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Notes display */}
                                        {(item.note || item.order_note) && (
                                            <div className="mt-2 text-xs bg-red-50 text-red-600 p-2 rounded border border-red-100 flex flex-col gap-1">
                                                {item.order_note && <div><strong>Sipariş Notu:</strong> {item.order_note}</div>}
                                                {item.note && <div><strong>Ürün Notu:</strong> {item.note}</div>}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {
                showPaymentModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-center text-white">
                                <h2 className="text-xl font-bold">Ödeme Al & Masayı Kapat</h2>
                                <p className="opacity-80 text-sm mt-1">{table.name}</p>
                                <p className="text-4xl font-black mt-2">{grandTotal.toFixed(2)} ₺</p>
                            </div>

                            <div className="p-6 grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all
                                    ${paymentMethod === 'cash'
                                            ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200'
                                            : 'border-gray-100 hover:border-gray-300 text-gray-600'}`}
                                >
                                    <Banknote className="w-7 h-7 mb-1" />
                                    <span className="font-bold text-sm">Nakit</span>
                                </button>

                                <button
                                    onClick={() => setPaymentMethod('credit_card')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all
                                    ${paymentMethod === 'credit_card'
                                            ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-200'
                                            : 'border-gray-100 hover:border-gray-300 text-gray-600'}`}
                                >
                                    <CreditCard className="w-7 h-7 mb-1" />
                                    <span className="font-bold text-sm">Kredi Kartı</span>
                                </button>

                                <button
                                    onClick={() => setPaymentMethod('meal_voucher')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all
                                    ${paymentMethod === 'meal_voucher'
                                            ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                                            : 'border-gray-100 hover:border-gray-300 text-gray-600'}`}
                                >
                                    <UtensilsCrossed className="w-7 h-7 mb-1" />
                                    <span className="font-bold text-sm">Yemek Çeki</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setShowPaymentModal(false);
                                        setShowSplitModal(true);
                                    }}
                                    className="p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all border-blue-200 hover:border-blue-400 bg-blue-50 text-blue-700"
                                >
                                    <Percent className="w-7 h-7 mb-1" />
                                    <span className="font-bold text-sm">Bölünmüş</span>
                                </button>
                            </div>

                            {/* POS Device & Print Actions */}
                            <div className="px-6 pb-4 flex gap-2">
                                <button
                                    onClick={() => {
                                        toast('POS Cihazına Tutar Gönderildi: ' + grandTotal.toFixed(2) + ' TL', { icon: '📟' });
                                    }}
                                    className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors"
                                >
                                    <Monitor className="w-5 h-5" />
                                    POS Cihazına Gönder
                                </button>
                                <button
                                    onClick={() => {
                                        // Build receipt data from existing items
                                        const receiptData = {
                                            id: session?.id || 'temp',
                                            created_at: new Date().toISOString(),
                                            items: existingItems,
                                            session: { table: { name: table.name } }
                                        };
                                        printReceipt(receiptData);
                                        toast.success('Adisyon yazdırılıyor...');
                                    }}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors"
                                >
                                    <Printer className="w-5 h-5" />
                                    Adisyon Yazdır
                                </button>
                            </div>

                            <div className="p-6 border-t bg-gray-50 flex space-x-3">
                                <button
                                    onClick={() => { setShowPaymentModal(false); setPaymentMethod(null); }}
                                    className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handlePayment}
                                    disabled={!paymentMethod}
                                    className={`flex-1 py-3 font-bold rounded-xl text-white shadow-lg flex items-center justify-center gap-2
                                    ${!paymentMethod
                                            ? 'bg-gray-300 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Ödemeyi Onayla
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Customer Selection Modal */}
            {
                showCustomerModal && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-lg">Müşteri Seçimi</h3>
                                <button onClick={() => setShowCustomerModal(false)}><XCircle className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
                            </div>
                            <div className="p-4">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                    <input
                                        className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Telefon Numarası ile Ara..."
                                        value={customerSearch}
                                        onChange={e => setCustomerSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {customers.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setAssignedCustomer(c);
                                                setShowCustomerModal(false);
                                                toast.success('Müşteri Tanımlandı: ' + (c.name || c.phone));
                                            }}
                                            className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all text-left group"
                                        >
                                            <div>
                                                <div className="font-bold text-gray-800">{c.name || 'İsimsiz Müşteri'}</div>
                                                <div className="text-xs text-gray-500">{c.phone}</div>
                                            </div>
                                            <div className="text-right">
                                                {c.customer_segments && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white mb-1 inline-block" style={{ backgroundColor: c.customer_segments.color }}>
                                                        {c.customer_segments.name}
                                                    </span>
                                                )}
                                                <div className="text-xs font-bold text-orange-500 flex items-center justify-end gap-1">
                                                    <Gift className="w-3 h-3" />
                                                    {c.loyalty_points_balance || 0} Puan
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {customers.length === 0 && (
                                        <div className="text-center text-gray-400 py-4">Müşteri bulunamadı...</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Table Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-orange-50">
                            <h3 className="font-bold text-lg text-orange-800">Masa Değiştir</h3>
                            <button onClick={() => setShowTransferModal(false)}>
                                <XCircle className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-gray-600 mb-4">
                                <strong>{table.table_number || table.name}</strong> hesabını hangi masaya aktarmak istiyorsunuz?
                            </p>
                            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                {availableTables.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTableTransfer(t.id)}
                                        className="p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 rounded-xl text-center transition-all"
                                    >
                                        <span className="font-bold text-green-700">{t.table_number}</span>
                                    </button>
                                ))}
                                {availableTables.length === 0 && (
                                    <div className="col-span-3 text-center text-gray-400 py-4">
                                        Boş masa bulunamadı...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Split Payment Modal */}
            <SplitPaymentModal
                isOpen={showSplitModal}
                onClose={() => setShowSplitModal(false)}
                session={session}
                table={table}
                existingItems={existingItems}
                grandTotal={grandTotal}
                onPaymentComplete={async () => {
                    // Close session and table when split payment is fully complete
                    try {
                        const { data: { user: _user } } = await supabase.auth.getUser();


                        // Update session status to paid
                        await supabase.from('pos_sessions').update({ status: 'paid' }).eq('id', session.id);

                        // Set table back to empty
                        await supabase.from('restaurant_tables').update({ status: 'empty' }).eq('id', table.id);

                        toast.success('Hesap ödendi, masa boşaltıldı!');
                        setShowSplitModal(false);
                        onBack(); // Return to table view
                    } catch (error) {
                        console.error('Session close error:', error);
                        toast.error('Masa kapatılamadı.');
                    }
                }}
            />

            {/* Delete Item Modal */}
            {deleteModal.open && deleteModal.item && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Sipariş Sil</h3>

                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                            <p className="font-medium text-gray-700">{deleteModal.item.name}</p>
                            <p className="text-sm text-gray-500">Mevcut: {deleteModal.item.quantity} adet</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Silinecek Adet:</label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setDeleteModal(prev => ({ ...prev, deleteQty: Math.max(1, prev.deleteQty - 1) }))}
                                    disabled={deleteModal.deleteQty <= 1}
                                    className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-bold disabled:opacity-50"
                                >
                                    -
                                </button>
                                <span className="text-2xl font-bold text-red-600 w-12 text-center">{deleteModal.deleteQty}</span>
                                <button
                                    onClick={() => setDeleteModal(prev => ({ ...prev, deleteQty: Math.min(prev.item.quantity, prev.deleteQty + 1) }))}
                                    disabled={deleteModal.deleteQty >= deleteModal.item.quantity}
                                    className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-bold disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModal({ open: false, item: null, deleteQty: 1 })}
                                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleDeleteItem}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
                            >
                                Sil ({deleteModal.deleteQty}x)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Touch Payment Modal */}
            {showTouchPayment && (
                <TouchPaymentModal
                    table={table}
                    session={session}
                    onClose={() => {
                        setShowTouchPayment(false);
                        onBack(); // Return to table management after payment
                    }}
                />
            )}
        </div>
    );
};
