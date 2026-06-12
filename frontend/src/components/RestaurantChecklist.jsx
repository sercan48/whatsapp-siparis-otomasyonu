import React, { useState, useEffect } from 'react';
import {
    CheckCircle, Circle, AlertCircle, Store, Menu, CreditCard,
    Truck, Users, FileText, Settings, Loader2, RefreshCw,
    ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const RestaurantChecklist = ({ restaurantId }) => {
    const [loading, setLoading] = useState(true);
    const [checklist, setChecklist] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [restaurant, setRestaurant] = useState(null);

    const checklistItems = [
        {
            id: 'basic_info',
            title: 'Temel Bilgiler',
            icon: Store,
            items: [
                { id: 'name', label: 'Restoran adı girildi', check: (r) => !!r?.name },
                { id: 'logo', label: 'Logo yüklendi', check: (r) => !!r?.logo_url },
                { id: 'address', label: 'Adres bilgisi eklendi', check: (r) => !!r?.store_config?.address },
                { id: 'phone', label: 'Telefon numarası girildi', check: (r) => !!r?.store_config?.phone },
                { id: 'hours', label: 'Çalışma saatleri ayarlandı', check: (r) => !!r?.store_config?.opening_time }
            ]
        },
        {
            id: 'menu',
            title: 'Menü Yönetimi',
            icon: Menu,
            items: [
                {
                    id: 'categories', label: 'En az 1 kategori oluşturuldu', checkAsync: async (r) => {
                        const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true }).eq('tenant_id', r.id);
                        return count > 0;
                    }
                },
                {
                    id: 'products', label: 'En az 5 ürün eklendi', checkAsync: async (r) => {
                        const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('tenant_id', r.id);
                        return count >= 5;
                    }
                },
                {
                    id: 'prices', label: 'Tüm ürünlere fiyat girildi', checkAsync: async (r) => {
                        const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('tenant_id', r.id).is('price', null);
                        return count === 0;
                    }
                },
                {
                    id: 'images', label: 'Ürün görselleri yüklendi', checkAsync: async (r) => {
                        const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('tenant_id', r.id).not('image_url', 'is', null);
                        return count > 0;
                    }
                }
            ]
        },
        {
            id: 'payment',
            title: 'Ödeme Ayarları',
            icon: CreditCard,
            items: [
                {
                    id: 'payment_method', label: 'En az 1 ödeme yöntemi aktif', checkAsync: async (r) => {
                        const { data } = await supabase.from('payment_settings').select('*').eq('tenant_id', r.id).single();
                        return data?.iyzico_enabled || data?.paytr_enabled || data?.masterpass_enabled;
                    }
                },
                { id: 'bank_info', label: 'Banka bilgileri girildi', check: (r) => !!r?.bank_info?.iban }
            ]
        },
        {
            id: 'delivery',
            title: 'Teslimat Ayarları',
            icon: Truck,
            items: [
                { id: 'delivery_fee', label: 'Teslimat ücreti belirlendi', check: (r) => r?.store_config?.delivery_fee !== undefined },
                { id: 'min_order', label: 'Minimum sipariş tutarı belirlendi', check: (r) => r?.store_config?.min_basket > 0 },
                {
                    id: 'delivery_zones', label: 'Teslimat bölgeleri tanımlandı', checkAsync: async (r) => {
                        const { count } = await supabase.from('delivery_zones').select('*', { count: 'exact', head: true }).eq('tenant_id', r.id);
                        return count > 0;
                    }
                }
            ]
        },
        {
            id: 'legal',
            title: 'Yasal Bilgiler',
            icon: FileText,
            items: [
                {
                    id: 'company_name', label: 'Şirket unvanı girildi', checkAsync: async (r) => {
                        const { data } = await supabase.from('tenant_legal_info').select('*').eq('tenant_id', r.id).single();
                        return !!data?.company_title;
                    }
                },
                {
                    id: 'tax_id', label: 'Vergi numarası girildi', checkAsync: async (r) => {
                        const { data } = await supabase.from('tenant_legal_info').select('*').eq('tenant_id', r.id).single();
                        return !!data?.tax_id;
                    }
                },
                { id: 'kvkk', label: 'KVKK metni onaylandı', check: (r) => !!r?.legal_accepted }
            ]
        },
        {
            id: 'staff',
            title: 'Personel',
            icon: Users,
            items: [
                { id: 'admin', label: 'Yönetici hesabı aktif', check: () => true },
                {
                    id: 'staff', label: 'En az 1 personel eklendi', checkAsync: async (r) => {
                        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', r.id);
                        return count > 1;
                    }
                }
            ]
        }
    ];

    useEffect(() => {
        if (restaurantId) loadChecklist();
    }, [restaurantId]);

    const loadChecklist = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('tenants').select('*').eq('id', restaurantId).single();
            setRestaurant(data);

            // Run all checks
            const results = [];
            for (const category of checklistItems) {
                const categoryResults = { ...category, items: [] };
                for (const item of category.items) {
                    let passed = false;
                    if (item.checkAsync) {
                        passed = await item.checkAsync(data);
                    } else if (item.check) {
                        passed = item.check(data);
                    }
                    categoryResults.items.push({ ...item, passed });
                }
                results.push(categoryResults);
            }
            setChecklist(results);
        } catch (error) {
            console.error('Error loading checklist:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCompletionPercentage = () => {
        let total = 0;
        let completed = 0;
        checklist.forEach(cat => {
            cat.items.forEach(item => {
                total++;
                if (item.passed) completed++;
            });
        });
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    };

    const getCategoryCompletion = (category) => {
        const completed = category.items.filter(i => i.passed).length;
        return `${completed}/${category.items.length}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
        );
    }

    const completionPercent = getCompletionPercentage();

    return (
        <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Kurulum Kontrol Listesi</h2>
                    <p className="text-slate-500 text-sm">{restaurant?.name}</p>
                </div>
                <button onClick={loadChecklist} className="p-2 text-slate-400 hover:text-slate-600">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600">Tamamlanma</span>
                    <span className={`text-sm font-bold ${completionPercent === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                        %{completionPercent}
                    </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
            </div>

            {/* Checklist Categories */}
            <div className="space-y-3">
                {checklist.map(category => (
                    <div key={category.id} className="border rounded-lg overflow-hidden">
                        <button
                            onClick={() => setExpanded(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <category.icon className="w-5 h-5 text-slate-400" />
                                <span className="font-medium text-slate-800">{category.title}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${category.items.every(i => i.passed)
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {getCategoryCompletion(category)}
                                </span>
                            </div>
                            {expanded[category.id] ? (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                        </button>

                        {expanded[category.id] && (
                            <div className="border-t bg-slate-50 p-4 space-y-2">
                                {category.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        {item.passed ? (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-slate-300" />
                                        )}
                                        <span className={`text-sm ${item.passed ? 'text-slate-600' : 'text-slate-500'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Completion Status */}
            {completionPercent === 100 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                        <p className="font-medium text-green-800">Kurulum Tamamlandı!</p>
                        <p className="text-sm text-green-600">Restoran siparişleri almaya hazır.</p>
                    </div>
                </div>
            )}

            {completionPercent < 100 && completionPercent > 0 && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <div>
                        <p className="font-medium text-amber-800">Kurulum Devam Ediyor</p>
                        <p className="text-sm text-amber-600">Eksik adımları tamamlayın.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RestaurantChecklist;
