import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ShoppingCart, Plus, Minus, ChefHat, ArrowRight, Send, X, Utensils, Star, Clock, MapPin, CreditCard, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductDetailModal } from './ProductDetailModal';

/**
 * SlugMenuPage - Premium Digital Menu Experience
 * Features:
 * - Animated splash screen with logo
 * - Dynamic gradient design
 * - Smooth animations & transitions
 * - Mobile-first responsive design
 */
export const SlugMenuPage = () => {
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const tableNumber = searchParams.get('table');

    // Core states
    const [tenant, setTenant] = useState(null);
    const [table, setTable] = useState(null);
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
    const [notFound, setNotFound] = useState(false);
    const [orderSent, setOrderSent] = useState(false);
    const [activeCampaigns, setActiveCampaigns] = useState([]);

    // UI States
    const [showSplash, setShowSplash] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showCart, setShowCart] = useState(false);

    // Discount states
    const [discountCode, setDiscountCode] = useState('');
    const [discountResult, setDiscountResult] = useState(null);
    const [discountLoading, setDiscountLoading] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState(null); // Prevent reuse
    const [usedCoupons, setUsedCoupons] = useState(() => {
        // Load from localStorage on init
        try {
            const stored = localStorage.getItem(`used_coupons_${slug}`);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        if (slug) fetchMenuBySlug();
    }, [slug]);

    // Apply branding CSS variables
    useEffect(() => {
        if (branding) {
            document.documentElement.style.setProperty('--primary-color', branding.primary_color);
            document.documentElement.style.setProperty('--secondary-color', branding.secondary_color);
            document.documentElement.style.setProperty('--accent-color', branding.accent_color);
            document.documentElement.style.setProperty('--font-family', branding.font_family);
        }
    }, [branding]);

    const fetchMenuBySlug = async () => {
        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, tenant_id, whatsapp_number, branding, menu_settings, store_settings, slug, email, company_name')
                .eq('slug', slug)
                .single();

            if (profileError || !profile) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            let tenantName = profile.company_name || 'Restoran';
            if (!profile.company_name && profile.tenant_id) {
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('name, logo_url')
                    .eq('id', profile.tenant_id)
                    .single();
                if (tenantData?.name) tenantName = tenantData.name;
                if (tenantData?.logo_url && !profile.branding?.logo_url) {
                    profile.branding = { ...profile.branding, logo_url: tenantData.logo_url };
                }
            }

            setTenant({ ...profile, company_name: tenantName });
            if (profile.branding) {
                setBranding(prev => ({ ...prev, ...profile.branding }));
            }

            if (tableNumber) {
                const { data: tableData } = await supabase
                    .from('restaurant_tables')
                    .select('*')
                    .eq('tenant_id', profile.tenant_id || profile.id)
                    .eq('table_number', parseInt(tableNumber))
                    .single();
                setTable(tableData);
            }

            const { data: menuData, error: menuError } = await supabase
                .from('menu')
                .select('*')
                .eq('tenant_id', profile.tenant_id || profile.id)
                .eq('is_active', true)
                .order('category', { ascending: true });

            if (!menuError && menuData) {
                setProducts(menuData);
                const cats = ['Hepsi', ...new Set(menuData.map(p => p.category).filter(Boolean))];
                setCategories(cats);
            }

            // Fetch Active Campaigns
            const { data: campaignData } = await supabase
                .from('campaigns')
                .select('*')
                .eq('tenant_id', profile.tenant_id || profile.id)
                .eq('is_active', true)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days or logic

            if (campaignData) {
                // Filter by time/date logic if needed, for now trust DB is_active 
                // but let's do a basic date check if start/end exists
                const validCampaigns = campaignData.filter(c => {
                    const matchesSchedule = c.schedule_type === 'always' || (
                        c.schedule_type === 'time_based' &&
                        (!c.start_time || new Date().toTimeString() >= c.start_time) && // Simple time string check might need better parsing depending on DB usage
                        (!c.end_time || new Date().toTimeString() <= c.end_time) // Validation: strict time parsing needed if time column is used
                    );
                    return matchesSchedule;
                });
                setActiveCampaigns(validCampaigns);
            }
        } catch (error) {
            console.error('Menu load error:', error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    // Cart functions
    const openProductModal = (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    // Calculations
    const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = discountResult?.valid ? discountResult.amount : 0;
    const finalTotal = Math.max(0, cartSubtotal - discountAmount);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const filteredProducts = activeCategory === 'Hepsi' ? products : products.filter(p => p.category === activeCategory);


    // Auto-apply best general campaign
    useEffect(() => {
        if (!activeCampaigns.length || !cart.length) return;

        // Reset if cart is empty or no campaigns
        if (cart.length === 0) setDiscountResult(null);

        // Find general campaigns (percent or amount)
        const generalCampaigns = activeCampaigns.filter(c =>
            (c.type === 'percent' || c.type === 'amount') &&
            (!c.rules.min_basket || cartSubtotal >= c.rules.min_basket)
        );

        if (generalCampaigns.length === 0) return;

        // Find best one
        let bestDiscount = null;
        let maxSavings = 0;

        generalCampaigns.forEach(camp => {
            let savings = 0;
            if (camp.type === 'percent') {
                savings = (cartSubtotal * camp.rules.value) / 100;
            } else if (camp.type === 'amount') {
                savings = parseFloat(camp.rules.value);
            }

            if (savings > maxSavings) {
                maxSavings = savings;
                bestDiscount = {
                    valid: true,
                    amount: savings,
                    message: `${camp.name} uygulandı!`,
                    type: camp.type,
                    value: camp.rules.value
                };
            }
        });

        if (bestDiscount && (!discountResult || bestDiscount.amount > discountResult.amount)) {
            setDiscountResult(bestDiscount);
            setDiscountCode('OTOMATIK');
            // Toast removed to avoid spamming on every cart update
        }

    }, [cartSubtotal, activeCampaigns, cart.length]);

    const addCustomizedToCart = (cartItem) => {
        setCart(prev => {
            const uniqueId = `${cartItem.id}_${Date.now()}`;
            return [...prev, { ...cartItem, cartId: uniqueId }];
        });
        toast.success('Sepete eklendi!', { position: 'bottom-center', duration: 1500, icon: '🛒' });
    };

    const removeFromCart = (cartId) => {
        setCart(prev => prev.filter(item => item.cartId !== cartId));
    };

    const updateCartItemQuantity = (cartId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                const newQty = Math.max(0, item.quantity + delta);
                if (newQty === 0) return null;
                const perItemPrice = item.basePrice + item.addedExtras.reduce((s, e) => s + (e.price * (e.quantity || 1)), 0);
                return { ...item, quantity: newQty, totalPrice: perItemPrice * newQty };
            }
            return item;
        }).filter(Boolean));
    };

    // Discount functions
    const validateDiscountCode = async () => {
        if (!discountCode.trim()) {
            toast.error('Lütfen bir kupon kodu girin.');
            return;
        }

        // Prevent reusing same coupon in this session
        if (appliedCoupon === discountCode.toUpperCase().trim()) {
            toast.error('Bu kuponu zaten kullandınız.');
            return;
        }

        // Prevent coupon reuse across sessions (localStorage)
        const normalizedCode = discountCode.toUpperCase().trim();
        if (usedCoupons.includes(normalizedCode)) {
            toast.error('Bu kuponu daha önce kullandınız.');
            return;
        }

        // Prevent multiple coupons
        if (discountResult?.valid) {
            toast.error('Zaten bir kupon uygulandı. Önce mevcut kuponu kaldırın.');
            return;
        }

        // Check if any cart item disallows coupons
        const nonCouponableItems = cart.filter(item => item.allow_coupon === false);
        if (nonCouponableItems.length > 0) {
            toast.error(`Sepetinizde kupon uygulanamayan ürün(ler) var: ${nonCouponableItems.map(i => i.name).join(', ')}`);
            return;
        }

        setDiscountLoading(true);
        try {
            const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
            const { data, error } = await supabase.rpc('validate_coupon', {
                p_code: discountCode.toUpperCase().trim(),
                p_cart_total: subtotal,
                p_tenant_id: tenant?.tenant_id || null
            });

            if (error) throw error;

            setDiscountResult(data);
            if (data.valid) {
                toast.success(data.message);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error('Coupon validation error:', error);
            toast.error('Kupon doğrulanamadı.');
            setDiscountResult(null);
        } finally {
            setDiscountLoading(false);
        }
    };

    const clearDiscount = () => {
        if (discountResult?.valid) {
            const code = discountCode.toUpperCase().trim();
            setAppliedCoupon(code); // Remember used coupon in session

            // Persist to localStorage for cross-session tracking
            const updatedUsed = [...usedCoupons, code];
            setUsedCoupons(updatedUsed);
            try {
                localStorage.setItem(`used_coupons_${slug}`, JSON.stringify(updatedUsed));
            } catch {
                // localStorage might be full or blocked
            }
        }
        setDiscountCode('');
        setDiscountResult(null);
    };



    const placeTableOrder = async () => {
        if (cart.length === 0) return;

        try {
            const loadingToast = toast.loading('Sipariş gönderiliyor...');

            const { data: order, error: orderError } = await supabase
                .from('pos_orders')
                .insert({
                    tenant_id: tenant.tenant_id || tenant.id,
                    status: 'pending',
                    total: finalTotal,
                    discount_code: discountResult?.valid ? discountCode.toUpperCase().trim() : null,
                    discount_amount: discountResult?.valid ? discountResult.amount : 0,
                    table_number: tableNumber ? parseInt(tableNumber) : null,
                    note: table ? `Masa ${tableNumber} - QR Sipariş` : 'Dijital Menü Siparişi',
                    order_source: 'qr_menu'
                })
                .select()
                .single();

            if (orderError) throw orderError;

            if (discountResult?.valid && discountCode) {
                await supabase.rpc('use_coupon', { p_code: discountCode.toUpperCase().trim() });
            }

            const items = cart.map(item => ({
                tenant_id: tenant.tenant_id || tenant.id,
                pos_order_id: order.id,
                product_id: item.id,
                product_name: item.name,
                unit_price: item.basePrice,
                quantity: item.quantity,
                modifications: JSON.stringify({
                    removed: item.removedIngredients,
                    extras: item.addedExtras,
                    note: item.note
                })
            }));

            await supabase.from('pos_order_items').insert(items);

            toast.dismiss(loadingToast);
            setOrderSent(true);
            setCart([]);
            clearDiscount();
            toast.success('Siparişiniz Mutfakta! 👨‍🍳');
        } catch (error) {
            console.error('Order Error:', error);
            toast.dismiss();
            toast.error('Sipariş gönderilemedi: ' + (error.message || 'Bilinmeyen hata'));
        }
    };

    const isStoreOpen = () => {
        const settings = tenant?.store_settings;
        if (!settings?.operating_hours) return true;

        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = days[now.getDay()];
        const dayHours = settings.operating_hours[currentDay];

        if (!dayHours || dayHours.closed) return false;

        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
        const [openH, openM] = (dayHours.open || '09:00').split(':').map(Number);
        const [closeH, closeM] = (dayHours.close || '23:00').split(':').map(Number);

        const openTimeInMinutes = openH * 60 + openM;
        const closeTimeInMinutes = closeH * 60 + closeM;

        return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
    };

    const isOpen = isStoreOpen();

    // Primary gradient helper
    const primaryGradient = `linear-gradient(135deg, ${branding.primary_color}, ${branding.accent_color})`;

    // ==================== RENDER STATES ====================

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: primaryGradient }}>
                <div className="text-center text-white">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-medium animate-pulse">Menü Yükleniyor...</p>
                </div>
            </div>
        );
    }

    // Not found state
    if (notFound) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ background: primaryGradient }}>
                <div className="text-center text-white">
                    <div className="text-8xl mb-6 animate-bounce">🍽️</div>
                    <h1 className="text-3xl font-bold mb-3">Menü Bulunamadı</h1>
                    <p className="text-white/80">Bu restoran mevcut değil veya menü aktif değil.</p>
                </div>
            </div>
        );
    }

    // Order success state
    if (orderSent) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: `linear-gradient(135deg, #10B981, #059669)` }}>
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <ChefHat className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">Siparişiniz Alındı!</h1>
                <p className="text-white/80 mb-8">Mutfağımız siparişinizi hazırlamaya başladı.</p>
                <button
                    onClick={() => setOrderSent(false)}
                    className="bg-white text-green-600 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                >
                    Menüye Dön
                </button>
            </div>
        );
    }

    // ==================== SPLASH SCREEN ====================
    if (showSplash) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
                style={{ background: primaryGradient }}
            >
                {/* Watermark Background */}
                <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none opacity-10">
                    {branding.logo_url ? (
                        <img
                            src={branding.logo_url}
                            alt="Watermark"
                            className="w-[150%] max-w-none grayscale blur-sm animate-slowSpin"
                        />
                    ) : (
                        <div className="text-[400px]">🍽️</div>
                    )}
                </div>

                {/* Animated background circles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-1/4 -right-1/4 w-2/3 h-2/3 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 text-center animate-fadeIn">
                    {/* Logo */}
                    <div className="mb-10 relative group">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-white/30 rounded-full blur-2xl transform scale-110 group-hover:scale-125 transition-transform duration-700"></div>

                        {branding.logo_url ? (
                            <img
                                src={branding.logo_url}
                                alt={tenant?.company_name}
                                className="w-48 h-48 md:w-64 md:h-64 rounded-[2rem] mx-auto shadow-2xl object-cover border-4 border-white/30 relative z-10 animate-breathe"
                            />
                        ) : (
                            <div className="w-48 h-48 md:w-64 md:h-64 bg-white/20 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl border-4 border-white/30 relative z-10 backdrop-blur-md animate-breathe">
                                <Utensils className="w-24 h-24 md:w-32 md:h-32 text-white" />
                            </div>
                        )}
                    </div>

                    {/* Restaurant name */}
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                        {tenant?.company_name}
                    </h1>

                    {/* Tagline */}
                    <p className="text-white/80 text-lg md:text-xl mb-2">Dijital Menü</p>

                    {table && (
                        <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-white mb-8">
                            <MapPin className="w-4 h-4" />
                            <span>Masa {tableNumber}</span>
                        </div>
                    )}

                    {/* View Menu Button */}
                    <button
                        onClick={() => setShowSplash(false)}
                        className="mt-8 bg-white text-gray-900 px-10 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto animate-buttonPulse"
                        style={{ color: branding.primary_color }}
                    >
                        <span>Menüyü Gör</span>
                        <ArrowRight className="w-6 h-6" />
                    </button>
                </div>

                {/* Custom animations */}
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes breathe {
                        0%, 100% { transform: scale(1); filter: brightness(1); }
                        50% { transform: scale(1.05); filter: brightness(1.1); }
                    }
                    @keyframes slowSpin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
                    .animate-breathe { animation: breathe 4s ease-in-out infinite; }
                    .animate-buttonPulse { animation: buttonPulse 2s ease-in-out infinite; }
                    .animate-slowSpin { animation: slowSpin 60s linear infinite; }
                `}</style>
            </div>
        );
    }

    // ==================== MAIN MENU ====================
    return (
        <div
            className="min-h-screen pb-32"
            style={{
                backgroundColor: branding.background_type === 'dark' ? branding.secondary_color : '#FAFAFA',
                fontFamily: branding.font_family
            }}
        >
            {/* BACKGROUND DECORATION - Watermark Pattern */}
            <div
                className="fixed inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-multiply"
                style={{
                    backgroundImage: branding.logo_url ? `url(${branding.logo_url})` : 'none',
                    backgroundRepeat: 'repeat',
                    backgroundSize: '120px',
                    backgroundPosition: 'center'
                }}
            />

            {/* Top Gradient Fade (Subtle) */}
            <div
                className="absolute top-0 left-0 right-0 h-40 pointer-events-none z-0"
                style={{ background: `linear-gradient(to bottom, ${branding.primary_color}10, transparent)` }}
            />

            {/* Header Closed Warning */}
            {!isOpen && (
                <div className="relative z-50 bg-red-500 text-white text-center py-2 text-sm font-bold sticky top-0">
                    ⚠️ Restoran Şu An Kapalı. Sipariş Alınmamaktadır.
                </div>
            )}

            {/* 2. STICKY NAVIGATION BAR */}
            <div className="sticky top-0 z-30 transition-all duration-300">
                {/* Search & Cart Bar */}
                <div className="bg-white/85 backdrop-blur-md shadow-sm border-b border-gray-100/50 supports-[backdrop-filter]:bg-white/60">
                    <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

                        {/* Brand Area */}
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="relative group">
                                {/* Logo */}
                                {branding.logo_url ? (
                                    <img
                                        src={branding.logo_url}
                                        alt="Logo"
                                        className="w-12 h-12 rounded-xl object-cover shadow-md border border-white/50 group-hover:scale-105 transition-transform"
                                    />
                                ) : (
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md border border-white/50"
                                        style={{ background: primaryGradient }}
                                    >
                                        <Utensils className="w-6 h-6" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col justify-center min-w-0">
                                <h1 className="font-bold text-gray-900 text-lg leading-tight truncate pr-2">
                                    {tenant?.company_name}
                                </h1>
                                {table ? (
                                    <div className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full w-fit">
                                        <MapPin className="w-3 h-3" />
                                        <span>Masa {tableNumber}</span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-gray-400 font-medium truncate">Menüye Hoş Geldiniz</span>
                                )}
                            </div>
                        </div>

                        {/* Cart & Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowCart(true)}
                                className="relative group flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                                style={{ background: primaryGradient }}
                            >
                                <ShoppingCart className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                <span className="font-bold">{parseFloat(cartSubtotal).toFixed(0)}₺</span>
                                {cartCount > 0 && (
                                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Categories - Horizontal Scroll */}
                    <div className="flex overflow-x-auto gap-3 px-4 pb-3 pt-1 scrollbar-hide max-w-2xl mx-auto">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95 border ${activeCategory === cat
                                    ? 'text-white shadow-lg shadow-primary/30 border-transparent'
                                    : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                                    }`}
                                style={activeCategory === cat ? { background: primaryGradient } : {}}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Product Grid - 2 columns mobile, 4 columns desktop */}
            <div className="relative z-10 p-3 max-w-2xl md:max-w-5xl mx-auto">
                {/* Campaign / Notification Ticker - Moved Here */}
                {isOpen && (
                    <div className="mb-4 rounded-xl text-white text-center py-3 text-sm font-medium overflow-hidden relative shadow-lg transform hover:scale-[1.01] transition-all"
                        style={{ background: primaryGradient }}>
                        <div className="animate-marquee whitespace-nowrap inline-flex items-center gap-8 pl-4">
                            {/* Min Order Warning */}
                            {cartSubtotal < (tenant?.store_settings?.min_order_amount || 0) && (
                                <span className="flex items-center gap-2">
                                    📢 Minimum sipariş için <b>₺{(tenant.store_settings.min_order_amount - cartSubtotal).toFixed(2)}</b> daha ürün eklemelisiniz.
                                </span>
                            )}

                            {/* Free Delivery */}
                            {tenant?.store_settings?.free_delivery_threshold > 0 && cartSubtotal < tenant.store_settings.free_delivery_threshold && (
                                <span className="flex items-center gap-2">
                                    🚀 <b>₺{(tenant.store_settings.free_delivery_threshold - cartSubtotal).toFixed(2)}</b> daha ekleyin, TESLİMAT ÜCRETSİZ olsun!
                                </span>
                            )}

                            {/* Active Campaigns */}
                            {activeCampaigns.map(camp => (
                                <span key={camp.id} className="inline-flex items-center px-4 py-1 rounded-full bg-white/20 border border-white/40 shadow-sm backdrop-blur-md">
                                    <Star className="w-4 h-4 mr-2 text-yellow-300 fill-yellow-300 animate-pulse" />
                                    <span className="font-bold tracking-wide">
                                        {camp.name}: {camp.type === 'percent' ? `%${camp.rules.value} İndirim` : camp.type === 'amount' ? `₺${camp.rules.value} İndirim` : 'Süper Fırsat'}
                                    </span>
                                </span>
                            ))}

                            {/* Default Welcome */}
                            {activeCampaigns.length === 0 && cartSubtotal >= (tenant?.store_settings?.min_order_amount || 0) && (
                                <span>✨ Harika seçimler! Afiyet olsun.</span>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {filteredProducts.map((product, idx) => (
                        <div
                            key={product.id}
                            className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-[1.02] border border-gray-100"
                            onClick={() => openProductModal(product)}
                            style={{ animationDelay: `${idx * 30}ms` }}
                        >
                            {/* Product Image - Top */}
                            <div
                                className="w-full aspect-square flex items-center justify-center text-4xl"
                                style={{ background: `linear-gradient(135deg, ${branding.primary_color}15, ${branding.accent_color}15)` }}
                            >
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-5xl">🍔</span>
                                )}
                            </div>

                            {/* Product Info - Bottom */}
                            <div className="p-3">
                                <h3 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1 leading-tight">
                                    {product.name}
                                </h3>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        {(() => {
                                            const productCampaign = activeCampaigns.find(c =>
                                                c.type === 'product_discount' &&
                                                c.rules.target_product_id == product.id
                                            );

                                            if (productCampaign) {
                                                const discountedPrice = parseFloat(productCampaign.rules.value);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400 line-through decoration-red-500">
                                                            ₺{product.price}
                                                        </span>
                                                        <span
                                                            className="font-bold text-base animate-pulse"
                                                            style={{ color: branding.primary_color }}
                                                        >
                                                            ₺{discountedPrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <span
                                                    className="font-bold text-base"
                                                    style={{ color: branding.primary_color }}
                                                >
                                                    ₺{product.price}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openProductModal(product); }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow transition-transform hover:scale-110"
                                        style={{ background: primaryGradient }}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty state */}
                {filteredProducts.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-6xl mb-4">🍽️</div>
                        <p className="text-gray-500">Bu kategoride ürün bulunmuyor.</p>
                    </div>
                )}
            </div>

            {/* Floating Cart Bar */}
            {cart.length > 0 && !showCart && (
                <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-40">
                    <button
                        onClick={() => setShowCart(true)}
                        className="w-full p-4 rounded-2xl shadow-2xl flex justify-between items-center text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: primaryGradient }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center font-bold">
                                {cartCount}
                            </div>
                            <span className="font-semibold">Sepeti Gör</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {cartSubtotal < (tenant?.store_settings?.min_order_amount || 0) && (
                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full mr-2">
                                    ₺{(tenant.store_settings.min_order_amount - cartSubtotal).toFixed(2)} ekle
                                </span>
                            )}
                            <span className="font-bold text-lg">₺{finalTotal.toFixed(2)}</span>
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </button>
                </div>
            )}

            {/* Cart Drawer */}
            {showCart && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCart(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slideIn">
                        {/* Cart Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900">Sepetiniz ({cartCount})</h2>
                            <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-200 rounded-xl transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.map((item) => (
                                <div key={item.cartId} className="bg-gray-50 p-4 rounded-2xl">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{item.name}</h4>
                                            {item.customizationSummary && (
                                                <p className="text-xs text-gray-500 mt-1">{item.customizationSummary}</p>
                                            )}
                                        </div>
                                        <span className="font-bold" style={{ color: branding.primary_color }}>
                                            ₺{item.totalPrice.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
                                            <button
                                                onClick={() => updateCartItemQuantity(item.cartId, -1)}
                                                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-8 text-center font-bold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateCartItemQuantity(item.cartId, 1)}
                                                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.cartId)}
                                            className="text-red-500 text-sm font-medium hover:text-red-700"
                                        >
                                            Kaldır
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cart Footer */}
                        <div className="border-t p-4 bg-white space-y-4">
                            {/* Discount Code */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="İndirim Kodu"
                                    value={discountCode}
                                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                                    disabled={discountLoading || discountResult?.valid}
                                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 disabled:bg-gray-100"
                                />
                                {discountResult?.valid ? (
                                    <button
                                        onClick={clearDiscount}
                                        className="px-4 py-3 bg-red-500 text-white rounded-xl text-sm font-medium"
                                    >
                                        Kaldır
                                    </button>
                                ) : (
                                    <button
                                        onClick={validateDiscountCode}
                                        disabled={discountLoading || !discountCode.trim()}
                                        className="px-4 py-3 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                                    >
                                        {discountLoading ? '...' : 'Uygula'}
                                    </button>
                                )}
                            </div>

                            {discountResult && (
                                <div className={`text-sm p-3 rounded-xl ${discountResult.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {discountResult.message}
                                </div>
                            )}

                            {/* Price Summary */}
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Ara Toplam</span>
                                    <span>₺{cartSubtotal.toFixed(2)}</span>
                                </div>
                                {discountResult?.valid && (
                                    <div className="flex justify-between text-green-600 font-medium">
                                        <span>İndirim ({discountCode})</span>
                                        <span>-₺{discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                                    <span>Toplam</span>
                                    <span style={{ color: branding.primary_color }}>₺{finalTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Order Buttons */}
                            <div className="space-y-3">
                                {cartSubtotal < (tenant?.store_settings?.min_order_amount || 0) && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-700 text-sm">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <span>
                                            Minimum sipariş için sepete <b>₺{(tenant.store_settings.min_order_amount - cartSubtotal).toFixed(2)}</b> tutarında ürün eklemelisiniz.
                                        </span>
                                    </div>
                                )}
                                {!isOpen && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm font-semibold">
                                        <Clock className="w-5 h-5 flex-shrink-0" />
                                        <span>Üzgünüz, şu an kapalıyız.</span>
                                    </div>
                                )}
                                <button
                                    onClick={placeTableOrder}
                                    disabled={cartSubtotal < (tenant?.store_settings?.min_order_amount || 0) || !isOpen}
                                    className="w-full py-4 rounded-2xl font-bold text-white text-lg shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                    style={{ background: primaryGradient }}
                                >
                                    {tableNumber ? `Masa ${tableNumber}'e Sipariş Ver` : 'Masaya Sipariş Ver'}
                                </button>
                                <button
                                    onClick={() => {
                                        const phone = searchParams.get('phone');
                                        const checkoutUrl = `/m/${slug}/checkout${phone ? `?phone=${phone}` : ''}`;
                                        navigate(checkoutUrl, {
                                            state: {
                                                cart,
                                                tenant,
                                                branding,
                                                tableNumber,
                                                slug,
                                                activeCampaigns,
                                                autoDiscount: discountResult
                                            }
                                        });
                                    }}
                                    disabled={cartSubtotal < (tenant?.store_settings?.min_order_amount || 0) || !isOpen}
                                    className="w-full py-4 rounded-2xl font-bold text-white text-lg shadow-lg bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <CreditCard className="w-5 h-5" />
                                    Ödemeye Geç
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Detail Modal */}
            <ProductDetailModal
                product={selectedProduct}
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedProduct(null); }}
                onAddToCart={addCustomizedToCart}
                branding={branding}
                activeCampaigns={activeCampaigns}
            />

            {/* Global Animations */}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slideIn { animation: slideIn 0.3s ease-out forwards; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default SlugMenuPage;
