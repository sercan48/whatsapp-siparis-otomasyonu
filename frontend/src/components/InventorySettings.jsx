import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Edit, Save, Package, ChefHat, Truck, AlertTriangle, BarChart2 } from 'lucide-react';
import { InventoryAnalytics } from './InventoryAnalytics';
import toast from 'react-hot-toast';

export const InventorySettings = ({ tenantId }) => {
    const [activeTab, setActiveTab] = useState('ingredients'); // ingredients, recipes, suppliers

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-6 border-b pb-4">
                <button
                    onClick={() => setActiveTab('ingredients')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'ingredients' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Package className="w-5 h-5" /> Hammaddeler
                </button>
                <button
                    onClick={() => setActiveTab('recipes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'recipes' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <ChefHat className="w-5 h-5" /> Reçeteler
                </button>
                <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'suppliers' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Truck className="w-5 h-5" /> Tedarikçiler
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'analytics' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <BarChart2 className="w-5 h-5" /> AI Analiz
                </button>
            </div>

            {activeTab === 'ingredients' && <IngredientsManager tenantId={tenantId} />}
            {activeTab === 'recipes' && <RecipeManager tenantId={tenantId} />}
            {activeTab === 'suppliers' && <SupplierManager tenantId={tenantId} />}
            {activeTab === 'analytics' && <InventoryAnalytics tenantId={tenantId} />}
        </div>
    );
};

const IngredientsManager = ({ tenantId }) => {
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newIng, setNewIng] = useState({ name: '', unit: 'kg', cost_per_unit: 0, alert_threshold: 5 });

    useEffect(() => {
        if (tenantId) fetchIngredients();
    }, [tenantId]);

    const fetchIngredients = async () => {
        if (!tenantId) return;
        try {
            const { data, error } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId).order('name');
            if (error) throw error;
            setIngredients(data || []);
        } catch (error) { console.warn('Ingredients fetch error:', error.message); } finally { setLoading(false); }
    };

    const addIngredient = async () => {
        if (!newIng.name) return toast.error('İsim gerekli');
        try {
            const { data, error } = await supabase.from('ingredients').insert([{ ...newIng, tenant_id: tenantId }]).select().single();
            if (error) throw error;
            setIngredients([...ingredients, data]);
            setNewIng({ name: '', unit: 'kg', cost_per_unit: 0, alert_threshold: 5 });
            toast.success('Eklendi');
        } catch (error) { toast.error('Eklenemedi'); }
    };

    const deleteIngredient = async (id) => {
        if (!confirm('Silmek istediğine emin misin?')) return;
        await supabase.from('ingredients').delete().eq('id', id);
        setIngredients(ingredients.filter(i => i.id !== id));
    };

    return (
        <div>
            <div className="grid grid-cols-5 gap-2 mb-4 bg-gray-50 p-4 rounded-lg">
                <input placeholder="Hammadde Adı (Örn: Dana Kıyma)" value={newIng.name} onChange={e => setNewIng({ ...newIng, name: e.target.value })} className="col-span-2 border p-2 rounded" />
                <select value={newIng.unit} onChange={e => setNewIng({ ...newIng, unit: e.target.value })} className="border p-2 rounded">
                    <option value="kg">KG</option>
                    <option value="g">Gram</option>
                    <option value="lt">Litre</option>
                    <option value="ml">Mililitre</option>
                    <option value="adet">Adet</option>
                </select>
                <input type="number" placeholder="Birim Maliyet" value={newIng.cost_per_unit} onChange={e => setNewIng({ ...newIng, cost_per_unit: e.target.value })} className="border p-2 rounded" />
                <button onClick={addIngredient} className="bg-orange-500 text-white font-bold rounded hover:bg-orange-600">Ekle</button>
            </div>

            <div className="space-y-2">
                {ingredients.map(ing => (
                    <div key={ing.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                        <div className="flex-1 font-medium">{ing.name}</div>
                        <div className="w-24 text-sm text-gray-500">{ing.current_stock} {ing.unit}</div>
                        <div className="w-24 text-sm text-gray-500">{ing.cost_per_unit} ₺/{ing.unit}</div>
                        <button onClick={() => deleteIngredient(ing.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RecipeManager = ({ tenantId }) => {
    // Basic MVP for Recipe Mapping
    const [menuItems, setMenuItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [ingredients, setIngredients] = useState([]);
    const [recipes, setRecipes] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            const { data: menu } = await supabase.from('menu_items').select('*').eq('tenant_id', tenantId);
            const { data: ing } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId);
            setMenuItems(menu || []);
            setIngredients(ing || []);
        };
        loadData();
    }, [tenantId]);

    useEffect(() => {
        if (selectedItem) fetchRecipes(selectedItem);
    }, [selectedItem]);

    const fetchRecipes = async (itemId) => {
        const { data } = await supabase.from('product_recipes').select('*, ingredient:ingredients(name, unit)').eq('menu_item_id', itemId);
        setRecipes(data || []);
    };

    const addRecipeItem = async (e) => {
        e.preventDefault();
        const ingId = e.target.ingredient.value;
        const qty = e.target.quantity.value;
        if (!ingId || !qty) return;

        const { error } = await supabase.from('product_recipes').insert({
            menu_item_id: selectedItem,
            ingredient_id: ingId,
            quantity_required: qty
        });

        if (!error) {
            fetchRecipes(selectedItem);
            toast.success('Reçete güncellendi');
            e.target.reset();
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-r pr-6">
                <h3 className="font-bold mb-4">Menü Ürünleri</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {menuItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedItem(item.id)}
                            className={`p-3 rounded cursor-pointer border ${selectedItem === item.id ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`}
                        >
                            {item.name}
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="font-bold mb-4">Reçete Detayı</h3>
                {selectedItem ? (
                    <div>
                        <div className="space-y-2 mb-4">
                            {recipes.map(r => (
                                <div key={r.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                    <span>{r.ingredient?.name}</span>
                                    <span className="font-mono">{r.quantity_required} {r.ingredient?.unit}</span>
                                    <button onClick={async () => {
                                        await supabase.from('product_recipes').delete().eq('id', r.id);
                                        fetchRecipes(selectedItem);
                                    }} className="text-red-500">Sil</button>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={addRecipeItem} className="flex gap-2 items-center bg-blue-50 p-3 rounded-lg">
                            <select name="ingredient" className="flex-1 p-2 border rounded text-sm">
                                <option value="">Hammadde Seç...</option>
                                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                            </select>
                            <input name="quantity" type="number" step="0.001" placeholder="Miktar" className="w-20 p-2 border rounded text-sm" />
                            <button type="submit" className="bg-blue-600 text-white p-2 rounded text-sm font-bold">Ekle</button>
                        </form>
                    </div>
                ) : (
                    <div className="text-gray-400 text-center mt-10">Ürün seçiniz...</div>
                )}
            </div>
        </div>
    );
};

const SupplierManager = ({ tenantId }) => {
    // Placeholder for Supplier Management
    return <div className="text-center text-gray-500 py-10">Tedarikçi Yönetimi Yakında... 🚚</div>
};
