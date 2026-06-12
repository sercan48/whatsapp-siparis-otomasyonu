import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon, CheckSquare, ListPlus, ChevronDown, ChevronRight, GripVertical, Upload, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEMO_TENANT_ID } from '../lib/constants';
import { generateUUID } from '../lib/utils';


export const MenuManagement = ({ tenantId: propTenantId }) => {
    const context = useOutletContext();
    const navigate = useNavigate();
    const tenantId = (propTenantId && propTenantId !== DEMO_TENANT_ID) ? propTenantId : (context?.tenantId || DEMO_TENANT_ID);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [businessType, setBusinessType] = useState('restaurant');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        sku: '',
        category: '',
        image_url: '',
        ingredients: [], // Removable ingredients [{name: 'Soğan', included: true}]
        extras: [],      // Add-ons with price [{name: 'Ekstra Peynir', price: 15}]
        modifiers: []    // Variant Groups (legacy)
    });

    useEffect(() => {
        fetchTenantConfig();
        fetchMenu();
    }, []);

    const fetchTenantConfig = async () => {
        try {
            const { data } = await supabase
                .from('tenant_configs')
                .select('business_type')
                .eq('tenant_id', tenantId)
                .single();
            if (data?.business_type) {
                setBusinessType(data.business_type);
            }
        } catch (e) {
            console.error("Config fetch error:", e);
        }
    };

    const fetchMenu = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('name', { ascending: true });

        if (data) setItems(data);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const productPayload = {
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                sku: formData.sku || null,
                meta_data: {
                    category: formData.category,
                    image_url: formData.image_url,
                    ingredients: formData.ingredients,
                    extras: formData.extras,
                    modifiers: formData.modifiers
                }
            };

            if (editingItem) {
                // Update
                const { error } = await supabase.from('products').update(productPayload).eq('id', editingItem.id);
                if (error) throw error;
                toast.success('Ürün başarıyla güncellendi');
            } else {
                // Create
                const { error } = await supabase.from('products').insert([{ ...productPayload, tenant_id: tenantId }]);
                if (error) throw error;
                toast.success('Yeni ürün eklendi');
            }
            closeModal();
            fetchMenu();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) toast.error('Silinemedi: ' + error.message);
        else {
            toast.success('Ürün silindi');
            fetchMenu();
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
        if (!error) fetchMenu();
    };

    const openModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                description: item.description || '',
                price: item.price,
                sku: item.sku || '',
                category: item.meta_data?.category || '',
                image_url: item.meta_data?.image_url || '',
                ingredients: Array.isArray(item.meta_data?.ingredients) ? item.meta_data.ingredients : [],
                extras: Array.isArray(item.meta_data?.extras) ? item.meta_data.extras : [],
                modifiers: Array.isArray(item.meta_data?.modifiers) ? item.meta_data.modifiers : []
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                description: '',
                price: '',
                sku: '',
                category: '',
                image_url: '',
                ingredients: [],
                extras: [],
                modifiers: []
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    // --- Ingredient & Extra Logic ---
    const addIngredient = () => {
        setFormData({
            ...formData,
            ingredients: [...formData.ingredients, { name: '', included: true }]
        });
    };

    const updateIngredient = (idx, value) => {
        const newIngs = [...formData.ingredients];
        newIngs[idx].name = value;
        setFormData({ ...formData, ingredients: newIngs });
    };

    const removeIngredient = (idx) => {
        setFormData({
            ...formData,
            ingredients: formData.ingredients.filter((_, i) => i !== idx)
        });
    };

    const addExtra = () => {
        setFormData({
            ...formData,
            extras: [...formData.extras, { name: '', price: 0 }]
        });
    };

    const updateExtra = (idx, field, value) => {
        const newExtras = [...formData.extras];
        newExtras[idx][field] = field === 'price' ? (parseFloat(value) || 0) : value;
        setFormData({ ...formData, extras: newExtras });
    };

    const removeExtra = (idx) => {
        setFormData({
            ...formData,
            extras: formData.extras.filter((_, i) => i !== idx)
        });
    };

    // --- Variant Logic ---

    const addGroup = () => {
        const newGroup = {
            id: generateUUID(),
            name: '',
            required: false,
            multiple: false,
            options: [{ name: '', price: 0 }]
        };
        setFormData({ ...formData, modifiers: [...formData.modifiers, newGroup] });
    };

    const updateGroup = (idx, field, value) => {
        const newMods = [...formData.modifiers];
        newMods[idx][field] = value;
        setFormData({ ...formData, modifiers: newMods });
    };

    const removeGroup = (idx) => {
        const newMods = formData.modifiers.filter((_, i) => i !== idx);
        setFormData({ ...formData, modifiers: newMods });
    };

    const addOptionToGroup = (groupIdx) => {
        const newMods = [...formData.modifiers];
        newMods[groupIdx].options.push({ name: '', price: 0 });
        setFormData({ ...formData, modifiers: newMods });
    };

    const updateOption = (groupIdx, optIdx, field, value) => {
        const newMods = [...formData.modifiers];
        newMods[groupIdx].options[optIdx][field] = value;
        setFormData({ ...formData, modifiers: newMods });
    };

    const removeOption = (groupIdx, optIdx) => {
        const newMods = [...formData.modifiers];
        newMods[groupIdx].options = newMods[groupIdx].options.filter((_, i) => i !== optIdx);
        setFormData({ ...formData, modifiers: newMods });
    };

    // --- Image Upload Logic ---
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'url'

    const handleImageUpload = async (file) => {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Lütfen bir görsel dosyası seçin');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Görsel boyutu 2MB\'dan küçük olmalı');
            return;
        }

        setUploading(true);
        try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `menu/${tenantId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                // If bucket doesn't exist, try to create it
                if (error.message.includes('Bucket not found') || error.statusCode === 404) {
                    toast.error('Storage bucket oluşturulmalı. Supabase Dashboard → Storage → New Bucket "menu-images"');
                    return;
                }
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            setFormData({ ...formData, image_url: publicUrl });
            toast.success('Görsel yüklendi!');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Yükleme başarısız: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const removeImage = () => {
        setFormData({ ...formData, image_url: '' });
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-slate-50">
            <div className="flex justify-between items-center mb-8 sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm py-4 border-b border-slate-200/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/restore')}
                        className="p-3 bg-white hover:bg-gray-100 text-gray-600 rounded-xl shadow-sm border border-gray-200 transition-all hover:scale-105"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                            {businessType === 'restaurant' ? 'Menü Yönetimi' : 'Ürün ve Katalog Yönetimi'}
                        </h1>
                        <p className="text-gray-500 font-medium">
                            {businessType === 'restaurant' ? 'Gelişmiş seçenekler, fiyatlar ve varyasyonlar.' : 'Katalog ürünleri, fiyatlar ve kategori yönetimi.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Yeni Ürün Ekle
                </button>
            </div>

            {/* Table */}
            {!loading && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600">Ürün</th>
                                <th className="p-4 font-semibold text-gray-600">Kategori</th>
                                <th className="p-4 font-semibold text-gray-600">Fiyat</th>
                                <th className="p-4 font-semibold text-gray-600">Seçenekler</th>
                                <th className="p-4 font-semibold text-gray-600">Durum</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="p-4 flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden">
                                            {item.meta_data?.image_url ? <img src={item.meta_data.image_url} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800">{item.name}</div>
                                            <div className="text-sm text-gray-500 line-clamp-1">{item.description}</div>
                                        </div>
                                    </td>
                                    <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider text-gray-600">{item.meta_data?.category || 'Genel'}</span></td>
                                    <td className="p-4 font-mono font-bold text-gray-700">{item.price} ₺</td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {item.meta_data?.modifiers && item.meta_data.modifiers.length > 0 ? (
                                                item.meta_data.modifiers.map((m, i) => (
                                                    <span key={i} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                                                        {m.name || 'Grup'}
                                                    </span>
                                                ))
                                            ) : <span className="text-gray-300 text-xs">-</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => toggleStatus(item.id, item.is_active)} className={`px-2 py-1 rounded text-xs font-bold ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.is_active ? 'Aktif' : 'Pasif'}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => openModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {items.length === 0 && <div className="p-8 text-center text-gray-400">Ürün bulunamadı.</div>}
                </div>
            )}

            {/* Advanced Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800">{editingItem ? 'Ürünü Düzenle' : 'Yeni Ürün Oluştur'}</h2>
                            <button onClick={closeModal}><X className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 flex overflow-hidden">
                            {/* Left: Basic Info */}
                            <div className="w-1/3 p-6 border-r border-gray-100 overflow-y-auto bg-white space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Temel Bilgiler</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Adı</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Örn: Cheeseburger" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Stok Kodu)</label>
                                    <input value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Örn: CN-102" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat (TL)</label>
                                    <input required type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                    <input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Burger, İçecek, Aksesuar vb." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Görseli</label>

                                    {/* Tab Selector */}
                                    <div className="flex gap-1 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setImageInputMode('upload')}
                                            className={`px-3 py-1 text-xs rounded-lg font-medium flex items-center gap-1 ${imageInputMode === 'upload'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            <Upload className="w-3 h-3" /> Yükle
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setImageInputMode('url')}
                                            className={`px-3 py-1 text-xs rounded-lg font-medium flex items-center gap-1 ${imageInputMode === 'url'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            <LinkIcon className="w-3 h-3" /> URL
                                        </button>
                                    </div>

                                    {imageInputMode === 'upload' ? (
                                        /* Drag & Drop Upload Area */
                                        <div
                                            onDrop={handleDrop}
                                            onDragOver={handleDragOver}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${formData.image_url
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(e.target.files[0])}
                                                className="hidden"
                                            />

                                            {formData.image_url ? (
                                                <div className="relative">
                                                    <img
                                                        src={formData.image_url}
                                                        alt="Ürün görseli"
                                                        className="w-full h-24 object-cover rounded-lg"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); removeImage(); }}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="py-2">
                                                    {uploading ? (
                                                        <div className="flex items-center justify-center gap-2 text-blue-600">
                                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                            <span className="text-sm">Yükleniyor...</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                            <p className="text-xs text-gray-500">
                                                                Sürükle bırak veya <span className="text-blue-600 font-medium">tıkla</span>
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-1">Max 2MB</p>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* URL Input */
                                        <div className="space-y-2">
                                            <input
                                                value={formData.image_url}
                                                onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                                placeholder="https://..."
                                            />
                                            {formData.image_url && (
                                                <div className="relative">
                                                    <img
                                                        src={formData.image_url}
                                                        alt="Önizleme"
                                                        className="w-full h-20 object-cover rounded-lg border"
                                                        onError={(e) => e.target.style.display = 'none'}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" rows="3" />
                                </div>
                            </div>

                            {/* Right: Ingredients, Extras, Variants */}
                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-6">

                                {/* Ingredients (Removable) */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                                <span className="text-lg">🥬</span> Malzemeler
                                            </h3>
                                            <p className="text-xs text-gray-500">Müşteri çıkarmak isteyebilir (Örn: Soğansız)</p>
                                        </div>
                                        <button type="button" onClick={addIngredient} className="text-green-600 text-sm font-medium hover:underline flex items-center">
                                            <Plus className="w-4 h-4 mr-1" /> Malzeme Ekle
                                        </button>
                                    </div>
                                    {formData.ingredients.length === 0 ? (
                                        <p className="text-gray-400 text-sm text-center py-4 border-2 border-dashed rounded-lg">Henüz malzeme eklenmedi</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {formData.ingredients.map((ing, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                                                    <input
                                                        value={ing.name}
                                                        onChange={(e) => updateIngredient(idx, e.target.value)}
                                                        placeholder="Malzeme adı"
                                                        className="bg-transparent border-none focus:ring-0 text-sm w-24 placeholder-green-400"
                                                    />
                                                    <button type="button" onClick={() => removeIngredient(idx)} className="text-green-500 hover:text-red-500">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Extras (Add-ons with price) */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                                <span className="text-lg">✨</span> Ekstralar
                                            </h3>
                                            <p className="text-xs text-gray-500">Ücretli eklemeler (Örn: Ekstra Peynir)</p>
                                        </div>
                                        <button type="button" onClick={addExtra} className="text-purple-600 text-sm font-medium hover:underline flex items-center">
                                            <Plus className="w-4 h-4 mr-1" /> Ekstra Ekle
                                        </button>
                                    </div>
                                    {formData.extras.length === 0 ? (
                                        <p className="text-gray-400 text-sm text-center py-4 border-2 border-dashed rounded-lg">Henüz ekstra eklenmedi</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {formData.extras.map((ext, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                                                    <input
                                                        value={ext.name}
                                                        onChange={(e) => updateExtra(idx, 'name', e.target.value)}
                                                        placeholder="Ekstra adı"
                                                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder-purple-400"
                                                    />
                                                    <span className="text-purple-400 text-sm">+</span>
                                                    <input
                                                        type="number"
                                                        value={ext.price}
                                                        onChange={(e) => updateExtra(idx, 'price', e.target.value)}
                                                        placeholder="0"
                                                        className="w-16 bg-white border border-purple-200 rounded px-2 py-1 text-sm text-right"
                                                    />
                                                    <span className="text-purple-600 text-sm font-medium">₺</span>
                                                    <button type="button" onClick={() => removeExtra(idx)} className="text-purple-400 hover:text-red-500">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Variant Groups (Advanced) */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800">Seçenek Grupları</h3>
                                            <p className="text-xs text-gray-500">Gelişmiş seçenekler (Örn: Sos Seçimi)</p>
                                        </div>
                                        <button type="button" onClick={addGroup} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-black transition-colors">
                                            <ListPlus className="w-4 h-4 mr-1.5" />
                                            Grup Ekle
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {formData.modifiers.length === 0 && (
                                            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-xl">
                                                <p className="text-gray-400 text-sm">Seçenek grubu eklenmedi</p>
                                            </div>
                                        )}

                                        {formData.modifiers.map((group, gIdx) => (
                                            <div key={group.id || gIdx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                {/* Group Header */}
                                                <div className="bg-gray-100 p-3 flex items-center gap-3 border-b border-gray-200">
                                                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                                                    <input
                                                        value={group.name}
                                                        onChange={e => updateGroup(gIdx, 'name', e.target.value)}
                                                        placeholder="Grup Adı (Örn: İçecek Seçimi)"
                                                        className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-gray-800 placeholder-gray-400 text-sm"
                                                    />
                                                    <label className="flex items-center space-x-2 text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                                                        <input type="checkbox" checked={group.required} onChange={e => updateGroup(gIdx, 'required', e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                                                        <span>Zorunlu?</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                                                        <input type="checkbox" checked={group.multiple} onChange={e => updateGroup(gIdx, 'multiple', e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                                                        <span>Çoklu Seçim?</span>
                                                    </label>
                                                    <button type="button" onClick={() => removeGroup(gIdx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                                                </div>

                                                {/* Options List */}
                                                <div className="p-3 bg-gray-50/50 space-y-2">
                                                    {group.options.map((opt, oIdx) => (
                                                        <div key={oIdx} className="flex items-center gap-2 pl-6">
                                                            <ChevronRight className="w-3 h-3 text-gray-300" />
                                                            <input
                                                                value={opt.name}
                                                                onChange={e => updateOption(gIdx, oIdx, 'name', e.target.value)}
                                                                placeholder="Seçenek Adı (Örn: Kola)"
                                                                className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:border-blue-400 outline-none"
                                                            />
                                                            <input
                                                                type="number"
                                                                value={opt.price}
                                                                onChange={e => updateOption(gIdx, oIdx, 'price', parseFloat(e.target.value) || 0)}
                                                                placeholder="Ek Ücret"
                                                                className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:border-blue-400 outline-none text-right"
                                                            />
                                                            <span className="text-xs text-gray-400 font-mono">TL</span>
                                                            <button type="button" onClick={() => removeOption(gIdx, oIdx)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => addOptionToGroup(gIdx)} className="ml-6 mt-2 text-xs text-blue-600 font-medium hover:underline flex items-center">
                                                        <Plus className="w-3 h-3 mr-1" />
                                                        Seçenek Ekle
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-2xl">
                            <button type="button" onClick={closeModal} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">İptal</button>
                            <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 transition-all transform active:scale-95">Değişiklikleri Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
