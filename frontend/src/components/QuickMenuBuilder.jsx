import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    Plus, Trash2, Save, Tag, FolderPlus, Check, Sparkles, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';

export const QuickMenuBuilder = ({ tenantId }) => {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New item form
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        category_id: '',
        description: '',
        image_url: ''
    });

    // New category form
    const [newCategory, setNewCategory] = useState('');
    const [showCategoryForm, setShowCategoryForm] = useState(false);

    useEffect(() => {
        if (tenantId) fetchMenuData();
    }, [tenantId]);

    const fetchMenuData = async () => {
        setLoading(true);

        // Fetch categories
        const { data: cats } = await supabase
            .from('menu_categories')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('sort_order');

        // Fetch items
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('*, menu_categories(name)')
            .eq('tenant_id', tenantId)
            .order('name');

        setCategories(cats || []);
        setItems(menuItems || []);
        setLoading(false);
    };

    const addCategory = async () => {
        if (!newCategory.trim()) return;

        const { error } = await supabase
            .from('menu_categories')
            .insert({
                tenant_id: tenantId,
                name: newCategory,
                sort_order: categories.length
            });

        if (error) {
            toast.error('Kategori eklenemedi');
        } else {
            toast.success('Kategori eklendi!');
            setNewCategory('');
            setShowCategoryForm(false);
            fetchMenuData();
        }
    };

    const addItem = async () => {
        if (!newItem.name || !newItem.price || !newItem.category_id) {
            toast.error('Ad, fiyat ve kategori zorunlu');
            return;
        }

        setSaving(true);
        const { error } = await supabase
            .from('menu_items')
            .insert({
                tenant_id: tenantId,
                name: newItem.name,
                price: parseFloat(newItem.price),
                category_id: newItem.category_id,
                description: newItem.description,
                image_url: newItem.image_url || null,
                is_available: true
            });

        if (error) {
            toast.error('Ürün eklenemedi');
        } else {
            toast.success('Ürün eklendi!');
            setNewItem({ name: '', price: '', category_id: '', description: '', image_url: '' });
            fetchMenuData();
        }
        setSaving(false);
    };

    const deleteItem = async (itemId) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;

        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', itemId);

        if (error) {
            toast.error('Silinemedi');
        } else {
            toast.success('Silindi');
            fetchMenuData();
        }
    };

    const toggleAvailability = async (itemId, currentStatus) => {
        const { error } = await supabase
            .from('menu_items')
            .update({ is_available: !currentStatus })
            .eq('id', itemId);

        if (!error) {
            fetchMenuData();
        }
    };

    const duplicateItem = async (item) => {
        const { error } = await supabase
            .from('menu_items')
            .insert({
                tenant_id: tenantId,
                name: `${item.name} (Kopya)`,
                price: item.price,
                category_id: item.category_id,
                description: item.description,
                image_url: item.image_url,
                is_available: true
            });

        if (!error) {
            toast.success('Kopyalandı!');
            fetchMenuData();
        }
    };

    // Quick templates for common items
    const templates = [
        { name: 'Burger', price: 150, category: 'Ana Yemek' },
        { name: 'Pizza', price: 180, category: 'Ana Yemek' },
        { name: 'Kola', price: 35, category: 'İçecek' },
        { name: 'Su', price: 15, category: 'İçecek' },
        { name: 'Patates Kızartması', price: 50, category: 'Yan Ürün' },
        { name: 'Sufle', price: 80, category: 'Tatlı' },
    ];

    const addFromTemplate = async (template) => {
        // Find or create category
        let categoryId = categories.find(c => c.name === template.category)?.id;

        if (!categoryId) {
            const { data: newCat } = await supabase
                .from('menu_categories')
                .insert({ tenant_id: tenantId, name: template.category, sort_order: categories.length })
                .select()
                .single();
            categoryId = newCat?.id;
        }

        if (categoryId) {
            await supabase
                .from('menu_items')
                .insert({
                    tenant_id: tenantId,
                    name: template.name,
                    price: template.price,
                    category_id: categoryId,
                    is_available: true
                });
            toast.success(`${template.name} eklendi!`);
            fetchMenuData();
        }
    };

    if (loading) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <div className="text-gray-400">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-8 h-8 text-purple-500" />
                        Hızlı Menü Oluşturucu
                    </h1>
                    <p className="text-gray-500">Dijital menünüzü dakikalar içinde oluşturun</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
                        {items.length} Ürün
                    </span>
                    <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium">
                        {categories.length} Kategori
                    </span>
                </div>
            </div>

            {/* Quick Templates */}
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl text-white">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Hızlı Şablonlar (Tek Tıkla Ekle)
                </h3>
                <div className="flex flex-wrap gap-3">
                    {templates.map((t, i) => (
                        <button
                            key={i}
                            onClick={() => addFromTemplate(t)}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm"
                        >
                            {t.name} - {t.price}₺
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Categories Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <FolderPlus className="w-5 h-5 text-blue-500" />
                            Kategoriler
                        </span>
                        <button
                            onClick={() => setShowCategoryForm(!showCategoryForm)}
                            className="p-1 hover:bg-gray-100 rounded"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </h3>

                    {showCategoryForm && (
                        <div className="mb-4 flex gap-2">
                            <input
                                type="text"
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                placeholder="Kategori adı"
                                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                            />
                            <button
                                onClick={addCategory}
                                className="p-2 bg-green-500 text-white rounded-lg"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {categories.map(cat => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <span className="font-medium">{cat.name}</span>
                                <span className="text-xs text-gray-400">
                                    {items.filter(i => i.category_id === cat.id).length} ürün
                                </span>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-gray-400 text-sm text-center py-4">
                                Henüz kategori yok
                            </p>
                        )}
                    </div>
                </div>

                {/* Add Item Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-green-500" />
                        Yeni Ürün Ekle
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Ürün Adı *</label>
                            <input
                                type="text"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                placeholder="Örn: Classic Burger"
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Fiyat (₺) *</label>
                            <input
                                type="number"
                                value={newItem.price}
                                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                placeholder="150"
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Kategori *</label>
                            <select
                                value={newItem.category_id}
                                onChange={e => setNewItem({ ...newItem, category_id: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="">Seçin...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Açıklama</label>
                            <textarea
                                value={newItem.description}
                                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                placeholder="Malzemeler, boyut vb."
                                className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Görsel URL</label>
                            <input
                                type="url"
                                value={newItem.image_url}
                                onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <button
                            onClick={addItem}
                            disabled={saving}
                            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Ekleniyor...' : 'Ürün Ekle'}
                        </button>
                    </div>
                </div>

                {/* Items List */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-orange-500" />
                        Mevcut Ürünler
                    </h3>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {items.map(item => (
                            <div
                                key={item.id}
                                className={`p-3 rounded-lg border transition-colors ${item.is_available
                                    ? 'bg-white border-gray-200'
                                    : 'bg-gray-100 border-gray-300 opacity-60'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {item.image_url && (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-12 h-12 rounded-lg object-cover"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{item.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {item.menu_categories?.name} • {item.price}₺
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => toggleAvailability(item.id, item.is_available)}
                                            className={`p-1.5 rounded ${item.is_available ? 'text-green-600' : 'text-gray-400'}`}
                                            title={item.is_available ? 'Stokta' : 'Stok Dışı'}
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => duplicateItem(item)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            title="Kopyala"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteItem(item.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                            title="Sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <p className="text-gray-400 text-sm text-center py-8">
                                Henüz ürün yok. Şablonlardan veya formdan ekleyin.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
