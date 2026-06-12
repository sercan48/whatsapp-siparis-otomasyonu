import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    Package, Plus, X, Save, Trash2, AlertTriangle, Search,
    TrendingDown, TrendingUp, Truck, Edit2, Filter, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export const InventoryManagement = () => {
    const [ingredients, setIngredients] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [lowStockAlerts, setLowStockAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showIngredientModal, setShowIngredientModal] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [activeTab, setActiveTab] = useState('ingredients'); // ingredients, suppliers, alerts
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [editingItem, setEditingItem] = useState(null);

    const [ingredientForm, setIngredientForm] = useState({
        name: '', sku: '', category: 'other', unit: 'adet',
        current_stock: 0, min_stock_level: 0, cost_per_unit: 0,
        default_supplier_id: '', storage_type: 'room', shelf_life_days: null
    });

    const [supplierForm, setSupplierForm] = useState({
        name: '', contact_person: '', phone: '', email: '',
        address: '', payment_terms: '', category: 'other'
    });

    const [transactionForm, setTransactionForm] = useState({
        ingredient_id: '', transaction_type: 'purchase',
        quantity: 0, unit_cost: 0, description: '', supplier_id: ''
    });

    const categories = [
        { value: 'meat', label: 'Et & Tavuk' },
        { value: 'dairy', label: 'Süt Ürünleri' },
        { value: 'vegetables', label: 'Sebze & Meyve' },
        { value: 'spices', label: 'Baharat' },
        { value: 'grains', label: 'Tahıl & Un' },
        { value: 'beverages', label: 'İçecekler' },
        { value: 'packaging', label: 'Ambalaj' },
        { value: 'other', label: 'Diğer' }
    ];

    const units = ['kg', 'g', 'lt', 'ml', 'adet', 'porsiyon', 'kutu', 'paket'];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch ingredients
            const { data: ingredientsData } = await supabase
                .from('ingredients')
                .select('*, supplier:suppliers(name)')
                .eq('tenant_id', user.id)
                .eq('is_active', true)
                .order('name');

            // Fetch suppliers
            const { data: suppliersData } = await supabase
                .from('suppliers')
                .select('*')
                .eq('tenant_id', user.id)
                .eq('is_active', true)
                .order('name');

            // Fetch low stock alerts
            const { data: alertsData } = await supabase
                .from('low_stock_alerts')
                .select('*')
                .eq('tenant_id', user.id);

            setIngredients(ingredientsData || []);
            setSuppliers(suppliersData || []);
            setLowStockAlerts(alertsData || []);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Veri yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveIngredient = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (editingItem) {
                const { error } = await supabase
                    .from('ingredients')
                    .update(ingredientForm)
                    .eq('id', editingItem.id);
                if (error) throw error;
                toast.success('Hammadde güncellendi');
            } else {
                const { error } = await supabase
                    .from('ingredients')
                    .insert({ ...ingredientForm, tenant_id: user.id });
                if (error) throw error;
                toast.success('Hammadde eklendi');
            }

            resetIngredientForm();
            fetchData();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    const handleSaveSupplier = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (editingItem) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(supplierForm)
                    .eq('id', editingItem.id);
                if (error) throw error;
                toast.success('Tedarikçi güncellendi');
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert({ ...supplierForm, tenant_id: user.id });
                if (error) throw error;
                toast.success('Tedarikçi eklendi');
            }

            resetSupplierForm();
            fetchData();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    const handleAddTransaction = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const ingredient = ingredients.find(i => i.id === transactionForm.ingredient_id);
            if (!ingredient) return;

            const qty = transactionForm.transaction_type === 'purchase'
                ? parseFloat(transactionForm.quantity)
                : -parseFloat(transactionForm.quantity);

            // Insert transaction
            const { error: txError } = await supabase
                .from('inventory_transactions')
                .insert({
                    tenant_id: user.id,
                    ingredient_id: transactionForm.ingredient_id,
                    transaction_type: transactionForm.transaction_type,
                    quantity: qty,
                    unit: ingredient.unit,
                    unit_cost: transactionForm.unit_cost || null,
                    total_cost: Math.abs(qty) * (transactionForm.unit_cost || 0),
                    reference_type: 'manual',
                    stock_before: ingredient.current_stock,
                    stock_after: ingredient.current_stock + qty,
                    description: transactionForm.description,
                    supplier_id: transactionForm.supplier_id || null
                });

            if (txError) throw txError;

            // Update ingredient stock
            const { error: updateError } = await supabase
                .from('ingredients')
                .update({
                    current_stock: ingredient.current_stock + qty,
                    last_purchase_price: transactionForm.transaction_type === 'purchase' ? transactionForm.unit_cost : ingredient.last_purchase_price,
                    last_purchase_date: transactionForm.transaction_type === 'purchase' ? new Date().toISOString().split('T')[0] : ingredient.last_purchase_date
                })
                .eq('id', transactionForm.ingredient_id);

            if (updateError) throw updateError;

            toast.success('Stok hareketi kaydedildi');
            setShowTransactionModal(false);
            resetTransactionForm();
            fetchData();
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm('Silmek istediğinize emin misiniz?')) return;

        try {
            const table = type === 'ingredient' ? 'ingredients' : 'suppliers';
            const { error } = await supabase
                .from(table)
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
            toast.success('Silindi');
            fetchData();
        } catch (error) {
            toast.error('Silme hatası');
        }
    };

    const resetIngredientForm = () => {
        setIngredientForm({
            name: '', sku: '', category: 'other', unit: 'adet',
            current_stock: 0, min_stock_level: 0, cost_per_unit: 0,
            default_supplier_id: '', storage_type: 'room', shelf_life_days: null
        });
        setEditingItem(null);
        setShowIngredientModal(false);
    };

    const resetSupplierForm = () => {
        setSupplierForm({
            name: '', contact_person: '', phone: '', email: '',
            address: '', payment_terms: '', category: 'other'
        });
        setEditingItem(null);
        setShowSupplierModal(false);
    };

    const resetTransactionForm = () => {
        setTransactionForm({
            ingredient_id: '', transaction_type: 'purchase',
            quantity: 0, unit_cost: 0, description: '', supplier_id: ''
        });
    };

    const openEditIngredient = (item) => {
        setIngredientForm({
            name: item.name,
            sku: item.sku || '',
            category: item.category,
            unit: item.unit,
            current_stock: item.current_stock,
            min_stock_level: item.min_stock_level,
            cost_per_unit: item.cost_per_unit,
            default_supplier_id: item.default_supplier_id || '',
            storage_type: item.storage_type || 'room',
            shelf_life_days: item.shelf_life_days
        });
        setEditingItem(item);
        setShowIngredientModal(true);
    };

    const filteredIngredients = ingredients.filter(i => {
        const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || i.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const getAlertColor = (level) => {
        switch (level) {
            case 'out_of_stock': return 'bg-red-100 text-red-700 border-red-200';
            case 'critical': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-gray-400">Yükleniyor...</div></div>;
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Envanter Yönetimi</h1>
                    <p className="text-gray-500">Hammadde, stok ve tedarikçi yönetimi</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTransactionModal(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
                    >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Stok Girişi
                    </button>
                    <button
                        onClick={() => setShowIngredientModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Hammadde Ekle
                    </button>
                </div>
            </div>

            {/* Low Stock Alerts */}
            {lowStockAlerts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h3 className="font-bold text-red-800">Kritik Stok Uyarıları ({lowStockAlerts.length})</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStockAlerts.map(alert => (
                            <span key={alert.id} className={`px-3 py-1 rounded-full text-sm font-medium ${getAlertColor(alert.alert_level)}`}>
                                {alert.name}: {alert.current_stock} {alert.unit}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { id: 'ingredients', label: 'Hammaddeler', count: ingredients.length },
                    { id: 'suppliers', label: 'Tedarikçiler', count: suppliers.length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Ingredients Tab */}
            {activeTab === 'ingredients' && (
                <>
                    {/* Search & Filter */}
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1 relative">
                            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Hammadde ara..."
                            />
                        </div>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg bg-white"
                        >
                            <option value="all">Tüm Kategoriler</option>
                            {categories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Ingredients Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-4 font-bold text-gray-600 text-sm">Hammadde</th>
                                    <th className="text-left p-4 font-bold text-gray-600 text-sm">Kategori</th>
                                    <th className="text-right p-4 font-bold text-gray-600 text-sm">Stok</th>
                                    <th className="text-right p-4 font-bold text-gray-600 text-sm">Min</th>
                                    <th className="text-right p-4 font-bold text-gray-600 text-sm">Maliyet</th>
                                    <th className="text-center p-4 font-bold text-gray-600 text-sm">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredIngredients.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{item.name}</div>
                                            {item.sku && <div className="text-xs text-gray-400">SKU: {item.sku}</div>}
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {categories.find(c => c.value === item.category)?.label || item.category}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-bold ${item.current_stock <= item.min_stock_level ? 'text-red-600' : 'text-gray-800'}`}>
                                                {item.current_stock} {item.unit}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-gray-500">{item.min_stock_level} {item.unit}</td>
                                        <td className="p-4 text-right text-gray-800 font-medium">₺{item.cost_per_unit?.toFixed(2) || '0.00'}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button
                                                    onClick={() => openEditIngredient(item)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete('ingredient', item.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Suppliers Tab */}
            {activeTab === 'suppliers' && (
                <>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowSupplierModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Tedarikçi Ekle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suppliers.map(supplier => (
                            <div key={supplier.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Truck className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800">{supplier.name}</h3>
                                            <p className="text-sm text-gray-500">{supplier.contact_person}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete('supplier', supplier.id)}
                                        className="p-1 text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                    {supplier.phone && <div>📞 {supplier.phone}</div>}
                                    {supplier.email && <div>✉️ {supplier.email}</div>}
                                    {supplier.payment_terms && <div>💳 {supplier.payment_terms}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Ingredient Modal */}
            {showIngredientModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingItem ? 'Hammadde Düzenle' : 'Yeni Hammadde'}
                            </h2>
                            <button onClick={resetIngredientForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveIngredient} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Hammadde Adı</label>
                                    <input
                                        required
                                        value={ingredientForm.name}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Örn: Dana Kıyma"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                    <select
                                        value={ingredientForm.category}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, category: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
                                    <select
                                        value={ingredientForm.unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                                    >
                                        {units.map(unit => (
                                            <option key={unit} value={unit}>{unit}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mevcut Stok</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={ingredientForm.current_stock}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: parseFloat(e.target.value) })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min. Stok Seviyesi</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={ingredientForm.min_stock_level}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, min_stock_level: parseFloat(e.target.value) })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Birim Maliyet (₺)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={ingredientForm.cost_per_unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, cost_per_unit: parseFloat(e.target.value) })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tedarikçi</label>
                                    <select
                                        value={ingredientForm.default_supplier_id}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, default_supplier_id: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                            >
                                {editingItem ? 'Güncelle' : 'Ekle'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Supplier Modal */}
            {showSupplierModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Yeni Tedarikçi</h2>
                            <button onClick={resetSupplierForm} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Firma Adı</label>
                                <input
                                    required
                                    value={supplierForm.name}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5"
                                    placeholder="Örn: ABC Gıda"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Yetkili</label>
                                    <input
                                        value={supplierForm.contact_person}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                    <input
                                        value={supplierForm.phone}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                                <input
                                    type="email"
                                    value={supplierForm.email}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Koşulları</label>
                                <input
                                    value={supplierForm.payment_terms}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5"
                                    placeholder="Örn: 30 gün vadeli"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                            >
                                Tedarikçi Ekle
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Transaction Modal */}
            {showTransactionModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">Stok Hareketi</h2>
                            <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hammadde</label>
                                <select
                                    required
                                    value={transactionForm.ingredient_id}
                                    onChange={(e) => setTransactionForm({ ...transactionForm, ingredient_id: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                                >
                                    <option value="">Seçiniz...</option>
                                    {ingredients.map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tipi</label>
                                <select
                                    value={transactionForm.transaction_type}
                                    onChange={(e) => setTransactionForm({ ...transactionForm, transaction_type: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                                >
                                    <option value="purchase">Satın Alma (Giriş)</option>
                                    <option value="waste">Fire/Hurda (Çıkış)</option>
                                    <option value="adjustment">Manuel Düzeltme</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={transactionForm.quantity}
                                        onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Birim Fiyat (₺)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={transactionForm.unit_cost}
                                        onChange={(e) => setTransactionForm({ ...transactionForm, unit_cost: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                                <input
                                    value={transactionForm.description}
                                    onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5"
                                    placeholder="Örn: Haftalık alım"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                            >
                                Kaydet
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
