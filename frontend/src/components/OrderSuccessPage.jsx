import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Home, MessageCircle, Clock, MapPin } from 'lucide-react';

/**
 * OrderSuccessPage - Sipariş onay sayfası
 * Ödeme sonrası müşteriye gösterilir
 */
export const OrderSuccessPage = () => {
    const { slug } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const { orderId, total, paymentMethod } = location.state || {};

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6">
            {/* Success Icon */}
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-bounce">
                <CheckCircle className="w-14 h-14 text-green-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                Siparişiniz Alındı! 🎉
            </h1>
            <p className="text-gray-600 text-center mb-6">
                {paymentMethod === 'online'
                    ? 'Ödemeniz başarıyla tamamlandı.'
                    : 'Siparişiniz restorana iletildi.'}
            </p>

            {/* Order Info Card */}
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="space-y-4">
                    {orderId && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-bold">#</span>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Sipariş No</p>
                                <p className="font-mono font-bold text-gray-800">{orderId.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>
                    )}

                    {total && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <span className="text-green-600 font-bold">₺</span>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Toplam Tutar</p>
                                <p className="font-bold text-gray-800">₺{total.toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Tahmini Süre</p>
                            <p className="font-bold text-gray-800">30-45 dakika</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Timeline */}
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h3 className="font-bold text-gray-800 mb-4">Sipariş Durumu</h3>
                <div className="space-y-3">
                    {[
                        { label: 'Sipariş Alındı', done: true },
                        { label: 'Hazırlanıyor', done: false },
                        { label: 'Yola Çıktı', done: false },
                        { label: 'Teslim Edildi', done: false },
                    ].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500' : 'bg-gray-200'
                                }`}>
                                {step.done && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <span className={step.done ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Info Note */}
            <div className="w-full max-w-sm bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-700 text-center">
                    📱 Sipariş durumunuz WhatsApp üzerinden size bildirilecek.
                </p>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-sm space-y-3">
                <button
                    onClick={() => navigate(`/m/${slug}`)}
                    className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                    <Home className="w-5 h-5" />
                    Menüye Dön
                </button>
            </div>
        </div>
    );
};

export default OrderSuccessPage;
