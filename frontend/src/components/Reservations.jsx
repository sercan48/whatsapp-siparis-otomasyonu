import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Clock, Users, Phone, Plus, X, Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const Reservations = () => {
    const [reservations, setReservations] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_phone: '',
        party_size: 2,
        table_id: '',
        reservation_date: '',
        reservation_time: '19:00',
        note: ''
    });

    useEffect(() => {
        fetchReservations();
        fetchTables();
    }, [selectedDate]);

    const fetchReservations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('reservations')
                .select(`
                    *,
                    table:restaurant_tables(name)
                `)
                .eq('tenant_id', user.id)
                .eq('reservation_date', selectedDate)
                .order('reservation_time', { ascending: true });

            if (error) throw error;
            setReservations(data || []);
        } catch (error) {
            console.error('Reservation fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTables = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('restaurant_tables')
                .select('id, name, capacity')
                .eq('tenant_id', user.id)
                .order('name');

            setTables(data || []);
        } catch (error) {
            console.error('Tables fetch error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.from('reservations').insert({
                tenant_id: user.id,
                ...formData,
                status: 'confirmed'
            });

            if (error) throw error;

            toast.success('Rezervasyon oluşturuldu!');
            setShowModal(false);
            resetForm();
            fetchReservations();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status })
                .eq('id', id);

            if (error) throw error;

            toast.success(
                status === 'seated' ? 'Müşteri oturdu!' :
                    status === 'cancelled' ? 'Rezervasyon iptal edildi' :
                        status === 'completed' ? 'Rezervasyon tamamlandı' : 'Güncellendi'
            );
            fetchReservations();
        } catch (error) {
            toast.error('Güncelleme hatası');
        }
    };

    const resetForm = () => {
        setFormData({
            customer_name: '',
            customer_phone: '',
            party_size: 2,
            table_id: '',
            reservation_date: selectedDate,
            reservation_time: '19:00',
            note: ''
        });
    };

    const changeDate = (days) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'confirmed': return 'bg-blue-100 text-blue-700';
            case 'seated': return 'bg-green-100 text-green-700';
            case 'completed': return 'bg-gray-100 text-gray-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            case 'no_show': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'confirmed': return 'Onaylı';
            case 'seated': return 'Oturdu';
            case 'completed': return 'Tamamlandı';
            case 'cancelled': return 'İptal';
            case 'no_show': return 'Gelmedi';
            default: return status;
        }
    };

    const timeSlots = [];
    for (let h = 10; h <= 23; h++) {
        timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-gray-400">Yükleniyor...</div></div>;
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Rezervasyonlar</h1>
                    <p className="text-gray-500">Masa rezervasyonlarını yönetin</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center shadow-lg transform active:scale-95 transition-all"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Yeni Rezervasyon
                </button>
            </div>

            {/* Date Navigation */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex items-center justify-between">
                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-center">
                    <div className="text-sm text-gray-500">
                        {new Date(selectedDate).toLocaleDateString('tr-TR', { weekday: 'long' })}
                    </div>
                    <div className="text-xl font-bold text-gray-800">
                        {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
                <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Toplam', value: reservations.length, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Onaylı', value: reservations.filter(r => r.status === 'confirmed').length, color: 'bg-green-50 text-green-600' },
                    { label: 'Oturdu', value: reservations.filter(r => r.status === 'seated').length, color: 'bg-purple-50 text-purple-600' },
                    { label: 'İptal', value: reservations.filter(r => r.status === 'cancelled').length, color: 'bg-red-50 text-red-600' },
                ].map((stat, i) => (
                    <div key={i} className={`${stat.color} rounded-xl p-4 text-center`}>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-sm opacity-80">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Reservations List */}
            {reservations.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-600 mb-2">Rezervasyon Yok</h2>
                    <p className="text-gray-400">Bu tarih için henüz rezervasyon yapılmamış.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reservations.map(res => (
                        <div key={res.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Time */}
                                    <div className="text-center bg-gray-50 rounded-lg px-4 py-2">
                                        <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                                        <div className="font-bold text-gray-800">{res.reservation_time}</div>
                                    </div>

                                    {/* Customer Info */}
                                    <div>
                                        <div className="font-bold text-gray-800">{res.customer_name}</div>
                                        <div className="text-sm text-gray-500 flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {res.customer_phone}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {res.party_size} kişi
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Table */}
                                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium">
                                        {res.table?.name || 'Masa atanmadı'}
                                    </span>

                                    {/* Status */}
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(res.status)}`}>
                                        {getStatusText(res.status)}
                                    </span>

                                    {/* Actions */}
                                    {res.status === 'confirmed' && (
                                        <>
                                            <button
                                                onClick={() => updateStatus(res.id, 'seated')}
                                                className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                                title="Oturdu"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => updateStatus(res.id, 'cancelled')}
                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                title="İptal"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {res.status === 'seated' && (
                                        <button
                                            onClick={() => updateStatus(res.id, 'completed')}
                                            className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium"
                                        >
                                            Tamamla
                                        </button>
                                    )}
                                </div>
                            </div>

                            {res.note && (
                                <div className="px-4 pb-4">
                                    <div className="bg-yellow-50 text-yellow-700 text-sm p-2 rounded-lg flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {res.note}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Yeni Rezervasyon</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı</label>
                                    <input
                                        required
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Ad Soyad"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                    <input
                                        required
                                        value={formData.customer_phone}
                                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0 5XX XXX XX XX"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.reservation_date || selectedDate}
                                        onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                                    <select
                                        value={formData.reservation_time}
                                        onChange={(e) => setFormData({ ...formData, reservation_time: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {timeSlots.map(time => (
                                            <option key={time} value={time}>{time}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kişi Sayısı</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={formData.party_size}
                                        onChange={(e) => setFormData({ ...formData, party_size: parseInt(e.target.value) })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Masa</label>
                                    <select
                                        value={formData.table_id}
                                        onChange={(e) => setFormData({ ...formData, table_id: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Masa Seçin (Opsiyonel)</option>
                                        {tables.map(table => (
                                            <option key={table.id} value={table.id}>
                                                {table.name} ({table.capacity} kişilik)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Not (Opsiyonel)</label>
                                    <textarea
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Özel istekler, alerji bilgisi, vb."
                                        rows={2}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                            >
                                Rezervasyon Oluştur
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
