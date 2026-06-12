import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
    Utensils, Package, Globe, ChartBar, Receipt, LogOut, Users,

    Clock, RefreshCw, Maximize, Minimize, Volume2, VolumeX, ArrowLeft,
    Settings, Plus, Wifi, Server, User, X, CreditCard, Truck, Edit, Trash2,
    ChevronLeft, ChevronRight, MessageCircle, ShoppingBag, Bike, UtensilsCrossed, Store, Monitor
} from 'lucide-react';
import toast from 'react-hot-toast';
import { POSOrderView } from './POSOrderView';
import { TouchPaymentModal } from './TouchPaymentModal';

// --- MODALS (Moved outside to prevent re-render) ---

const ModalAddTable = ({ isOpen, onClose, onAdd, sections, activeSection }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">Yeni Masa Ekle</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-red-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    onAdd({
                        table_number: e.target.tableNo.value,
                        section_id: activeSection === 'all' ? sections[0]?.id : activeSection,
                        capacity: e.target.capacity.value
                    });
                }} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bölge</label>
                        <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700" defaultValue={activeSection === 'all' ? sections[0]?.id : activeSection} name="section_id" disabled>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Masa No / Adı</label>
                        <input name="tableNo" required autoFocus className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Örn: B-5" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Kapasite</label>
                        <input name="capacity" type="number" defaultValue={4} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all font-bold text-lg">
                        Ekle
                    </button>
                </form>
            </div>
        </div>
    );
};

const ModalAddSection = ({ isOpen, onClose, navigate }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg">Yeni Bölge Ekle</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                        <Settings className="w-8 h-8" />
                    </div>
                    <p className="text-gray-600 text-lg">Bölge yönetimi ve düzenlemeleri için Ayarlar sayfasına gidiniz.</p>
                    <button onClick={() => { onClose(); navigate('/restore/settings'); }} className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-colors">Ayarlara Git</button>
                </div>
            </div>
        </div>
    );
};

