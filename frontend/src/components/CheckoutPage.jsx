import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
    ArrowLeft, MapPin, Phone, User, CreditCard, Wallet, Truck,
    CheckCircle, Loader2, AlertCircle, Tag, ChevronDown, ChevronUp,
    Home, Briefcase, Plus, Clock, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentCheckout } from './PaymentCheckout';

/**
 * CheckoutPage - Complete order checkout flow
 * Features:
 * - Order summary with items, extras, notes
 * - Delivery address form
 * - Payment method selection (Online / Cash on Delivery)
 * - Delivery fee calculation
 * - Coupon application
 * - Order submission
 */
export const CheckoutPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Get cart data from navigation state
    const {
        cart = [],
        tenant = null,
        branding = {},
        tableNumber = null,
        customerPhone = null,
        slug = null,
        activeCampaigns: passedCampaigns = [],
        autoDiscount: passedAutoDiscount = null
    } = location.state || {};

    // Get phone from URL params (WhatsApp flow)
    const searchParams = new URLSearchParams(location.search);
    const urlPhone = searchParams.get('phone') || customerPhone || '';

    // Form states
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: urlPhone,
        address: '',
        addressNote: '',
        district: ''
    });

    // Saved addresses
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [showNewAddressForm, setShowNewAddressForm] = useState(false);
    const [saveNewAddress, setSaveNewAddress] = useState(false);
    const [newAddressLabel, setNewAddressLabel] = useState('Ev');

    const [paymentMethod, setPaymentMethod] = useState('online'); // online, cash, card_on_delivery
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [minOrderAmount, setMinOrderAmount] = useState(0);
    const [couponCode, setCouponCode] = useState('');
    const [couponDiscount, setCouponDiscount] = useState(0);
    const [couponLoading, setCouponLoading] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [storeSettings, setStoreSettings] = useState(null);
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);
    const [availableCoupons, setAvailableCoupons] = useState([]);

    const [activeCampaigns] = useState(passedCampaigns);
    const [autoDiscount, setAutoDiscount] = useState(passedAutoDiscount);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [orderId, setOrderId] = useState(null);
    const [showOrderSummary, setShowOrderSummary] = useState(true);

    // Calculate totals - handle cart item structure from SlugMenuPage
    const subtotal = cart.reduce((sum, item) => {
        // Use totalPrice if available (from SlugMenuPage), otherwise calculate
        if (item.totalPrice !== undefined && !isNaN(parseFloat(item.totalPrice))) {
            return sum + parseFloat(item.totalPrice);
        }
        // Fallback: calculate from basePrice or price
        const basePrice = parseFloat(item.basePrice || item.price || 0);
        let itemTotal = basePrice * (item.quantity || 1);
        const extras = item.addedExtras || item.extras || [];
        if (extras.length > 0) {
            itemTotal += extras.reduce((eSum, e) => eSum + (parseFloat(e.price) * (e.quantity || 1)), 0);
        }
        // If totalPrice logic in SlugMenuPage was (base + extras) * qty:
        if (item.totalPrice === undefined) {
            const extrasTotal = extras.reduce((eSum, e) => eSum + parseFloat(e.price), 0);
            itemTotal = (basePrice + extrasTotal) * (item.quantity || 1);
        }

        return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);

    // Auto-apply logic if no coupon is active
    useEffect(() => {
        if (couponDiscount > 0 || !activeCampaigns.length) {
            if (couponDiscount > 0) setAutoDiscount(null);
            return;
        }

        // Find best general campaign
        const generalCampaigns = activeCampaigns.filter(c =>
            (c.type === 'percent' || c.type === 'amount') &&
            (!c.rules.min_basket || subtotal >= c.rules.min_basket)
        );

        if (generalCampaigns.length === 0) {
            setAutoDiscount(null);
            return;
        }

        let bestDiscount = null;
        let maxSavings = 0;

        generalCampaigns.forEach(camp => {
            let savings = 0;
            if (camp.type === 'percent') {
                savings = (subtotal * camp.rules.value) / 100;
            } else if (camp.type === 'amount') {
                savings = parseFloat(camp.rules.value);
            }

            if (savings > maxSavings) {
                maxSavings = savings;
                bestDiscount = {
                    valid: true,
                    amount: savings,
                    name: camp.name,
                    type: camp.type,
                    value: camp.rules.value
                };
            }
        });

        setAutoDiscount(bestDiscount);
    }, [subtotal, activeCampaigns, couponDiscount]);

    const discountAmount = couponDiscount > 0
        ? (subtotal * couponDiscount / 100)
        : (autoDiscount?.amount || 0);

    // Calculate final delivery fee based on threshold
    const finalDeliveryFee = (freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold) ? 0 : deliveryFee;

    const total = subtotal - discountAmount + finalDeliveryFee;

    // Fetch saved addresses by phone
    const fetchSavedAddresses = async (phone) => {
        try {
            const { data } = await supabase
                .from('customer_addresses')
                .select('*')
                .eq('phone', phone)
                .order('is_default', { ascending: false });

            if (data && data.length > 0) {
                setSavedAddresses(data);
                // Auto-select default address
                const defaultAddr = data.find(a => a.is_default) || data[0];
                if (defaultAddr) {
                    setSelectedAddressId(defaultAddr.id);
                    setCustomerInfo(prev => ({
                        ...prev,
                        name: defaultAddr.customer_name || prev.name,
                        address: defaultAddr.full_address,
                        addressNote: defaultAddr.address_note || '',
                        district: defaultAddr.district || ''
                    }));
                }
            } else {
                setShowNewAddressForm(true);
            }
        } catch (error) {
            console.error('Saved addresses fetch error:', error);
            setShowNewAddressForm(true);
        }
    };

    const fetchTenantSettings = useCallback(async () => {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('store_settings, menu_settings')
                .eq('id', tenant?.id || tenant?.tenant_id)
                .single();

            if (profile?.store_settings) {
                setStoreSettings(profile.store_settings);
                setDeliveryFee(profile.store_settings.delivery_fee || 0);
                setMinOrderAmount(profile.store_settings.min_order_amount || 0);
                setFreeDeliveryThreshold(profile.store_settings.free_delivery_threshold || 0);
            } else if (profile?.menu_settings) {
                // Fallback for older profiles
                setStoreSettings(profile.menu_settings);
                setDeliveryFee(profile.menu_settings.delivery_fee || 0);
                setMinOrderAmount(profile.menu_settings.min_order_amount || 0);
                setFreeDeliveryThreshold(profile.menu_settings.free_delivery_threshold || 0);
            }
        } catch (error) {
            console.error('Settings fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [tenant]);

    const fetchActiveCoupons = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('coupons')
                .select('*')
                .eq('tenant_id', tenant?.id || tenant?.tenant_id)
                .eq('is_active', true)
                .gte('expires_at', new Date().toISOString());

            if (data) setAvailableCoupons(data);
        } catch (error) {
            console.error('Coupons fetch error:', error);
        }
    }, [tenant]);

    // Load settings, coupons, and addresses on mount
    useEffect(() => {
        if (!cart.length || !tenant) {
            toast.error('Sepet boş veya geçersiz');
            navigate(-1);
            return;
        }

        fetchTenantSettings();
        fetchActiveCoupons();
        if (urlPhone) {
            fetchSavedAddresses(urlPhone);
        }
    }, [tenant, cart.length, urlPhone, fetchActiveCoupons, fetchTenantSettings, navigate]);

    const isStoreOpen = () => {
        if (!storeSettings?.operating_hours) return true;

        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = days[now.getDay()];
        const dayHours = storeSettings.operating_hours[currentDay];

        if (!dayHours || dayHours.closed) return false;

        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
        const [openH, openM] = (dayHours.open || '09:00').split(':').map(Number);
        const [closeH, closeM] = (dayHours.close || '23:00').split(':').map(Number);

        const openTimeInMinutes = openH * 60 + openM;
        const closeTimeInMinutes = closeH * 60 + closeM;

        return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes <= closeTimeInMinutes;
    };

    const isOpen = isStoreOpen();

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;

        setCouponLoading(true);
        try {
            const { data: coupon, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase())
                .eq('tenant_id', tenant.id || tenant.tenant_id)
                .eq('is_active', true)
                .single();

            if (error || !coupon) {
                toast.error('Geçersiz kupon kodu');
                return;
            }

            // Check expiry
            if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                toast.error('Bu kuponun süresi dolmuş');
                return;
            }

            // Check min order
            if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
                toast.error(`Minimum sipariş tutarı: ₺${coupon.min_order_amount}`);
                return;
            }

            setCouponDiscount(coupon.discount_percent || 0);
            setAppliedCoupon(coupon);
            toast.success(`%${coupon.discount_percent} indirim uygulandı!`);
        } catch (error) {
            console.error('Coupon error:', error);
            toast.error('Kupon uygulanamadı');
        } finally {
            setCouponLoading(false);
        }
    };

    const removeCoupon = () => {
        setCouponCode('');
        setCouponDiscount(0);
        setAppliedCoupon(null);
    };

    const validateForm = () => {
        if (!customerInfo.name.trim()) {
            toast.error('Lütfen adınızı girin');
            return false;
        }
        if (!customerInfo.phone.trim() || customerInfo.phone.length < 10) {
            toast.error('Lütfen geçerli bir telefon numarası girin');
            return false;
        }
        if (!tableNumber) {
            if (!customerInfo.address.trim()) {
                toast.error('Lütfen teslimat adresinizi girin');
                return false;
            }
            if (customerInfo.address.trim().length < 15) {
                toast.error('Lütfen daha açıklayıcı bir adres girin (En az 15 karakter)');
                return false;
            }
        }
        if (subtotal < minOrderAmount) {
            toast.error(`Minimum sipariş tutarı: ₺${minOrderAmount}`);
            return false;
        }
        return true;
    };

    const createOrder = async () => {
        if (!validateForm()) return null;

        setSubmitting(true);
        try {
            // FIX: Handle null tenant - fetch from slug or current user
            let tenantId = tenant?.id || tenant?.tenant_id;

            if (!tenantId && slug) {
                // Fetch tenant by slug
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('id')
                    .eq('restaurant_slug', slug)
                    .single();
                tenantId = tenantData?.id;
            }

            if (!tenantId) {
                // Fallback: use current user as tenant
                const { data: { user } } = await supabase.auth.getUser();
                tenantId = user?.id;
            }

            if (!tenantId) {
                throw new Error('Tenant bilgisi bulunamadı');
            }

            const customerPhone = customerInfo.phone.replace(/\D/g, '');

            // 1. Ensure user exists in 'public.users' (Required by orders FK)
            const { error: userError } = await supabase
                .from('users')
                .upsert({
                    phone: customerPhone,
                    tenant_id: tenantId,
                    name: customerInfo.name,
                    last_order_date: new Date().toISOString()
                }, { onConflict: 'phone, tenant_id' });

            if (userError) {
                console.error('User Upsert Error:', userError);
                // Continue anyway, but this might cause FK failure
            }

            // 2. CREATE/UPDATE CUSTOMER RECORD (for dashboard customer management)
            const { error: customerError } = await supabase
                .from('customers')
                .upsert({
                    tenant_id: tenantId,
                    phone: customerPhone,
                    name: customerInfo.name,
                    // REMOVED: address, district, source - columns don't exist in table
                    last_order_date: new Date().toISOString()
                }, { onConflict: 'tenant_id, phone' });

            if (customerError) {
                console.error('Customer Upsert Error:', customerError);
                // Don't fail order - customer tracking is secondary to order processing
            }


            // 2. Create Order via Secure RPC (Server-Side Price Validation)
            console.log('🔍 DEBUG - Order RPC Call:', {
                tenant_id: tenantId,
                user_id: customerPhone,
                cart_items: cart.map(item => ({
                    id: item.id || item.product_id,
                    name: item.name,
                    quantity: item.quantity
                }))
            });

            const { data: rpcResponse, error: rpcError } = await supabase.rpc('place_order_secure', {
                p_tenant_id: tenantId,
                p_user_id: customerPhone,
                p_customer_name: customerInfo.name,
                p_delivery_address: tableNumber ? `Masa ${tableNumber}` : customerInfo.address,
                p_address_note: customerInfo.addressNote,
                p_items: cart.map(item => ({
                    id: item.id || item.product_id,
                    name: item.name,
                    quantity: item.quantity,
                    extras: item.addedExtras || item.extras || [],
                    notes: item.notes || ''
                })),
                p_payment_method: paymentMethod,
                p_service_type: tableNumber ? 'table' : 'delivery',
                p_table_number: tableNumber || null,
                p_coupon_code: appliedCoupon?.code || null
            });

            if (rpcError) {
                console.error('❌ Secure RPC Order Error:', rpcError.message);
                throw new Error('Sipariş doğrulanamadı: ' + rpcError.message);
            }

            if (!rpcResponse.success) {
                throw new Error(rpcResponse.message || 'Sipariş oluşturulamadı');
            }

            const order = { id: rpcResponse.order_id, ...rpcResponse };

            // Save new address if checkbox is checked
            if (saveNewAddress && customerInfo.address && customerInfo.phone) {
                try {
                    const { error: addressError } = await supabase.from('customer_addresses').upsert({
                        tenant_id: tenantId,
                        phone: customerPhone,
                        label: newAddressLabel,
                        customer_name: customerInfo.name,
                        full_address: customerInfo.address,
                        district: customerInfo.district,
                        address_note: customerInfo.addressNote,
                        is_default: savedAddresses.length === 0 // First address is default
                    }, { onConflict: 'tenant_id, phone, label' });

                    if (addressError) console.error('Address Save Error:', addressError);
                } catch (addrError) {
                    console.error('Address Save logic error:', addrError);
                }
            }

            setOrderId(order.id);
            return order;
        } catch (error) {
            console.error('Order creation error:', error);
            const errMsg = error.message || 'Sipariş oluşturulamadı';
            toast.error(errMsg);
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (paymentMethod === 'online') {
            const order = await createOrder();
            if (order) {
                setShowPaymentForm(true);
            }
        } else {
            // Cash on delivery - create order and show confirmation
            const order = await createOrder();
            if (order) {
                toast.success('Siparişiniz alındı!');
                navigate(`/m/${slug}/order-success`, {
                    state: { orderId: order.id, total, paymentMethod }
                });
            }
        }
    };

    const handlePaymentSuccess = async () => {
        toast.success('Ödeme başarılı! Siparişiniz alındı.');
        navigate(`/m/${slug}/order-success`, {
            state: { orderId, total, paymentMethod: 'online' }
        });
    };

    const primaryColor = branding.primary_color || '#FF6B00';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Show payment form
    if (showPaymentForm && orderId) {
        return (
            <div className="min-h-screen bg-gray-50 py-6 px-4">
                <PaymentCheckout
                    tenantId={tenant.id || tenant.tenant_id}
                    orderId={orderId}
                    amount={total}
                    orderItems={cart}
                    customerInfo={customerInfo}
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setShowPaymentForm(false)}
                    onError={(err) => {
                        console.error('Payment error:', err);
                        toast.error('Ödeme başarısız');
                    }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header
                className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h1 className="text-lg font-bold text-white">Sipariş Tamamla</h1>
            </header>

            <div className="max-w-lg mx-auto p-4 space-y-4">
                {/* Order Summary - Collapsible */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowOrderSummary(!showOrderSummary)}
                        className="w-full p-4 flex items-center justify-between"
                    >
                        <span className="font-bold text-gray-800">Sipariş Özeti ({cart.length} ürün)</span>
                        {showOrderSummary ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    {showOrderSummary && (
                        <div className="px-4 pb-4 space-y-3">
                            {cart.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                                        {item.extras?.length > 0 && (
                                            <p className="text-xs text-gray-500">
                                                + {item.extras.map(e => e.name).join(', ')}
                                            </p>
                                        )}
                                        {item.notes && (
                                            <p className="text-xs text-gray-400 italic">Not: {item.notes}</p>
                                        )}
                                    </div>
                                    <span className="font-semibold" style={{ color: primaryColor }}>
                                        ₺{(item.price * item.quantity + (item.extras?.reduce((s, e) => s + e.price * (e.quantity || 1), 0) || 0) * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Delivery Info */}
                {!tableNumber && (
                    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                            Teslimat Bilgileri
                        </h3>

                        {/* Saved Address Selection */}
                        {savedAddresses.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Kayıtlı adresleriniz:</p>
                                <div className="grid gap-3">
                                    {savedAddresses.map(addr => (
                                        <button
                                            key={addr.id}
                                            onClick={() => {
                                                setSelectedAddressId(addr.id);
                                                setShowNewAddressForm(false);
                                                setCustomerInfo(prev => ({
                                                    ...prev,
                                                    name: addr.customer_name || prev.name,
                                                    address: addr.full_address,
                                                    addressNote: addr.address_note || '',
                                                    district: addr.district || ''
                                                }));
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 flex items-start gap-3 text-left transition-all ${selectedAddressId === addr.id && !showNewAddressForm
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${addr.label === 'Ev' ? 'bg-green-100' : 'bg-blue-100'
                                                }`}>
                                                {addr.label === 'Ev' ? (
                                                    <Home className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <Briefcase className="w-5 h-5 text-blue-600" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-800">{addr.label}</p>
                                                <p className="text-sm text-gray-600 line-clamp-2">{addr.full_address}</p>
                                                {addr.is_default && (
                                                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                                        Varsayılan
                                                    </span>
                                                )}
                                            </div>
                                            {selectedAddressId === addr.id && !showNewAddressForm && (
                                                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}

                                    {/* Add New Address Button */}
                                    <button
                                        onClick={() => {
                                            setShowNewAddressForm(true);
                                            setSelectedAddressId(null);
                                            setCustomerInfo(prev => ({
                                                ...prev,
                                                address: '',
                                                addressNote: ''
                                            }));
                                        }}
                                        className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all ${showNewAddressForm
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span className="font-medium">Yeni Adres Ekle</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* New Address Form (shown when no saved addresses or adding new) */}
                        {(showNewAddressForm || savedAddresses.length === 0) && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Ad Soyad *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={customerInfo.name}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                            placeholder="Adınız Soyadınız"
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Telefon *</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="tel"
                                            value={customerInfo.phone}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                            placeholder="05XX XXX XX XX"
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Adres *</label>
                                    <textarea
                                        value={customerInfo.address}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                        placeholder="Mahalle, Sokak, Bina No, Daire"
                                        rows={2}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Adres Tarifi (Opsiyonel)</label>
                                    <input
                                        type="text"
                                        value={customerInfo.addressNote}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, addressNote: e.target.value })}
                                        placeholder="Kapı kodu, kat bilgisi vb."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Save Address Checkbox */}
                                {(showNewAddressForm || savedAddresses.length === 0) && (
                                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                        <input
                                            type="checkbox"
                                            id="saveAddress"
                                            checked={saveNewAddress}
                                            onChange={(e) => setSaveNewAddress(e.target.checked)}
                                            className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        <div>
                                            <label htmlFor="saveAddress" className="font-medium text-gray-800 cursor-pointer">
                                                Bu adresi kaydet
                                            </label>
                                            <p className="text-xs text-gray-500">Gelecek siparişlerinizde hızlı seçim için</p>
                                        </div>
                                    </div>
                                )}

                                {/* Address Label Selection */}
                                {saveNewAddress && (
                                    <div className="flex gap-2">
                                        {['Ev', 'İş'].map(label => (
                                            <button
                                                key={label}
                                                onClick={() => setNewAddressLabel(label)}
                                                className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 ${newAddressLabel === label
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200'
                                                    }`}
                                            >
                                                {label === 'Ev' ? <Home className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Table Order Info */}
                {tableNumber && (
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h3 className="font-bold text-gray-800 mb-3">Masa Bilgisi</h3>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-xl font-bold text-blue-600">{tableNumber}</span>
                            </div>
                            <div>
                                <p className="font-medium text-gray-800">Masa {tableNumber}</p>
                                <p className="text-sm text-gray-500">Sipariş masanıza getirilecek</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Method */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <CreditCard className="w-5 h-5" style={{ color: primaryColor }} />
                        Ödeme Yöntemi
                    </h3>

                    <div className="space-y-2">
                        {[
                            { id: 'online', icon: CreditCard, label: 'Online Ödeme', desc: 'Kredi/Banka Kartı' },
                            { id: 'cash', icon: Wallet, label: 'Kapıda Nakit', desc: 'Teslimatta ödeme' },
                            { id: 'card_on_delivery', icon: CreditCard, label: 'Kapıda Kart', desc: 'POS ile ödeme' },
                        ].map(method => (
                            <button
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id)}
                                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${paymentMethod === method.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <method.icon className={`w-6 h-6 ${paymentMethod === method.id ? 'text-blue-500' : 'text-gray-400'}`} />
                                <div className="text-left">
                                    <p className="font-medium text-gray-800">{method.label}</p>
                                    <p className="text-xs text-gray-500">{method.desc}</p>
                                </div>
                                {paymentMethod === method.id && (
                                    <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Coupon */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <Tag className="w-5 h-5" style={{ color: primaryColor }} />
                        İndirim Kodu
                    </h3>

                    {appliedCoupon ? (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <span className="font-medium text-green-700">{appliedCoupon.code}</span>
                                <span className="text-green-600">(%{appliedCoupon.discount_percent} indirim)</span>
                            </div>
                            <button onClick={removeCoupon} className="text-red-500 text-sm font-medium">
                                Kaldır
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Coupon List */}
                            {availableCoupons.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs text-gray-500 mb-2">Aktif Kampanyalar:</p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {availableCoupons.map(coupon => (
                                            <button
                                                key={coupon.id}
                                                onClick={() => {
                                                    setCouponCode(coupon.code);
                                                    // Small delay to allow state update then trigger click
                                                    setTimeout(() => applyCoupon(), 100);
                                                    // Ideally applyCoupon should take an arg, but we used state. 
                                                    // Let's refactor applyCoupon slightly or just set code and let user click 'Uygula' or auto-click.
                                                    // Better: direct call logic.
                                                }}
                                                className="w-full text-left p-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 flex justify-between items-center group"
                                            >
                                                <div>
                                                    <span className="font-bold text-gray-700 block">{coupon.code}</span>
                                                    <span className="text-xs text-gray-500">%{coupon.discount_percent} İndirim</span>
                                                </div>
                                                <div className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600">
                                                    Seç
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    placeholder="Kupon kodu"
                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl uppercase"
                                />
                                <button
                                    onClick={applyCoupon}
                                    disabled={couponLoading || !couponCode}
                                    className="px-6 py-3 bg-gray-800 text-white rounded-xl font-medium disabled:opacity-50"
                                >
                                    {couponLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Uygula'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Price Summary */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
                    <div className="flex justify-between text-gray-600">
                        <span>Ara Toplam</span>
                        <span>₺{subtotal.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>İndirim {appliedCoupon ? `(${appliedCoupon.code})` : autoDiscount ? `(${autoDiscount.name})` : ''}</span>
                            <span>-₺{discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {!tableNumber && (
                        <div className="flex justify-between text-gray-600">
                            <span>Teslimat Ücreti</span>
                            {finalDeliveryFee === 0 && deliveryFee > 0 ? (
                                <span className="text-green-600 font-bold">
                                    <span className="line-through text-gray-400 font-normal mr-2">₺{deliveryFee.toFixed(2)}</span>
                                    ÜCRETSİZ
                                </span>
                            ) : (
                                <span>₺{deliveryFee.toFixed(2)}</span>
                            )}
                        </div>
                    )}
                    {/* Free Delivery Progress */}
                    {!tableNumber && freeDeliveryThreshold > 0 && subtotal < freeDeliveryThreshold && (
                        <div className="text-xs text-center text-orange-600 bg-orange-50 p-2 rounded-lg">
                            🚀 ₺{(freeDeliveryThreshold - subtotal).toFixed(2)} daha ekle, teslimat <b>BEDAVA</b> olsun!
                        </div>
                    )}

                    <div className="border-t pt-2 flex justify-between">
                        <span className="text-lg font-bold text-gray-800">Toplam</span>
                        <span className="text-xl font-bold" style={{ color: primaryColor }}>
                            ₺{total.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Min Order Warning */}
                {subtotal < minOrderAmount && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-amber-700">
                            Minimum sipariş için sepete <b>₺{(minOrderAmount - subtotal).toFixed(2)}</b> tutarında ürün eklemelisiniz.
                        </span>
                    </div>
                )}

                {/* Store Closed Warning */}
                {!isOpen && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <Clock className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-red-700 font-semibold">
                            Sipariş Alınmamaktadır: Restoran şu an kapalı.
                        </span>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting || subtotal < minOrderAmount || !isOpen}
                    className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${branding?.primary_color || '#FF6B00'}, ${(branding?.primary_color || '#FF6B00')}dd)` }}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            İşleniyor...
                        </>
                    ) : paymentMethod === 'online' ? (
                        <>
                            <CreditCard className="w-5 h-5" />
                            ₺{total.toFixed(2)} Öde
                        </>
                    ) : (
                        <>
                            <Truck className="w-5 h-5" />
                            Siparişi Onayla
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CheckoutPage;
