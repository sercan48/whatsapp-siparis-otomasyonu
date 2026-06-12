import React, { useState } from 'react';
import { FileText, CreditCard, ShieldCheck, CheckCircle, Download, BookOpen } from 'lucide-react';
import { LEGAL_TEXTS } from '../lib/legalTexts';

export const Billing = () => {
    const [showContract, setShowContract] = useState(false);
    const [showKvkk, setShowKvkk] = useState(false);

    // Mock Data
    const subscription = {
        plan: 'Premium Restoran Paketi',
        price: '999.00 ₺',
        period: 'Aylık',
        next_payment: '08.01.2026',
        status: 'active'
    };

    const invoices = [
        { id: 'INV-001', date: '08.12.2025', amount: '999.00 ₺', status: 'Ödendi' },
        { id: 'INV-002', date: '08.11.2025', amount: '999.00 ₺', status: 'Ödendi' }
    ];

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Abonelik ve Faturalar</h1>
                <p className="text-gray-500">Paket detaylarınız ve yasal sözleşmeleriniz.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Current Plan Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Mevcut Plan</h2>
                            <p className="text-purple-600 font-medium">{subscription.plan}</p>
                        </div>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                            {subscription.status}
                        </span>
                    </div>
                    <div className="mb-6">
                        <div className="text-3xl font-extrabold text-gray-900">{subscription.price}<span className="text-sm font-normal text-gray-500">/{subscription.period}</span></div>
                        <p className="text-sm text-gray-500 mt-1">Sonraki ödeme: {subscription.next_payment}</p>
                    </div>

                    <div className="flex space-x-3">
                        <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-bold transition-colors">
                            Planı Yönet
                        </button>
                        <button
                            onClick={() => setShowContract(!showContract)}
                            className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Sözleşmeyi Gör
                        </button>
                    </div>
                </div>

                {/* Legal / Trust Card */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between">
                    <div>
                        <ShieldCheck className="w-10 h-10 text-green-400 mb-4" />
                        <h3 className="text-lg font-bold">Güvenlik ve Gizlilik</h3>
                        <p className="text-gray-300 text-sm mt-2">
                            Verileriniz <button onClick={() => setShowKvkk(true)} className="text-green-400 hover:text-green-300 font-bold underline">KVKK Aydınlatma Metni</button> kapsamında korunmaktadır. Ödemeleriniz Iyzico güvencesiyle 256-bit SSL şifreleme ile gerçekleşir.
                        </p>
                    </div>
                    <div className="mt-6 flex items-center text-xs text-gray-400">
                        <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                        Hizmet Sözleşmesi Onaylandı (08.12.2025)
                    </div>
                </div>
            </div>

            {/* Contract Viewer (Embedded) */}
            {(showContract || showKvkk) && (
                <div className="mb-8 bg-white p-6 rounded-2xl shadow-lg border border-gray-200 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-blue-600" />
                            {showKvkk ? 'KVKK Aydınlatma Metni' : 'Mesafeli Satış ve Hizmet Sözleşmesi'}
                        </h3>
                        <button onClick={() => { setShowContract(false); setShowKvkk(false); }} className="text-gray-400 hover:text-gray-600">Kapat</button>
                    </div>
                    <div className="h-96 overflow-y-auto text-sm text-gray-600 space-y-4 pr-2 bg-gray-50 p-4 rounded-lg">
                        <div className="whitespace-pre-wrap font-sans leading-relaxed">
                            {showKvkk ? LEGAL_TEXTS.kvkk : LEGAL_TEXTS.saas_agreement}
                        </div>
                        <div className="p-4 bg-blue-50 text-blue-800 rounded mt-4 text-xs">
                            {showKvkk ? 'Bu metin bilgilendirme amaçlıdır.' : 'Bu metin, üyeliğiniz başlatıldığında elektronik olarak onaylanmıştır.'}
                        </div>
                    </div>
                </div>
            )}

            {/* Invoices Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Geçmiş Faturalar</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Fatura No</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tarih</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Tutar</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Durum</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">İndir</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {invoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-800">{inv.id}</td>
                                <td className="p-4 text-gray-600">{inv.date}</td>
                                <td className="p-4 font-bold text-gray-800">{inv.amount}</td>
                                <td className="p-4">
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                                        {inv.status}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-400">
                                    <button className="hover:text-purple-600 transition-colors">
                                        <Download className="w-5 h-5" />
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
