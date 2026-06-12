import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { initializePayment, handlePaymentCallback, getEnabledProviders } from '../lib/paymentService';
import toast from 'react-hot-toast';

export const PaymentCheckout = ({
    tenantId,
    orderId,
    amount,
    orderItems = [],
    customerInfo = {},
    onSuccess,
    onCancel,
    onError
}) => {
    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [checkoutHtml, setCheckoutHtml] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState(null); // null, 'success', 'failed'
    const [transactionId, setTransactionId] = useState(null);

    useEffect(() => {
        loadProviders();
    }, [tenantId]);

    // Set up global callback handler for demo payments
    useEffect(() => {
        window.handleDemoPayment = async (txId, status) => {
            await processPaymentResult(txId, status);
        };

        return () => {
            delete window.handleDemoPayment;
        };
    }, []);

    const loadProviders = async () => {
        try {
            const enabledProviders = await getEnabledProviders(tenantId);
            setProviders(enabledProviders);
            if (enabledProviders.length === 1) {
                setSelectedProvider(enabledProviders[0].id);
            }
        } catch (error) {
            console.error('Error loading providers:', error);
            toast.error('Ödeme sağlayıcıları yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const startPayment = async () => {
        if (!selectedProvider) {
            toast.error('Lütfen bir ödeme yöntemi seçin');
            return;
        }

        setProcessing(true);
        try {
            const result = await initializePayment({
                tenantId,
                orderId,
                amount,
                provider: selectedProvider,
                customerInfo,
                basketItems: orderItems,
                callbackUrl: `${window.location.origin}/payment/callback`,
                returnUrl: `${window.location.origin}/payment/result`
            });

            setTransactionId(result.transactionId);
            setCheckoutHtml(result.checkoutFormHtml);

            if (result.mode === 'demo') {
                toast.info('Demo modu aktif - Test ödemesi yapılacak');
            }
        } catch (error) {
            console.error('Payment initialization error:', error);
            toast.error('Ödeme başlatılamadı: ' + error.message);
            onError?.(error);
        } finally {
            setProcessing(false);
        }
    };

    const processPaymentResult = async (txId, status) => {
        setProcessing(true);
        try {
            await handlePaymentCallback(txId, status);
            setPaymentStatus(status);

            if (status === 'success') {
                toast.success('Ödeme başarıyla tamamlandı!');
                onSuccess?.({ transactionId: txId });
            } else {
                toast.error('Ödeme başarısız oldu');
                onError?.({ transactionId: txId, status });
            }
        } catch (error) {
            console.error('Payment callback error:', error);
            toast.error('Ödeme durumu güncellenemedi');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-slate-600">Ödeme seçenekleri yükleniyor...</span>
            </div>
        );
    }

    // Payment result screen
    if (paymentStatus) {
        return (
            <div className="max-w-md mx-auto p-6 text-center">
                {paymentStatus === 'success' ? (
                    <>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-700 mb-2">Ödeme Başarılı!</h2>
                        <p className="text-slate-600 mb-4">
                            Siparişiniz onaylandı ve hazırlanmaya başlandı.
                        </p>
                        <p className="text-2xl font-bold text-slate-800">{amount.toFixed(2)} ₺</p>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                            <XCircle className="w-12 h-12 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-red-700 mb-2">Ödeme Başarısız</h2>
                        <p className="text-slate-600 mb-4">
                            Ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin.
                        </p>
                        <button
                            onClick={() => {
                                setPaymentStatus(null);
                                setCheckoutHtml(null);
                            }}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
                        >
                            Tekrar Dene
                        </button>
                    </>
                )}
            </div>
        );
    }

    // Checkout form (provider's form) - Using sandboxed iframe for XSS protection
    if (checkoutHtml) {
        // Create a blob URL for the HTML content to render in sandboxed iframe
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
                </style>
            </head>
            <body>${checkoutHtml}</body>
            </html>
        `;

        return (
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => setCheckoutHtml(null)}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" /> Geri
                </button>

                {/* Sandboxed iframe for XSS protection */}
                <iframe
                    srcDoc={htmlContent}
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    className="w-full min-h-[400px] bg-white rounded-xl shadow-lg border-0"
                    title="Ödeme Formu"
                />

                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500">
                    <Shield className="w-4 h-4" />
                    <span>256-bit SSL şifreleme ile güvenli ödeme</span>
                </div>
            </div>
        );
    }


    // No providers enabled
    if (providers.length === 0) {
        return (
            <div className="max-w-md mx-auto p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Online Ödeme Aktif Değil</h3>
                <p className="text-slate-600 mb-4">
                    Bu restoran henüz online ödeme kabul etmiyor. Lütfen kapıda ödeme seçeneğini kullanın.
                </p>
                <button
                    onClick={onCancel}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
                >
                    Geri Dön
                </button>
            </div>
        );
    }

    // Provider selection and payment initiation
    return (
        <div className="max-w-md mx-auto p-4">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Online Ödeme</h2>
                <p className="text-slate-600">Güvenli ödeme yönteminizi seçin</p>
            </div>

            {/* Order Summary */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-slate-700 mb-3">Sipariş Özeti</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {orderItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-600">
                                {item.quantity}x {item.name}
                            </span>
                            <span className="text-slate-800 font-medium">
                                {(item.price * item.quantity).toFixed(2)} ₺
                            </span>
                        </div>
                    ))}
                </div>
                <div className="border-t mt-3 pt-3 flex justify-between">
                    <span className="font-semibold text-slate-800">Toplam</span>
                    <span className="text-xl font-bold text-blue-600">{amount.toFixed(2)} ₺</span>
                </div>
            </div>

            {/* Provider Selection */}
            <div className="space-y-3 mb-6">
                <label className="text-sm font-medium text-slate-700">Ödeme Yöntemi</label>
                {providers.map(provider => (
                    <button
                        key={provider.id}
                        onClick={() => setSelectedProvider(provider.id)}
                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${selectedProvider === provider.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <span className="text-2xl">{provider.icon}</span>
                        <div className="text-left">
                            <p className="font-medium text-slate-800">{provider.name}</p>
                            <p className="text-xs text-slate-500">Kredi/Banka Kartı</p>
                        </div>
                        {selectedProvider === provider.id && (
                            <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />
                        )}
                    </button>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
                <button
                    onClick={startPayment}
                    disabled={!selectedProvider || processing}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl 
                               font-semibold text-lg shadow-lg hover:shadow-xl transition-all 
                               disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {processing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            İşleniyor...
                        </>
                    ) : (
                        <>
                            <CreditCard className="w-5 h-5" />
                            {amount.toFixed(2)} ₺ Öde
                        </>
                    )}
                </button>

                <button
                    onClick={onCancel}
                    disabled={processing}
                    className="w-full py-3 text-slate-600 hover:text-slate-800 font-medium"
                >
                    İptal
                </button>
            </div>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-400">
                <Shield className="w-4 h-4" />
                <span>Tüm ödemeler 256-bit SSL ile şifrelenmektedir</span>
            </div>
        </div>
    );
};

export default PaymentCheckout;
