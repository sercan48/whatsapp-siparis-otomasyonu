import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MessageCircle, AlertTriangle, CheckCircle, Clock, Search, XCircle, Phone, Tag, Gift, Ticket, Ban, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export const ComplaintManagement = ({ tenantId }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (tenantId) fetchTickets();
    }, [filter, tenantId]);

    const fetchTickets = async () => {
        setLoading(true);
        let query = supabase
            .from('support_tickets')
            .select('*, customers(phone, name, trust_score)')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (filter !== 'all') {
            query = query.eq('status', filter);
        }

        const { data, error } = await query;
        if (error) console.error('Error fetching tickets:', error);
        else setTickets(data || []);

        setLoading(false);
    };

    const resolveTicket = async (ticketId, action, cost = 0) => {
        const { error } = await supabase
            .from('support_tickets')
            .update({
                status: 'resolved',
                resolution_action: action,
                resolution_cost: cost,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) {
            toast.error('Güncelleme başarısız');
        } else {
            toast.success('Şikayet çözüldü!');
            fetchTickets();
        }
    };

    const getIssueTypeLabel = (type) => {
        const labels = {
            'cold_food': '❄️ Soğuk Yemek',
            'late_delivery': '⏰ Geç Teslimat',
            'wrong_item': '❌ Yanlış Ürün',
            'taste_issue': '👅 Tat Problemi',
            'other': '📋 Diğer'
        };
        return labels[type] || type;
    };

    const getScoreColor = (score) => {
        if (!score) return 'bg-gray-100 text-gray-600';
        if (score >= 70) return 'bg-green-100 text-green-700';
        if (score >= 40) return 'bg-yellow-100 text-yellow-700';
        return 'bg-red-100 text-red-700';
    };

    // Stats
    const openCount = tickets.filter(t => t.status === 'open').length;
    const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Şikayet Yönetimi</h1>
                    <p className="text-gray-500">Müşteri talepleri, AI analizleri ve çözüm kayıtları.</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border'}`}>
                        Tümü ({tickets.length})
                    </button>
                    <button onClick={() => setFilter('open')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'open' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border'}`}>
                        Açık ({openCount})
                    </button>
                    <button onClick={() => setFilter('resolved')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'resolved' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border'}`}>
                        Çözülen ({resolvedCount})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10">Yükleniyor...</div>
            ) : (
                <div className="space-y-4">
                    {tickets.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
                            <CheckCircle className="w-16 h-16 text-green-200 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-800">Harika! Hiç şikayet yok.</h3>
                            <p className="text-gray-500">Müşterileriniz şu an çok mutlu görünüyor.</p>
                        </div>
                    ) : (
                        tickets.map(ticket => (
                            <div key={ticket.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex flex-col lg:flex-row gap-6">
                                    {/* Left: Ticket Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ticket.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {ticket.status === 'open' ? '⏳ Bekliyor' : '✅ Çözüldü'}
                                            </span>
                                            <span className="text-sm text-gray-400 flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {new Date(ticket.created_at).toLocaleString('tr-TR')}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            {getIssueTypeLabel(ticket.issue_type)}
                                        </h3>

                                        {/* Customer Info */}
                                        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-gray-400" />
                                                <span className="font-mono text-sm">{ticket.customers?.phone || 'Bilinmiyor'}</span>
                                            </div>
                                            {ticket.customers?.name && (
                                                <span className="text-sm text-gray-600">{ticket.customers.name}</span>
                                            )}
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(ticket.customers?.trust_score)}`}>
                                                <Shield className="w-3 h-3 inline mr-1" />
                                                Güven: {ticket.customers?.trust_score || 50}
                                            </span>
                                        </div>

                                        {/* AI Score */}
                                        <div className="flex items-center gap-4">
                                            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${ticket.ai_confidence_score >= 70 ? 'bg-green-100 text-green-700' : ticket.ai_confidence_score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                🤖 AI Güven: {ticket.ai_confidence_score || '-'}%
                                            </div>
                                            {ticket.proof_image_url && (
                                                <a href={ticket.proof_image_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline flex items-center font-medium">
                                                    📸 Fotoğraf Kanıtı
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Resolution Actions */}
                                    <div className="lg:w-1/3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Çözüm Aksiyonu</h4>

                                        {ticket.status === 'resolved' ? (
                                            <div className="text-center">
                                                {ticket.resolution_action === 'coupon' && (
                                                    <div className="text-green-600 font-bold">
                                                        🎟️ Kupon: {ticket.resolution_cost} TL
                                                    </div>
                                                )}
                                                {ticket.resolution_action === 'refund' && (
                                                    <div className="text-blue-600 font-bold">
                                                        💰 İade: {ticket.resolution_cost} TL
                                                    </div>
                                                )}
                                                {ticket.resolution_action === 'product' && (
                                                    <div className="text-purple-600 font-bold">
                                                        🎁 Ürün İkramı
                                                    </div>
                                                )}
                                                {ticket.resolution_action === 'apology' && (
                                                    <div className="text-gray-600 font-bold">
                                                        🙏 Özür Mesajı Gönderildi
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => resolveTicket(ticket.id, 'coupon', 50)}
                                                    className="w-full py-2 px-3 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Ticket className="w-4 h-4" />
                                                    50₺ Kupon Ver
                                                </button>
                                                <button
                                                    onClick={() => resolveTicket(ticket.id, 'product', 0)}
                                                    className="w-full py-2 px-3 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Gift className="w-4 h-4" />
                                                    Ürün İkram Et
                                                </button>
                                                <button
                                                    onClick={() => resolveTicket(ticket.id, 'apology', 0)}
                                                    className="w-full py-2 px-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-sm"
                                                >
                                                    🙏 Sadece Özür Dile
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