export const TableGridView = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tables'); // tables, takeaway
    const [activeSection, setActiveSection] = useState('all');
    const [sections, setSections] = useState([]);
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [stats, setStats] = useState({
        totalTables: 0,
        occupied: 0,
        amount: 0
    });

    // UI States
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSoundOn, setIsSoundOn] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

    // Modals
    const [showAddTableModal, setShowAddTableModal] = useState(false);
    const [showAddSectionModal, setShowAddSectionModal] = useState(false);

    // Takeaway States
    const [activePlatform, setActivePlatform] = useState('whatsapp');



    // Initial Data Fetch
    useEffect(() => {
        fetchInitialData();

        // Realtime subscription for tables
        const subscription = supabase
            .channel('public:restaurant_tables')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' },
                () => fetchInitialData()) // Refresh all on change
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);


    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Sections
            const { data: sectionsData } = await supabase

                .from('sections')
                .select('*')
                .eq('tenant_id', user.id)
                .order('sort_order', { ascending: true });

            if (sectionsData) setSections(sectionsData);

            // Fetch Tables with Sessions
            const { data: tablesData, error: tablesError } = await supabase
                .from('restaurant_tables')
                .select(`
                    *,
                    pos_sessions (
                        id,
                        status,
                        total_amount,
                        customer_id,
                        opened_at,
                        pos_orders ( count )
                    )
                `)
                .eq('tenant_id', user.id)
                .order('table_number', { ascending: true });

            if (tablesError) throw tablesError;

            // Process tables
            const processedTables = tablesData.map(table => {
                const activeSession = table.pos_sessions?.find(s => s.status === 'active');
                return {
                    ...table,
                    isOccupied: !!activeSession,
                    session: activeSession,
                    amount: activeSession?.total_amount || 0,
                    orderCount: activeSession?.pos_orders?.[0]?.count || 0,
                    time: activeSession ? Math.floor((new Date() - new Date(activeSession.opened_at)) / 60000) : 0
                };
            });

            setTables(processedTables);

            // Calculate stats
            setStats({
                totalTables: processedTables.length,
                occupied: processedTables.filter(t => t.isOccupied).length,
                amount: processedTables.reduce((sum, t) => sum + (t.amount || 0), 0)
            });

        } catch (error) {
            console.error('Data fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fullscreen Toggle
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullScreen(false);
            }
        }
    };

    // Add Table Logic
    const handleAddTable = async (tableData) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('restaurant_tables').insert({
                tenant_id: user.id,
                section_id: tableData.section_id,
                table_number: tableData.table_number,
                capacity: tableData.capacity || 4
            });

            if (error) throw error;
            toast.success('Masa eklendi');
            setShowAddTableModal(false);
            fetchInitialData();
        } catch (error) {
            console.error('Add table error:', error);
            toast.error('Masa eklenemedi: ' + error.message);
        }
    };

    // --- RENDER HELPERS ---

    const renderTableCard = (table) => {
        // Gradient based on status
        let bgClass = "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-300";
        let statusColor = "text-emerald-500 bg-emerald-50";
        let timeBadge = "";

        if (table.isOccupied) {
            if (table.amount < 500) {
                bgClass = "bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200 shadow-md";
                statusColor = "text-orange-600 bg-white/60";
            } else if (table.amount < 1500) {
                bgClass = "bg-gradient-to-br from-orange-50 to-rose-50 border-rose-200 shadow-md";
                statusColor = "text-rose-600 bg-white/60";
            } else {
                bgClass = "bg-gradient-to-br from-rose-50 to-red-100 border-red-300 shadow-lg scale-[1.02]";
                statusColor = "text-red-700 bg-white/60";
            }
            timeBadge = "bg-white/50 text-gray-700";
        }

        return (
            <div
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={`
                    relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer 
                    flex flex-col justify-between h-36 select-none group overflow-hidden
                    ${bgClass}
                `}
            >
                {/* Decorative Background Blob */}
                {table.isOccupied && <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/20 rounded-full blur-xl pointer-events-none"></div>}

                {/* Header */}
                <div className="flex justify-between items-start z-10">
                    <span className={`text-2xl font-black tracking-tight ${table.isOccupied ? 'text-gray-800' : 'text-gray-400 group-hover:text-indigo-500 transition-colors'}`}>
                        {table.table_number}
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/50 backdrop-blur-sm shadow-sm border border-transparent group-hover:border-gray-100 transition-all">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500">{table.capacity}</span>
                    </div>
                </div>

                {/* Center Content */}
                <div className="flex-1 flex items-center justify-center z-10">
                    {table.isOccupied ? (
                        <div className="text-center animate-in fade-in zoom-in duration-300">
                            <span className="block text-3xl font-black text-gray-800 tracking-tight drop-shadow-sm">
                                ₺{table.amount.toLocaleString('tr-TR')}
                            </span>
                            <span className="text-xs text-gray-600 font-semibold mt-1 inline-block px-2 py-0.5 rounded-full bg-white/40">
                                {table.orderCount} Ürün
                            </span>
                        </div>
                    ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110">
                            <Plus className="w-10 h-10 text-indigo-200" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-end mt-2 z-10">
                    {table.isOccupied ? (
                        <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded-lg backdrop-blur-sm ${timeBadge}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{table.time} dk</span>
                        </div>
                    ) : (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${statusColor}`}>
                            MÜSAİT
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const renderHeader = () => (
        <div className="h-20 bg-white border-b flex items-center justify-between px-0 shrink-0 shadow-sm z-30 relative">
            {/* Left Section - Matched Key Sidebar Width */}
            <div className="w-96 bg-gray-50/50 border-r h-full flex items-center px-6 gap-4 shrink-0">
                <button
                    onClick={() => navigate('/restore')}
                    className="p-2 bg-white hover:bg-gray-100 rounded-lg text-gray-600 transition-all active:scale-95 border border-gray-200 shadow-sm"
                    title="Ana Menüye Dön"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="flex flex-col overflow-hidden">
                    <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 tracking-tight truncate">
                        XLarge Burger
                    </h1>
                    <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
                        Touch POS
                    </span>
                </div>
            </div>

            {/* Middle Section - Mode Switcher & Status */}
            <div className="flex-1 flex items-center px-6 gap-6">
                {/* Mode Switcher */}
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'tables' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <UtensilsCrossed className="w-4 h-4" />
                        Masalar
                    </button>
                    <button
                        onClick={() => setActiveTab('takeaway')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'takeaway' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Package className="w-4 h-4" />
                        Paket Servis
                    </button>
                </div>

                <div className="h-8 w-px bg-gray-200"></div>

                <span className="text-xs text-green-600 font-bold flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Sistem Online
                </span>
            </div>

            {/* Right Section - Stats & Actions */}
            <div className="flex items-center gap-4 px-6 h-full bg-white">
                <div className="flex items-center gap-6 mr-4 bg-white px-5 py-2 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-center min-w-[60px]">
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Müsait</span>
                        <span className="block text-xl font-black text-gray-800">{stats.totalTables - stats.occupied}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="text-center min-w-[60px]">
                        <span className="block text-xs font-bold text-orange-400 uppercase tracking-widest">Dolu</span>
                        <span className="block text-xl font-black text-orange-600">{stats.occupied}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="text-center min-w-[80px]">
                        <span className="block text-xs font-bold text-emerald-400 uppercase tracking-widest">Toplam</span>
                        <span className="block text-xl font-black text-emerald-600">₺{stats.amount.toLocaleString()}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 pl-4">
                    <button onClick={() => setIsSoundOn(!isSoundOn)} className={`p-3 rounded-xl transition-colors ${isSoundOn ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                        {isSoundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                    <button onClick={toggleFullScreen} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors">
                        {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                    <button onClick={() => fetchInitialData()} className="p-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl text-white shadow-lg shadow-indigo-200 transition-all hover:rotate-180 duration-500">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );

    // --- MAIN CONTENT ---

    if (selectedTable) {
        return (
            <POSOrderView
                table={selectedTable}
                onClose={() => {
                    setSelectedTable(null);
                    fetchInitialData();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
            {renderHeader()}

            <div className="flex-1 flex overflow-hidden">
                {/* 
                  LEFT SIDEBAR: 
                   - Tables Mode: Active Orders List
                   - Takeaway Mode: Platform Tabs + Order List
                */}
                <div className="w-96 bg-white border-r flex flex-col shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] z-20 shrink-0">
                    {activeTab === 'tables' ? (
                        <>
                            <div className="p-5 border-b bg-gray-50/50 backdrop-blur-sm sticky top-0 z-10">
                                <h2 className="font-bold text-gray-800 flex items-center gap-3 text-lg">
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                        <Receipt className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    Açık Adisyonlar
                                    <span className="ml-auto bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">{tables.filter(t => t.isOccupied).length}</span>
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {tables.filter(t => t.isOccupied).map(table => (
                                    <div key={table.id} onClick={() => setSelectedTable(table)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-400 hover:shadow-md hover:scale-[1.01] cursor-pointer transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-indigo-50 rounded-bl-full -z-0"></div>
                                        <div className="flex justify-between items-center mb-3 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-xl text-gray-800 bg-gray-50 px-2 py-1 rounded-lg">{table.table_number}</span>
                                                <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {table.time} dk
                                                </span>
                                            </div>
                                            <span className="font-black text-indigo-600 text-lg">₺{table.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm relative z-10">
                                            <span className="text-gray-500 font-medium">Garson Bekliyor</span>
                                            <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-md text-xs">{table.orderCount} Parça</span>
                                        </div>
                                    </div>
                                ))}
                                {tables.filter(t => t.isOccupied).length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                            <UtensilsCrossed className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p className="font-medium">Şu an aktif masa yok</p>
                                        <p className="text-xs mt-1">Sipariş alındığında burada görünecek</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Takeaway Platforms Sidebar */
                        <div className="flex h-full">
                            {/* Icon Sidebar */}
                            <div className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 shrink-0 shadow-inner">
                                {[
                                    { id: 'whatsapp', icon: MessageCircle, color: 'text-green-400', label: 'WP' },
                                    { id: 'trendyol', icon: ShoppingBag, color: 'text-orange-400', label: 'TY' },
                                    { id: 'getir', icon: Bike, color: 'text-purple-400', label: 'GT' },
                                    { id: 'yemeksepeti', icon: Utensils, color: 'text-red-400', label: 'YS' },
                                    { id: 'migros', icon: ShoppingBag, color: 'text-orange-300', label: 'MJ' },
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setActivePlatform(p.id)}
                                        className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative group
                                            ${activePlatform === p.id
                                                ? 'bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-110 border border-white/20'
                                                : 'hover:bg-white/5 opacity-60 hover:opacity-100'}`}
                                        title={p.id}
                                    >
                                        <p.icon className={`w-6 h-6 ${p.color} ${activePlatform === p.id ? 'drop-shadow-md' : ''}`} />
                                        {activePlatform === p.id && <div className={`absolute -right-1 -top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-slate-900`}></div>}
                                    </button>
                                ))}
                            </div>

                            {/* List Sidebar */}
                            <div className="flex-1 flex flex-col border-l border-gray-100 bg-gray-50/30">
                                <div className="p-5 border-b bg-white relative">
                                    <div className="absolute w-1 h-full bg-indigo-500 left-0 top-0"></div>
                                    <h2 className="font-black text-2xl text-gray-800 capitalize tracking-tight mb-1">{activePlatform}</h2>
                                    <span className="text-sm font-semibold text-gray-500">Bekleyen Siparişler</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-gray-400 text-center">
                                    <Package className="w-20 h-20 mb-4 opacity-10 text-indigo-500 animate-bounce" />
                                    <p className="font-medium text-lg text-gray-500">Yeni sipariş bekleniyor</p>
                                    <p className="text-sm mt-2 opacity-60">Sistem {activePlatform} entegrasyonuna bağlı.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* CENTER: Grid or Takeaway Detail */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #6366f1 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

                    {activeTab === 'tables' ? (
                        <>
                            {activeSection === 'all' ? (
                                sections.map(section => {
                                    const sectionTables = tables.filter(t => t.section_id === section.id);
                                    if (sectionTables.length === 0) return null;
                                    return (
                                        <div key={section.id} className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex items-center gap-4 mb-6">
                                                <h2 className="text-2xl font-black text-gray-700 tracking-tight">{section.name}</h2>
                                                <div className="h-px bg-gradient-to-r from-gray-200 to-transparent flex-1"></div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6">
                                                {sectionTables.map(renderTableCard)}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-6 animate-in fade-in zoom-in-95 duration-300">
                                    {tables.filter(t => t.section_id === activeSection).map(renderTableCard)}
                                </div>
                            )}

                            {tables.length === 0 && !loading && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                                    <Store className="w-32 h-32 mb-6 text-gray-300" />
                                    <p className="text-2xl font-bold text-gray-500">Henüz masa eklenmemiş</p>
                                    <p className="text-gray-400 mb-6">Başlamak için sağ panelden veya aşağıdan masa ekleyin.</p>
                                    <button onClick={() => setShowAddTableModal(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-1 transition-all">
                                        İlk Masayı Ekle
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Takeaway Center Content */
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="bg-white p-12 rounded-3xl shadow-xl text-center border border-gray-100 max-w-md">
                                <Monitor className="w-20 h-20 mx-auto mb-6 text-indigo-100" />
                                <h3 className="text-2xl font-black text-gray-800 mb-2">Sipariş Detayı</h3>
                                <p className="text-gray-500">Sol menüden detayını görüntülemek istediğiniz bir siparişi seçiniz.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 
                   RIGHT SIDEBAR: Categories / Sections Logic 
                   Controlled by rightSidebarOpen
                */}
                <div className={`
                    bg-white border-l shadow-2xl transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col z-20 shrink-0
                    ${rightSidebarOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full opacity-0 pointer-events-none'}
                `}>
                    {activeTab === 'tables' && (
                        <>
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50/80 backdrop-blur-md">
                                <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-indigo-600" />
                                    Bölgeler
                                </h3>
                            </div>
                            <div className="p-4 space-y-3 flex-1 overflow-y-auto bg-gray-50/30">
                                <button
                                    onClick={() => setActiveSection('all')}
                                    className={`w-full p-5 rounded-2xl text-left transition-all duration-300 relative overflow-hidden group shadow-sm border
                                        ${activeSection === 'all'
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-200 border-transparent'
                                            : 'bg-white hover:bg-white hover:shadow-md hover:border-indigo-200 text-gray-600'
                                        }`}
                                >
                                    <span className={`font-bold relative z-10 text-lg ${activeSection === 'all' ? 'text-white' : 'group-hover:text-indigo-600'}`}>Tüm Masalar</span>
                                    <span className={`text-xs block mt-1 relative z-10 opacity-80 ${activeSection === 'all' ? 'text-indigo-100' : 'text-gray-400'}`}>{tables.length} Masa</span>

                                    <ChartBar className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 transition-all duration-500 opacity-20 group-hover:scale-110 group-hover:rotate-12`} />
                                </button>

                                {sections.map((section) => (

                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSection(section.id)}
                                        className={`w-full p-4 rounded-2xl text-left transition-all duration-200 relative overflow-hidden group border
                                            ${activeSection === section.id
                                                ? 'bg-white border-2 border-indigo-500 shadow-md ring-4 ring-indigo-50'
                                                : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center z-10 relative">
                                            <span className={`font-bold text-lg ${activeSection === section.id ? 'text-indigo-700' : 'text-gray-700 group-hover:text-gray-900'}`}>{section.name}</span>
                                            {activeSection === section.id && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>}
                                        </div>
                                    </button>
                                ))}

                                <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
                                    <button
                                        onClick={() => setShowAddSectionModal(true)}
                                        className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group font-semibold"
                                    >
                                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                        <span>Yeni Bölge Ekle</span>
                                    </button>

                                    <button
                                        onClick={() => setShowAddTableModal(true)}
                                        className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group font-semibold"
                                    >
                                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                        <span>Yeni Masa Ekle</span>
                                    </button>
                                </div>
                            </div>

                            {/* Bottom Actions - Refined */}
                            <div className="p-4 border-t bg-gradient-to-t from-gray-50 to-white">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => navigate('/restore/settings')}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 bg-white hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all border border-gray-200 hover:border-indigo-200 text-sm font-semibold shadow-sm"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Ayarlar
                                    </button>
                                    <button
                                        onClick={() => supabase.auth.signOut().then(() => navigate('/restore/login'))}
                                        className="flex items-center justify-center gap-2 px-4 py-3 text-red-500 bg-white hover:bg-red-50 rounded-xl transition-all border border-gray-200 hover:border-red-200 text-sm font-semibold shadow-sm"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'takeaway' && (
                        <div className="flex flex-col h-full bg-slate-50">
                            <div className="p-6 border-b bg-white text-center">
                                <h3 className="font-bold text-gray-800">Kurye Durumu</h3>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                                <Truck className="w-20 h-20 mb-4 opacity-30 text-indigo-500" />
                                <h4 className="font-bold text-gray-600 text-lg">Aktif Kurye Yok</h4>
                                <p className="text-sm mt-2">Sipariş atandığında kurye takibi buradan yapılabilir.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Toggle Button (Floating) */}
            <div className={`absolute top-1/2 right-0 transform -translate-y-1/2 z-30 transition-all duration-500 ${rightSidebarOpen ? 'mr-[320px]' : 'mr-0'}`}>
                <button
                    onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                    className="bg-white border-y border-l border-gray-200 py-3 pl-3 pr-2 rounded-l-2xl shadow-lg text-gray-400 hover:text-indigo-600 hover:pr-4 hover:shadow-xl transition-all group"
                >
                    {rightSidebarOpen ? <ChevronRight className="w-6 h-6 group-hover:scale-110" /> : <ChevronLeft className="w-6 h-6 group-hover:scale-110" />}
                </button>
            </div>

            {/* Modals are explicitly rendered outside the ref check, but using state control */}
            <ModalAddTable
                isOpen={showAddTableModal}
                onClose={() => setShowAddTableModal(false)}
                onAdd={handleAddTable}
                sections={sections}
                activeSection={activeSection}
            />

            <ModalAddSection
                isOpen={showAddSectionModal}
                onClose={() => setShowAddSectionModal(false)}
                navigate={navigate}
            />
        </div>
    );
};
