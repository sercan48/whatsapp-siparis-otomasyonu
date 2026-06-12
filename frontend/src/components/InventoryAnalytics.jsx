import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, BarChart2 } from 'lucide-react';

export const InventoryAnalytics = ({ tenantId }) => {
    const [loading, setLoading] = useState(true);
    const [profitabilityData, setProfitabilityData] = useState([]);
    const [stockForecasts, setStockForecasts] = useState([]);

    useEffect(() => {
        analyzeData();
    }, [tenantId]);

    const analyzeData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Menu Items + Recipes + Ingredients to Calculate Cost
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select(`
                    id, name, price,
                    product_recipes (
                        quantity_required,
                        ingredients ( cost_per_unit, unit )
                    )
                `)
                .eq('tenant_id', tenantId);

            // 2. Calculate Margins (Simplified)
            // AI Logic: Calculate COGS (Cost of Goods Sold) vs Price
            const analyzedMenu = menuItems.map(item => {
                let cost = 0;
                item.product_recipes?.forEach(r => {
                    cost += (r.quantity_required * (r.ingredients?.cost_per_unit || 0));
                });

                // Simulate Sales Volume (Since we don't have enough history in demo)
                // Random volume between 10 and 100 for demo purposes
                // In production, fetch from 'order_items' count
                const simulatedVolume = Math.floor(Math.random() * 90) + 10;

                const margin = item.price - cost;
                const marginPercent = item.price > 0 ? ((margin / item.price) * 100).toFixed(1) : 0;

                // Menu Engineering Classification
                // High Margin > 60%, High Volume > 50
                const isHighMargin = marginPercent > 60;
                const isHighVolume = simulatedVolume > 50;

                let classification = 'Dog'; // Low Margin, Low Volume
                if (isHighMargin && isHighVolume) classification = 'Star';
                if (!isHighMargin && isHighVolume) classification = 'Plowhorse';
                if (isHighMargin && !isHighVolume) classification = 'Puzzle';

                return {
                    ...item,
                    cost: cost.toFixed(2),
                    margin: margin.toFixed(2),
                    marginPercent,
                    volume: simulatedVolume,
                    classification
                };
            });

            setProfitabilityData(analyzedMenu.sort((a, b) => b.marginPercent - a.marginPercent));


            // 3. Stock Forecast Logic (Simplified Heuristic)
            // Get ingredients that are low on stock based on simulated consumption
            const { data: ingredients } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId);

            const forecasts = ingredients.map(ing => {
                // Heuristic: Assume daily consumption is 5% of current stock (Demo)
                const dailyConsumption = Math.max(1, ing.current_stock * 0.05);
                const daysLeft = ing.current_stock / dailyConsumption;

                return {
                    ...ing,
                    daysLeft: daysLeft.toFixed(1),
                    status: daysLeft < 3 ? 'Critical' : daysLeft < 7 ? 'Low' : 'Healthy'
                };
            }).filter(i => i.status !== 'Healthy'); // Only show alerts

            setStockForecasts(forecasts);

        } catch (error) {
            console.error('Analysis error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center p-10">Yapay Zeka Verileri Analiz Ediyor... 🧠</div>;

    return (
        <div className="space-y-8">

            {/* Section 1: Menu Engineering (Profitability) */}
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <BarChart2 className="w-5 h-5 text-indigo-600" />
                    Menü Mühendisliği (Kârlılık Analizi)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {['Star', 'Plowhorse', 'Puzzle', 'Dog'].map(type => {
                        const items = profitabilityData.filter(i => i.classification === type);
                        const colors = {
                            'Star': 'bg-green-100 border-green-200 text-green-800', // Win-Win
                            'Plowhorse': 'bg-yellow-100 border-yellow-200 text-yellow-800', // Popular but low margin
                            'Puzzle': 'bg-purple-100 border-purple-200 text-purple-800', // High margin but low sales
                            'Dog': 'bg-red-100 border-red-200 text-red-800' // Loser
                        };
                        const titles = {
                            'Star': 'Yıldızlar (Yüksek Kâr/Hacim)',
                            'Plowhorse': 'Yük Beygirleri (Popüler)',
                            'Puzzle': 'Gizli Fırsatlar (Kârlı)',
                            'Dog': 'Sorunlular (İncele)'
                        };

                        return (
                            <div key={type} className={`p-4 rounded-xl border ${colors[type]}`}>
                                <h4 className="font-bold text-sm mb-2">{titles[type]}</h4>
                                <div className="text-2xl font-bold">{items.length} Ürün</div>
                                <ul className="text-xs mt-2 space-y-1 opacity-80">
                                    {items.slice(0, 3).map(i => <li key={i.id}>{i.name} (%{i.marginPercent})</li>)}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                {/* Detailed Table */}
                <div className="overflow-x-auto bg-white border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-bold">
                            <tr>
                                <th className="p-3">Ürün</th>
                                <th className="p-3">Satış Fiyatı</th>
                                <th className="p-3">Maliyet (COGS)</th>
                                <th className="p-3">Kâr Marjı</th>
                                <th className="p-3">Tahmini Hacim</th>
                                <th className="p-3">AI Önerisi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {profitabilityData.slice(0, 10).map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-medium">{item.name}</td>
                                    <td className="p-3">{item.price} ₺</td>
                                    <td className="p-3 text-red-600">-{item.cost} ₺</td>
                                    <td className="p-3 text-green-600 font-bold">% {item.marginPercent}</td>
                                    <td className="p-3">{item.volume} Adet</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.classification === 'Star' ? 'bg-green-100 text-green-700' :
                                                item.classification === 'Dog' ? 'bg-red-100 text-red-700' :
                                                    item.classification === 'Puzzle' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {item.classification === 'Star' ? '🔥 Öne Çıkar' :
                                                item.classification === 'Dog' ? '🔻 Menüden Çıkar?' :
                                                    item.classification === 'Puzzle' ? '📢 Kampanya Yap' : '💰 Fiyat Artır'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Section 2: Stock Forecast */}
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4 mt-8">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    Akıllı Stok Tahmini (Gelecek Hafta)
                </h3>
                {stockForecasts.length === 0 ? (
                    <div className="p-6 bg-green-50 text-green-700 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-6 h-6" />
                        <span>Harika! Kritik seviyede stok tahmini yok. Tüm malzemeler yeterli görünüyor.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stockForecasts.map(ing => (
                            <div key={ing.id} className="bg-white border-l-4 border-red-500 p-4 shadow-sm rounded-r-lg flex justify-between items-center">
                                <div>
                                    <h5 className="font-bold text-gray-800">{ing.name}</h5>
                                    <p className="text-sm text-gray-500">Mevcut: {ing.current_stock} {ing.unit}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-red-600 font-bold text-lg">{ing.daysLeft} Gün</div>
                                    <div className="text-xs text-gray-400">Kaldı</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};
