import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Save, X, Megaphone, Tag, AlertCircle, Sparkles } from 'lucide-react';
import { DEMO_TENANT_ID } from '../lib/constants';

export const CampaignsManagement = ({ tenantId = DEMO_TENANT_ID }) => {
    const [campaigns, setCampaigns] = useState([]);
    const [menuItems, setMenuItems] = useState([]); // For product selection
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'percent', // percent, amount, product_discount
        rules: { value: 0, min_basket: 0, target_product_id: null },
        is_active: true,
        // Time-based scheduling
        schedule_type: 'always', // always, time_based
        start_time: '',
        end_time: '',
        active_days: [0, 1, 2, 3, 4, 5, 6] // All days by default
    });

    useEffect(() => {
        fetchCampaigns();
        fetchMenu();
    }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        if (data) setCampaigns(data);
        setLoading(false);
    };

    const fetchMenu = async () => {
        const { data } = await supabase.from('products').select('id, name, price');
        if (data) setMenuItems(data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Validate Logic for Product Discount
            if (formData.type === 'product_discount' && !formData.rules.target_product_id) {
                alert('Lütfen indirim yapılacak ürünü seçiniz.');
                return;
            }

            const payload = {
                ...formData,
                tenant_id: tenantId,
                start_time: formData.start_time || null,
                end_time: formData.end_time || null
            };

            const { error } = await supabase
                .from('campaigns')
                .insert([payload]);

            if (error) throw error;

            closeModal();
            fetchCampaigns();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Kampanyayı silmek istediğinize emin misiniz?')) return;
        const { error } = await supabase.from('campaigns').delete().eq('id', id);
        if (!error) fetchCampaigns();
    };

    const toggleStatus = async (id, currentStatus) => {
        const { error } = await supabase.from('campaigns').update({ is_active: !currentStatus }).eq('id', id);
        if (!error) fetchCampaigns();
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFormData({
            name: '',
            type: 'percent',
            rules: { value: 0, min_basket: 0, target_product_id: null },
            is_active: true,
            schedule_type: 'always',
            start_time: '',
            end_time: '',
            active_days: [0, 1, 2, 3, 4, 5, 6]
        });
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50 h-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Kampanya Yönetimi</h1>
                    <p className="text-gray-500">Müşterilerinize özel indirimler ve fırsatlar oluşturun.</p>
                </div>
                <div className="flex gap-3">
                    <a
                        href="/restore/campaign-generator"
                        className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center shadow-lg transform active:scale-95 transition-all"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        AI Görsel Oluştur
                    </a>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center shadow-lg transform active:scale-95 transition-all"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Yeni Kampanya
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(camp => (
                    <div key={camp.id} className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all ${!camp.is_active ? 'opacity-60' : ''}`}>
                        <div className={`absolute top-0 right-0 p-2 rounded-bl-lg text-xs font-bold ${camp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {camp.is_active ? 'AKTİF' : 'PASİF'}
                        </div>

                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                <Megaphone className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-800">{camp.name}</h3>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between">
                                <span>Tip:</span>
                                <span className="font-semibold text-gray-800">
                                    {camp.type === 'percent' && 'Yüzde İndirim'}
                                    {camp.type === 'amount' && 'Tutar İndirimi'}
                                    {camp.type === 'product_discount' && 'Ürün İndirimi'}
                                </span>
                            </div>

                            {/* Smart Description of Rule */}
                            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                                <span>Kural:</span>
                                <span className="font-bold text-gray-900">
                                    {camp.type === 'percent' && `%${camp.rules.value} İndirim`}
                                    {camp.type === 'amount' && `${camp.rules.value} TL İndirim`}
                                    {camp.type === 'product_discount' && `${menuItems.find(m => m.id === camp.rules.target_product_id)?.name || 'Ürün'} -> ${camp.rules.value} TL`}
                                </span>
                            </div>

                            {camp.rules.min_basket > 0 && (
                                <div className="text-xs text-orange-600 mt-1 flex items-center">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Min Sepet: {camp.rules.min_basket} TL
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-2 mt-2">
                            <button
                                onClick={() => toggleStatus(camp.id, camp.is_active)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-900 px-3 py-1 border rounded hover:bg-gray-50 bg-white"
                            >
                                {camp.is_active ? 'Durdur' : 'Başlat'}
                            </button>
                            <button
                                onClick={() => handleDelete(camp.id)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl sticky top-0">
                            <h2 className="text-xl font-bold text-gray-800">Yeni Kampanya</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kampanya Adı</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Örn: Yaz Fırsatı"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İndirim Tipi</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                >
                                    <option value="percent">Yüzde İndirim (%)</option>
                                    <option value="amount">Tutar İndirimi (TL)</option>
                                    <option value="product_discount">Belirli Ürüne Özel Fiyat</option>
                                </select>
                            </div>

                            {/* Dynamic Fields Based on Type */}
                            <div className="bg-purple-50 p-4 rounded-lg space-y-3">

                                {formData.type === 'percent' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">İndirim Oranı (%)</label>
                                        <input
                                            type="number"
                                            value={formData.rules.value}
                                            onChange={e => setFormData({ ...formData, rules: { ...formData.rules, value: e.target.value } })}
                                            className="w-full border border-gray-300 rounded p-2 text-sm"
                                            placeholder="10"
                                        />
                                    </div>
                                )}

                                {formData.type === 'amount' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">İndirim Tutarı (TL)</label>
                                        <input
                                            type="number"
                                            value={formData.rules.value}
                                            onChange={e => setFormData({ ...formData, rules: { ...formData.rules, value: e.target.value } })}
                                            className="w-full border border-gray-300 rounded p-2 text-sm"
                                            placeholder="50"
                                        />
                                    </div>
                                )}

                                {formData.type === 'product_discount' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Hangi Ürün?</label>
                                            <select
                                                className="w-full border border-gray-300 rounded p-2 text-sm bg-white"
                                                onChange={e => setFormData({ ...formData, rules: { ...formData.rules, target_product_id: e.target.value } })}
                                            >
                                                <option value="">Ürün Seçiniz...</option>
                                                {menuItems.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name} ({m.price} TL)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Yeni Kampanyalı Fiyatı (TL)</label>
                                            <input
                                                type="number"
                                                value={formData.rules.value}
                                                onChange={e => setFormData({ ...formData, rules: { ...formData.rules, value: e.target.value } })}
                                                className="w-full border border-gray-300 rounded p-2 text-sm"
                                                placeholder="Örn: 50 (Normali 100 ise)"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="pt-2 border-t border-purple-100">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Min. Sepet Tutarı (Opsiyonel)</label>
                                    <input
                                        type="number"
                                        value={formData.rules.min_basket}
                                        onChange={e => setFormData({ ...formData, rules: { ...formData.rules, min_basket: e.target.value } })}
                                        className="w-full border border-gray-300 rounded p-2 text-sm"
                                        placeholder="0"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Sadece bu tutarın üzerindeki siparişlerde geçerli olur.</p>
                                </div>

                                {/* Time-Based Scheduling */}
                                <div className="pt-3 border-t border-purple-100">
                                    <label className="block text-xs font-bold text-gray-700 mb-2">⏰ Zamanlama</label>
                                    <select
                                        value={formData.schedule_type}
                                        onChange={e => setFormData({ ...formData, schedule_type: e.target.value })}
                                        className="w-full border border-gray-300 rounded p-2 text-sm bg-white mb-2"
                                    >
                                        <option value="always">Her Zaman Aktif</option>
                                        <option value="time_based">Belirli Saatlerde</option>
                                    </select>

                                    {formData.schedule_type === 'time_based' && (
                                        <div className="space-y-3 bg-white p-3 rounded-lg border">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 mb-1">Başlangıç</label>
                                                    <input
                                                        type="time"
                                                        value={formData.start_time}
                                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                        className="w-full border rounded p-2 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 mb-1">Bitiş</label>
                                                    <input
                                                        type="time"
                                                        value={formData.end_time}
                                                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                        className="w-full border rounded p-2 text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-2">Aktif Günler</label>
                                                <div className="flex flex-wrap gap-1">
                                                    {['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'].map((day, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                const days = formData.active_days.includes(idx)
                                                                    ? formData.active_days.filter(d => d !== idx)
                                                                    : [...formData.active_days, idx];
                                                                setFormData({ ...formData, active_days: days });
                                                            }}
                                                            className={`w-8 h-8 rounded-full text-xs font-bold ${formData.active_days.includes(idx)
                                                                ? 'bg-purple-500 text-white'
                                                                : 'bg-gray-100 text-gray-500'
                                                                }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition-all"
                            >
                                Kampanyayı Oluştur
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
