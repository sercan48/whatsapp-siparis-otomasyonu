import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    X, Banknote, CreditCard, Globe, FileText,
    Percent, Check, Printer, ArrowLeft, CheckCircle, Split, Ticket, ChevronDown, Loader
} from 'lucide-react';
import toast from 'react-hot-toast';
import { printReceipt } from '../utils/receiptPrinter';

// Yemek Çeki Sağlayıcıları
const MEAL_VOUCHER_PROVIDERS = [
    { id: 'metropol', name: 'Metropol', color: 'bg-blue-600' },
    { id: 'edenred', name: 'Edenred', color: 'bg-red-500' },
    { id: 'sodexo', name: 'Sodexo', color: 'bg-orange-500' },
    { id: 'multinet', name: 'Multinet', color: 'bg-purple-600' },
    { id: 'setcard', name: 'Setcard', color: 'bg-green-600' },
    { id: 'ticket', name: 'Ticket', color: 'bg-pink-500' },
];

/**
 * TouchPaymentModal - Responsive ödeme ekranı
 * Features: Split bill, meal voucher, POS integration, responsive layout
 */
export const TouchPaymentModal = ({ table, session, onClose }) => {
    // Payment State
    const [receivedAmount, setReceivedAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [discount, setDiscount] = useState({ type: 'percent', value: 0 });
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Meal Voucher State
    const [showMealVoucherSelector, setShowMealVoucherSelector] = useState(false);
    const [selectedMealVoucher, setSelectedMealVoucher] = useState(null);

    // POS Confirmation State (for credit card)
    const [showPOSConfirmation, setShowPOSConfirmation] = useState(false);
    const [posStatus, setPosStatus] = useState('waiting'); // 'waiting' | 'processing' | 'success' | 'failed'

    // Order Items
    const [orderItems, setOrderItems] = useState([]);
    const [totalAmount, setTotalAmount] = useState(session?.total_amount || 0);

    // Split Bill State
    const [splitMode, setSplitMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    useEffect(() => {
        fetchOrderItems();
    }, [session]);

    const fetchOrderItems = async () => {
        if (!session?.id) return;

        const { data } = await supabase
            .from('pos_orders')
            .select(`*, items:pos_order_items(*)`)
            .eq('pos_session_id', session.id);

        if (data) {
            const allItems = data.flatMap(order => order.items || []);
            setOrderItems(allItems);
            const calculatedTotal = allItems.reduce((sum, item) =>
                sum + (item.price * item.quantity), 0
            );
            setTotalAmount(calculatedTotal || session?.total_amount || 0);
        }
    };

    // Toggle item selection for split bill
    const toggleItemSelection = (itemId) => {
        if (!splitMode) return;
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedItems(newSelected);
    };

    // Calculate selected items total
    const getSelectedTotal = () => {
        if (!splitMode || selectedItems.size === 0) {
            return totalAmount;
        }
        return orderItems
            .filter(item => selectedItems.has(item.id))
            .reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    // Calculate discounted total
    const getDiscountedTotal = () => {
        const baseTotal = getSelectedTotal();
        if (discount.type === 'percent') {
            return baseTotal * (1 - discount.value / 100);
        }
        return Math.max(0, baseTotal - discount.value);
    };

    const finalTotal = getDiscountedTotal();
    const received = parseFloat(receivedAmount.replace(',', '.')) || 0;
    const change = Math.max(0, received - finalTotal);

    // Numpad handler
    const handleNumpadPress = (value) => {
        if (value === 'C') {
            setReceivedAmount('');
        } else if (value === 'DEL') {
            setReceivedAmount(prev => prev.slice(0, -1));
        } else if (value === ',') {
            if (!receivedAmount.includes(',')) {
                setReceivedAmount(prev => prev + ',');
            }
        } else if (value === 'EXACT') {
            setReceivedAmount(finalTotal.toFixed(2).replace('.', ','));
        } else {
            setReceivedAmount(prev => prev + value);
        }
    };

    // Quick amount buttons
    const handleQuickAmount = (amount) => {
        const current = parseFloat(receivedAmount.replace(',', '.')) || 0;
        const newAmount = current + amount;
        setReceivedAmount(newAmount.toString().replace('.', ','));
    };

    // Round up function
    const handleRoundUp = () => {
        const rounded = Math.ceil(finalTotal / 5) * 5;
        setReceivedAmount(rounded.toString());
    };

    // Process Payment
    const handlePayment = async () => {
        if (!paymentMethod) {
            toast.error('Lütfen ödeme yöntemi seçin');
            return;
        }

        // Credit card requires POS confirmation
        if (paymentMethod === 'credit_card' && !showPOSConfirmation) {
            setShowPOSConfirmation(true);
            setPosStatus('waiting');
            return;
        }

        // Meal voucher requires provider selection
        if (paymentMethod === 'meal_voucher' && !selectedMealVoucher) {
            toast.error('Lütfen yemek çeki sağlayıcısı seçin');
            return;
        }

        if (paymentMethod === 'cash' && received < finalTotal) {
            toast.error('Yetersiz tutar');
            return;
        }

        setProcessing(true);

        try {
            // If split mode, mark selected items as paid
            if (splitMode && selectedItems.size > 0) {
                // Mark items as paid
                await supabase
                    .from('pos_order_items')
                    .update({ is_paid: true, paid_at: new Date().toISOString() })
                    .in('id', Array.from(selectedItems));

                // Check if all items are now paid
                const remainingItems = orderItems.filter(item => !selectedItems.has(item.id));
                const remainingTotal = remainingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                if (remainingTotal <= 0) {
                    // All items paid, close session
                    await supabase
                        .from('pos_sessions')
                        .update({
                            status: 'paid',
                            closed_at: new Date().toISOString(),
                            payment_method: 'split',
                            total_amount: totalAmount
                        })
                        .eq('id', session.id);

                    toast.success('Tüm hesap ödendi!');
                    onClose();
                } else {
                    // Partial payment
                    await supabase
                        .from('pos_sessions')
                        .update({ total_amount: remainingTotal })
                        .eq('id', session.id);

                    toast.success(`₺${finalTotal.toFixed(2)} ödendi. Kalan: ₺${remainingTotal.toFixed(2)}`);

                    // Refresh items
                    setSelectedItems(new Set());
                    setSplitMode(false);
                    fetchOrderItems();
                }
            } else {
                // Normal full payment - Update this session AND any other stray active sessions for this table
                await supabase
                    .from('pos_sessions')
                    .update({
                        status: 'paid',
                        closed_at: new Date().toISOString(),
                        payment_method: paymentMethod,
                        total_amount: finalTotal,
                        discount_amount: totalAmount - finalTotal,
                        received_amount: received,
                        change_amount: change
                    })
                    .eq('id', session.id);

                // Housekeeping: Close any other stray active sessions for this table
                if (table?.id) {
                    await supabase
                        .from('pos_sessions')
                        .update({ status: 'paid', closed_at: new Date().toISOString() })
                        .eq('table_id', table.id)
                        .in('status', ['active', 'open']);
                }

                if (table?.id) {
                    await supabase
                        .from('restaurant_tables') // FIXED: Correct table name
                        .update({ status: 'empty', current_session_id: null })
                        .eq('id', table.id);
                }

                const methodLabels = {
                    'cash': 'Nakit',
                    'credit_card': 'Kredi Kartı',
                    'online': 'Online',
                    'account': 'Çari Hesap',
                    'meal_voucher': selectedMealVoucher
                        ? `Yemek Çeki (${MEAL_VOUCHER_PROVIDERS.find(p => p.id === selectedMealVoucher)?.name})`
                        : 'Yemek Çeki'
                };

                toast.success(`Ödeme alındı: ${methodLabels[paymentMethod]}`);

                if (change > 0 && paymentMethod === 'cash') {
                    toast(`Para Üstü: ${change.toFixed(2)} TL`, { icon: '💵', duration: 4000 });
                }

                onClose();
            }
        } catch (error) {
            console.error('Payment Error:', error);
            toast.error('Ödeme işlemi başarısız');
        } finally {
            setProcessing(false);
        }
    };

    // Print Receipt
    const handlePrint = () => {
        const receiptData = {
            id: session?.id || 'temp',
            created_at: new Date().toISOString(),
            items: splitMode && selectedItems.size > 0
                ? orderItems.filter(item => selectedItems.has(item.id))
                : orderItems,
            session: { table: { name: table?.table_number || table?.name } },
            total: finalTotal,
            discount: totalAmount - finalTotal,
            received: received,
            change: change
        };
        printReceipt(receiptData);
        toast.success('Adisyon yazdırılıyor...');
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4">
            {/* UI FIX: Reduced max-width and adjusted height */}
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button onClick={onClose} className="p-1.5 sm:p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                        <div>
                            <h2 className="text-white font-bold text-base sm:text-xl">
                                {splitMode ? '📋 Adisyon Böl' : '💳 Ödeme Al'}
                            </h2>
                            <p className="text-white/70 text-xs sm:text-sm">{table?.table_number || table?.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setSplitMode(!splitMode);
                                setSelectedItems(new Set());
                            }}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${splitMode
                                ? 'bg-amber-500 text-white'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            <Split className="w-4 h-4 inline mr-1" />
                            {splitMode ? 'İptal' : 'Böl'}
                        </button>
                        <button onClick={onClose} className="p-1.5 sm:p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                            <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Main Content - Responsive Layout */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* Left Column - Order Items */}
                    <div className="lg:w-72 bg-slate-800 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-700 max-h-[30vh] lg:max-h-none overflow-hidden">
                        <div className="p-2 sm:p-3 border-b border-slate-700 flex justify-between items-center shrink-0">
                            <h3 className="text-white/60 text-xs font-bold uppercase">
                                {splitMode ? 'Ödenecek Ürünleri Seç' : 'Sipariş Detayı'}
                            </h3>
                            {splitMode && selectedItems.size > 0 && (
                                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
                                    {selectedItems.size} seçili
                                </span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
                            <div className="space-y-1 sm:space-y-2">
                                {orderItems.map((item, idx) => {
                                    const isSelected = selectedItems.has(item.id);
                                    const isPaid = item.is_paid;

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => !isPaid && toggleItemSelection(item.id)}
                                            className={`
                                                flex justify-between items-center p-2 sm:p-3 rounded-lg border transition-all
                                                ${isPaid
                                                    ? 'bg-slate-700/50 border-slate-600 opacity-50'
                                                    : splitMode
                                                        ? isSelected
                                                            ? 'bg-amber-500/20 border-amber-500 cursor-pointer'
                                                            : 'bg-slate-700/30 border-slate-600 cursor-pointer hover:border-amber-400'
                                                        : 'bg-transparent border-slate-700'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-2">
                                                {splitMode && !isPaid && (
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-500'
                                                        }`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                                {isPaid && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                <div>
                                                    <span className="text-cyan-400 font-bold mr-1 text-sm">{item.quantity}x</span>
                                                    <span className="text-white text-sm">{item.name}</span>
                                                </div>
                                            </div>
                                            <span className={`font-bold text-sm ${isPaid ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                ₺{(item.price * item.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    );
                                })}

                                {orderItems.length === 0 && (
                                    <div className="text-center text-slate-500 py-4">
                                        <span className="text-2xl mb-2 block">🍽️</span>
                                        Sipariş yükleniyor...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="p-2 sm:p-3 bg-slate-900 border-t border-slate-700 shrink-0">
                            {splitMode && selectedItems.size > 0 && (
                                <div className="flex justify-between text-amber-400 text-sm mb-1">
                                    <span>Seçili Tutar:</span>
                                    <span className="font-bold">₺{getSelectedTotal().toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-white text-lg sm:text-xl font-black">
                                <span>{splitMode && selectedItems.size > 0 ? 'ÖDENECEK:' : 'TOPLAM:'}</span>
                                <span className="text-emerald-400">₺{finalTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Middle Column - Numpad */}
                    <div className="flex-1 bg-slate-800 p-2 sm:p-4 flex flex-col min-w-0 overflow-hidden">
                        {/* Amount Display */}
                        <div className="bg-white rounded-xl p-2 sm:p-4 mb-2 sm:mb-4 shrink-0">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="text-slate-500 text-xs sm:text-sm font-bold">Toplam</div>
                                    <div className="text-lg sm:text-2xl font-black text-slate-800">₺{finalTotal.toFixed(2)}</div>
                                </div>
                                <div className="border-x border-slate-200">
                                    <div className="text-slate-500 text-xs sm:text-sm font-bold">Tahsil</div>
                                    <div className="text-lg sm:text-2xl font-black text-emerald-600">{receivedAmount || '0'}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs sm:text-sm font-bold">Üstü</div>
                                    <div className="text-lg sm:text-2xl font-black text-cyan-600">₺{change.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Numpad Grid */}
                        <div className="flex-1 flex gap-2 min-h-0">
                            {/* Quick Amounts */}
                            <div className="w-14 sm:w-20 flex flex-col gap-1 sm:gap-2">
                                {[20, 50, 100, 200, 500].map(amount => (
                                    <button
                                        key={amount}
                                        onClick={() => handleQuickAmount(amount)}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg sm:rounded-xl transition-colors text-sm sm:text-lg"
                                    >
                                        {amount}
                                    </button>
                                ))}
                            </div>

                            {/* Functions */}
                            <div className="w-16 sm:w-24 flex flex-col gap-1 sm:gap-2">
                                <button
                                    onClick={() => handleQuickAmount(finalTotal)}
                                    className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-lg sm:rounded-xl transition-colors text-xs sm:text-sm"
                                >
                                    Tam
                                </button>
                                <button
                                    onClick={() => setShowDiscountModal(true)}
                                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg sm:rounded-xl transition-colors text-xs sm:text-sm flex items-center justify-center gap-1"
                                >
                                    <Percent className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">İskonto</span>
                                </button>
                                <button
                                    onClick={handleRoundUp}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg sm:rounded-xl transition-colors text-xs sm:text-sm"
                                >
                                    Yuvarla
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg sm:rounded-xl transition-colors text-xs sm:text-sm flex items-center justify-center gap-1"
                                >
                                    <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Yazdır</span>
                                </button>
                                <button
                                    onClick={() => setReceivedAmount('')}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg sm:rounded-xl transition-colors text-xs sm:text-sm"
                                >
                                    Sil
                                </button>
                            </div>

                            {/* Numpad */}
                            <div className="flex-1 grid grid-cols-3 gap-1 sm:gap-2">
                                {['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', 'C'].map(key => (
                                    <button
                                        key={key}
                                        onClick={() => handleNumpadPress(key)}
                                        className={`
                                            rounded-lg sm:rounded-xl font-bold text-xl sm:text-3xl transition-all active:scale-95
                                            ${key === 'C'
                                                ? 'bg-red-500 hover:bg-red-400 text-white'
                                                : 'bg-slate-700 hover:bg-slate-600 text-white'}
                                        `}
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Payment Methods */}
                    <div className="lg:w-48 bg-slate-900 p-2 sm:p-3 flex lg:flex-col gap-2 sm:gap-3 shrink-0 overflow-x-auto lg:overflow-x-visible">
                        <PaymentButton
                            icon={Banknote}
                            label="Nakit"
                            color="emerald"
                            selected={paymentMethod === 'cash'}
                            onClick={() => { setPaymentMethod('cash'); setShowMealVoucherSelector(false); }}
                        />
                        <PaymentButton
                            icon={CreditCard}
                            label="Kart"
                            color="blue"
                            selected={paymentMethod === 'credit_card'}
                            onClick={() => { setPaymentMethod('credit_card'); setShowMealVoucherSelector(false); }}
                        />

                        {/* Yemek Çeki with Dropdown */}
                        <div className="relative">
                            <PaymentButton
                                icon={Ticket}
                                label={selectedMealVoucher
                                    ? MEAL_VOUCHER_PROVIDERS.find(p => p.id === selectedMealVoucher)?.name
                                    : "Yemek Çeki"}
                                color="pink"
                                selected={paymentMethod === 'meal_voucher'}
                                onClick={() => {
                                    setPaymentMethod('meal_voucher');
                                    setShowMealVoucherSelector(!showMealVoucherSelector);
                                }}
                            />
                            {showMealVoucherSelector && paymentMethod === 'meal_voucher' && (
                                <div className="absolute left-0 lg:left-auto lg:right-full lg:mr-2 top-full lg:top-0 mt-1 lg:mt-0 z-10 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden min-w-[140px]">
                                    {MEAL_VOUCHER_PROVIDERS.map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => {
                                                setSelectedMealVoucher(provider.id);
                                                setShowMealVoucherSelector(false);
                                            }}
                                            className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2 ${selectedMealVoucher === provider.id
                                                ? `${provider.color} text-white`
                                                : 'text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full ${provider.color}`}></div>
                                            {provider.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <PaymentButton
                            icon={FileText}
                            label="Çari"
                            color="amber"
                            selected={paymentMethod === 'account'}
                            onClick={() => { setPaymentMethod('account'); setShowMealVoucherSelector(false); }}
                        />
                        <PaymentButton
                            icon={Globe}
                            label="Online"
                            color="purple"
                            selected={paymentMethod === 'online'}
                            onClick={() => { setPaymentMethod('online'); setShowMealVoucherSelector(false); }}
                        />

                        <div className="hidden lg:block flex-1" />

                        {/* Complete Payment */}
                        <button
                            onClick={handlePayment}
                            disabled={!paymentMethod || processing || (paymentMethod === 'meal_voucher' && !selectedMealVoucher)}
                            className={`
                                lg:w-full px-4 lg:px-0 py-3 sm:py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-lg whitespace-nowrap
                                ${paymentMethod && !processing && !(paymentMethod === 'meal_voucher' && !selectedMealVoucher)
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white active:scale-95'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                            `}
                        >
                            {processing ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <>
                                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                                    {splitMode && selectedItems.size > 0 ? 'SEÇİLENİ ÖDE' : 'KAPAT'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* POS Confirmation Modal */}
                {showPOSConfirmation && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
                            {posStatus === 'waiting' && (
                                <>
                                    <CreditCard className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">POS Cihazını Kullanın</h3>
                                    <p className="text-slate-600 mb-4">Müşterinin kartını POS cihazından geçirin</p>
                                    <div className="bg-blue-50 rounded-xl p-4 mb-6">
                                        <div className="text-3xl font-black text-blue-600">₺{finalTotal.toFixed(2)}</div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowPOSConfirmation(false);
                                                setPosStatus('waiting');
                                            }}
                                            className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold rounded-xl"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPosStatus('processing');
                                                // Simulate POS processing
                                                setTimeout(() => {
                                                    setPosStatus('success');
                                                }, 2000);
                                            }}
                                            className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                        >
                                            <CreditCard className="w-5 h-5" />
                                            POS'a Gönder
                                        </button>
                                    </div>
                                </>
                            )}

                            {posStatus === 'processing' && (
                                <>
                                    <Loader className="w-16 h-16 mx-auto text-blue-500 mb-4 animate-spin" />
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">İşlem Yapılıyor...</h3>
                                    <p className="text-slate-600">POS'tan onay bekleniyor</p>
                                    <div className="bg-amber-50 rounded-xl p-4 mt-4">
                                        <div className="text-2xl font-black text-amber-600">₺{finalTotal.toFixed(2)}</div>
                                    </div>
                                </>
                            )}

                            {posStatus === 'success' && (
                                <>
                                    <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Ödeme Onaylandı!</h3>
                                    <p className="text-slate-600 mb-4">Kart işlemi başarıyla tamamlandı</p>
                                    <div className="bg-green-50 rounded-xl p-4 mb-6">
                                        <div className="text-3xl font-black text-green-600">₺{finalTotal.toFixed(2)}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowPOSConfirmation(false);
                                            handlePayment();
                                        }}
                                        className="w-full py-3 bg-green-500 text-white font-bold rounded-xl"
                                    >
                                        Hesabı Kapat
                                    </button>
                                </>
                            )}

                            {posStatus === 'failed' && (
                                <>
                                    <X className="w-16 h-16 mx-auto text-red-500 mb-4" />
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">İşlem Başarısız</h3>
                                    <p className="text-slate-600 mb-6">Kart işlemi reddedildi. Tekrar deneyin.</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowPOSConfirmation(false);
                                                setPosStatus('waiting');
                                            }}
                                            className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold rounded-xl"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={() => setPosStatus('waiting')}
                                            className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl"
                                        >
                                            Tekrar Dene
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Discount Modal */}
                {showDiscountModal && (
                    <DiscountModal
                        currentDiscount={discount}
                        onApply={(newDiscount) => {
                            setDiscount(newDiscount);
                            setShowDiscountModal(false);
                        }}
                        onClose={() => setShowDiscountModal(false)}
                    />
                )}
            </div>
        </div>
    );
};

// Payment Method Button - Responsive
const PaymentButton = ({ icon: Icon, label, color, selected, onClick }) => {
    const colorClasses = {
        emerald: selected ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700',
        blue: selected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-blue-400 hover:bg-slate-700',
        purple: selected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-purple-400 hover:bg-slate-700',
        amber: selected ? 'bg-amber-500 text-white' : 'bg-slate-800 text-amber-400 hover:bg-slate-700',
        pink: selected ? 'bg-pink-500 text-white' : 'bg-slate-800 text-pink-400 hover:bg-slate-700',
    };

    return (
        <button
            onClick={onClick}
            className={`
                px-3 py-2 sm:py-3 lg:py-4 rounded-xl font-bold transition-all flex lg:flex-col items-center justify-center gap-1 sm:gap-2
                ${colorClasses[color]}
                ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}
            `}
        >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
            <span className="text-xs sm:text-sm">{label}</span>
        </button>
    );
};

// Discount Modal
const DiscountModal = ({ currentDiscount, onApply, onClose }) => {
    const [type, setType] = useState(currentDiscount.type);
    const [value, setValue] = useState(currentDiscount.value.toString());

    return (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-4">İskonto Uygula</h3>

                {/* Type Toggle */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setType('percent')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-colors ${type === 'percent'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                            }`}
                    >
                        % Yüzde
                    </button>
                    <button
                        onClick={() => setType('amount')}
                        className={`flex-1 py-3 rounded-lg font-bold transition-colors ${type === 'amount'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                            }`}
                    >
                        TL Tutar
                    </button>
                </div>

                {/* Value Input */}
                <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === 'percent' ? '0-100' : '0.00'}
                    className="w-full text-center text-3xl font-bold border-2 border-slate-200 rounded-xl py-4 mb-4 focus:border-purple-500 outline-none"
                />

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold rounded-lg"
                    >
                        İptal
                    </button>
                    <button
                        onClick={() => onApply({ type, value: parseFloat(value) || 0 })}
                        className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-lg"
                    >
                        Uygula
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TouchPaymentModal;
