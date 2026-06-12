import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { XCircle, Plus, Minus, CreditCard, Banknote, UtensilsCrossed, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { printReceipt } from '../utils/receiptPrinter';

export const SplitPaymentModal = ({
    isOpen,
    onClose,
    session,
    table,
    existingItems,
    grandTotal,
    onPaymentComplete
}) => {
    const [itemQuantities, setItemQuantities] = useState({});
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [partialPayments, setPartialPayments] = useState([]);
    const [paidAmount, setPaidAmount] = useState(0);
    const [loading, setLoading] = useState(false);

    const selectedTotal = Object.entries(itemQuantities).reduce((sum, [itemId, qty]) => {
        const item = existingItems.find(i => i.id === itemId);
        return sum + (item ? item.price * qty : 0);
    }, 0);

    const remainingAmount = grandTotal - paidAmount;
    const hasSelection = Object.values(itemQuantities).some(qty => qty > 0);

    useEffect(() => {
        if (isOpen) {
            setItemQuantities({});
            setPaymentMethod(null);
            if (session?.id) fetchPartialPayments();
        }
    }, [isOpen, session?.id]);

    const fetchPartialPayments = async () => {
        const { data } = await supabase
            .from('partial_payments')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: true });

        if (data) {
            setPartialPayments(data);
            setPaidAmount(data.reduce((sum, p) => sum + parseFloat(p.amount), 0));
        }
    };

    const getPaidQuantity = (itemId) => {
        return partialPayments.reduce((sum, p) => {
            const paidItem = (p.items || []).find(i => i.id === itemId);
            return sum + (paidItem ? paidItem.quantity : 0);
        }, 0);
    };

    const getAvailableQuantity = (item) => item.quantity - getPaidQuantity(item.id);

    const adjustQuantity = (itemId, delta) => {
        setItemQuantities(prev => {
            const item = existingItems.find(i => i.id === itemId);
            const available = getAvailableQuantity(item);
            const current = prev[itemId] || 0;
            const newQty = Math.max(0, Math.min(available, current + delta));
            if (newQty === 0) {
                const { [itemId]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [itemId]: newQty };
        });
    };

    const selectAllRemaining = () => {
        const newQuantities = {};
        existingItems.forEach(item => {
            const available = getAvailableQuantity(item);
            if (available > 0) newQuantities[item.id] = available;
        });
        setItemQuantities(newQuantities);
    };

    const handlePartialPayment = async () => {
        if (!paymentMethod || !hasSelection) {
            toast.error('Lütfen ürün ve ödeme yöntemi seçin.');
            return;
        }
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const selectedItems = Object.entries(itemQuantities)
                .filter(([_, qty]) => qty > 0)
                .map(([itemId, qty]) => {
                    const item = existingItems.find(i => i.id === itemId);
                    return { id: item.id, name: item.name, price: item.price, quantity: qty };
                });

            await supabase.from('partial_payments').insert({
                tenant_id: user.id,
                session_id: session.id,
                amount: selectedTotal,
                payment_method: paymentMethod,
                items: selectedItems,
                created_by: user.id
            });

            const newPaidAmount = paidAmount + selectedTotal;
            await supabase.from('pos_sessions').update({ paid_amount: newPaidAmount }).eq('id', session.id);

            printReceipt({
                id: `${session.id.slice(0, 6)}-${Date.now()}`,
                created_at: new Date().toISOString(),
                items: selectedItems,
                session: { table: { name: table.name } }
            });

            setItemQuantities({});
            setPaymentMethod(null);
            setPaidAmount(newPaidAmount);
            await fetchPartialPayments();

            toast.success(`₺${selectedTotal.toFixed(2)} ödendi!`);

            if (newPaidAmount >= grandTotal) {
                toast.success('Tüm ödeme tamamlandı!');
                setTimeout(() => onPaymentComplete(), 500);
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Ödeme kaydedilemedi.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const availableItems = existingItems.filter(item => getAvailableQuantity(item) > 0);

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-2">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                {/* Header - Compact */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold">Bölünmüş Ödeme - {table.name}</h2>
                        <div className="flex gap-4 text-sm">
                            <span className="text-green-300">✓ ₺{paidAmount.toFixed(2)}</span>
                            <span className="text-red-300">Kalan: ₺{remainingAmount.toFixed(2)}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                {/* Payment Method Buttons - Horizontal at top */}
                <div className="p-3 bg-gray-50 border-b flex gap-2">
                    {[
                        { id: 'cash', label: 'Nakit', icon: Banknote, color: 'green' },
                        { id: 'credit_card', label: 'Kart', icon: CreditCard, color: 'purple' },
                        { id: 'meal_voucher', label: 'Çek', icon: UtensilsCrossed, color: 'orange' }
                    ].map(method => (
                        <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id)}
                            className={`flex-1 py-2 px-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all
                                ${paymentMethod === method.id
                                    ? `border-${method.color}-500 bg-${method.color}-50 text-${method.color}-700`
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        >
                            <method.icon className="w-4 h-4" />
                            <span className="font-medium text-sm">{method.label}</span>
                        </button>
                    ))}
                </div>

                {/* Items List - Scrollable */}
                <div className="max-h-[40vh] overflow-y-auto p-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">Ürün seçin:</span>
                        <button onClick={selectAllRemaining} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            Tümünü Seç
                        </button>
                    </div>

                    {availableItems.length === 0 ? (
                        <div className="text-center py-8 text-green-600">
                            <CheckCircle className="w-10 h-10 mx-auto mb-2" />
                            <p className="font-bold">Tüm ürünler ödendi!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {availableItems.map(item => {
                                const available = getAvailableQuantity(item);
                                const selected = itemQuantities[item.id] || 0;
                                return (
                                    <div key={item.id} className={`p-2 rounded-lg border-2 flex justify-between items-center ${selected > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}>
                                        <div>
                                            <p className="font-medium text-sm">{item.name}</p>
                                            <p className="text-xs text-gray-500">₺{item.price} × {available} kaldı</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => adjustQuantity(item.id, -1)} disabled={selected === 0}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center ${selected === 0 ? 'bg-gray-100 text-gray-300' : 'bg-red-100 text-red-600'}`}>
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className={`w-6 text-center font-bold ${selected > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{selected}</span>
                                            <button onClick={() => adjustQuantity(item.id, 1)} disabled={selected >= available}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center ${selected >= available ? 'bg-gray-100 text-gray-300' : 'bg-green-100 text-green-600'}`}>
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            {selected > 0 && <span className="ml-1 text-sm font-bold text-blue-600">₺{(item.price * selected).toFixed(2)}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer - Fixed Payment Button */}
                <div className="p-3 border-t bg-white flex items-center gap-3">
                    <div className="flex-1 text-center bg-blue-50 py-2 rounded-lg border border-blue-200">
                        <span className="text-xs text-gray-500">Seçilen: </span>
                        <span className="text-xl font-black text-blue-600">₺{selectedTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handlePartialPayment}
                        disabled={loading || !hasSelection || !paymentMethod}
                        className={`flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2
                            ${loading || !hasSelection || !paymentMethod
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-lg'}`}
                    >
                        <CheckCircle className="w-5 h-5" />
                        {loading ? 'İşleniyor...' : 'ÖDEME AL'}
                    </button>
                </div>
            </div>
        </div>
    );
};
