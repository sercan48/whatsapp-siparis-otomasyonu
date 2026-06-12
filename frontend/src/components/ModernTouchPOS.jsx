import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
    ArrowLeft, Bell, Wifi, WifiOff, Barcode, Edit3, X, Package, FileText, Move,
    Users, Clock, Plus, Settings, LogOut, Utensils, ShoppingBag,
    Trash2, Edit, Layers, ChefHat, AlertCircle, Maximize, Minimize, Eye, EyeOff,
    PanelLeft, PanelRight, MessageCircle, Phone, Bike, CheckCircle, Truck, MapPin, Globe,
    Sun, Moon, RefreshCw, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { POSOrderView } from './POSOrderView';
import { AssignCourierModal } from './AssignCourierModal';

// eslint-disable-next-line react-hooks/exhaustive-deps
// ============================================================================
// MODERN TOUCH POS COMPONENT - v3.0
// Features: Online Orders Kitchen Integration, Courier Assignment
// ============================================================================

// --- ORDER STATUS FLOW ---
const ORDER_STATUSES = {
    new: { label: 'Yeni', color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-100' },
    in_kitchen: { label: 'Mutfakta', color: 'bg-amber-500', textColor: 'text-amber-600', bgLight: 'bg-amber-100' },
    ready: { label: 'Hazır', color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-100' },
    awaiting_courier: { label: 'Kurye Bekliyor', color: 'bg-purple-500', textColor: 'text-purple-600', bgLight: 'bg-purple-100' },
    delivering: { label: 'Teslimde', color: 'bg-indigo-500', textColor: 'text-indigo-600', bgLight: 'bg-indigo-100' },
    delivered: { label: 'Teslim Edildi', color: 'bg-gray-500', textColor: 'text-gray-600', bgLight: 'bg-gray-100' },
};

// --- THEME PALETTES ---
const THEMES = {
    light: {
        bg: 'bg-gray-50',
        surface: 'bg-white',
        surfaceAlt: 'bg-gray-100',
        border: 'border-gray-200',
        text: 'text-gray-800',
        textSecondary: 'text-gray-500',
        card: 'bg-white',
        cardHover: 'hover:bg-gray-50',
        header: 'bg-white',
        sidebar: 'bg-gray-50',
        actionBar: 'bg-gray-100',
    },
    dark: {
        bg: 'bg-slate-950',
        surface: 'bg-slate-900',
        surfaceAlt: 'bg-slate-800',
        border: 'border-slate-700',
        text: 'text-white',
        textSecondary: 'text-slate-400',
        card: 'bg-slate-800',
        cardHover: 'hover:bg-slate-700',
        header: 'bg-slate-900',
        sidebar: 'bg-slate-900',
        actionBar: 'bg-slate-950',
    }
};

// --- TABLE STATUS COLORS ---
const TABLE_COLORS = {
    empty: { bg: 'bg-gradient-to-br from-gray-100 to-gray-200', border: 'border-gray-300', text: 'text-gray-600' },
    occupied: { bg: 'bg-gradient-to-br from-blue-500 to-blue-600', border: 'border-blue-400', text: 'text-white' },
    reserved: { bg: 'bg-gradient-to-br from-purple-500 to-purple-600', border: 'border-purple-400', text: 'text-white' },
    selected: { bg: 'bg-gradient-to-br from-emerald-400 to-emerald-500', border: 'border-emerald-300', text: 'text-white' }
};

// --- PLATFORM ICONS ---
const PLATFORMS = [
    { id: 'all', name: 'Hepsi', icon: Layers, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-100' },
    { id: 'trendyol', name: 'Trendyol', icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-100' },
    { id: 'getir', name: 'Getir', icon: Bike, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'yemeksepeti', name: 'Yemeksepeti', icon: Utensils, color: 'text-red-500', bg: 'bg-red-100' },
    { id: 'phone', name: 'Telefon', icon: Phone, color: 'text-blue-500', bg: 'bg-blue-100' },
];

// --- ACTION BAR ITEMS ---
const ACTION_ITEMS = [
    { id: 'barcode', icon: Barcode, label: 'Barkod' },
    { id: 'edit', icon: Edit3, label: 'Düzenle' },
    { id: 'cancel', icon: X, label: 'İptal' },
    { id: 'notes', icon: FileText, label: 'Notlar' },
    { id: 'move', icon: Move, label: 'Taşı' },
];

export const ModernTouchPOS = ({ role = 'admin' }) => {
    const navigate = useNavigate();

    // Check prop role vs state role (priority to prop if passed from wrapper)
    const canManageTables = role !== 'waiter';
    const canCancelOrders = role !== 'waiter';
    const canAccessSettings = role !== 'waiter';

    // --- STATE ---
    const [activeTab, setActiveTab] = useState('tables');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [activeSection, setActiveSection] = useState('all');

    // --- MAIN STATE ---
    const [sections, setSections] = useState([]);
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [isOnline, setIsOnline] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [tenantId, setTenantId] = useState(null);
    const [showRevenue, setShowRevenue] = useState(false);
    const [couriers, setCouriers] = useState([]);
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    // Online Orders State
    const [activePlatform, setActivePlatform] = useState('all');
    const [onlineOrders, setOnlineOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Courier Modal State
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [courierOrderId, setCourierOrderId] = useState(null);
    const [courierOrderDetails, setCourierOrderDetails] = useState(null);

    // Stats
    const [stats, setStats] = useState({ totalTables: 0, occupied: 0, amount: 0 });

    // --- SECURITY & APPROVALS --
    const [pendingRequests, setPendingRequests] = useState([]);
    const [approvalModal, setApprovalModal] = useState({ open: false, table: null, session: null });

    // Filter tables/sessions with pending requests
    useEffect(() => {
        const requests = tables.reduce((acc, table) => {
            const session = Array.isArray(table.current_session) ? table.current_session[0] : table.current_session;
            if (!session) return acc;

            const isPendingSession = session.status === 'pending_approval';
            const hasPendingDevices = session.pending_devices && session.pending_devices.length > 0;

            if (isPendingSession || hasPendingDevices) {
                acc.push({ table, session, type: isPendingSession ? 'new_session' : 'join_request' });
            }
            return acc;
        }, []);
        setPendingRequests(requests);
    }, [tables]);

    const handleApproveSession = async (session) => {
        try {
            const { error } = await supabase
                .from('pos_sessions')
                .update({ status: 'active' }) // Activate session
                .eq('id', session.id);

            if (error) throw error;
            toast.success('Masa açıldı!');
            setApprovalModal({ open: false, table: null, session: null });
            fetchData();
        } catch (error) {
            toast.error('Onaylanamadı.');
        }
    };

    const handleApproveDevice = async (session, deviceRequest) => {
        try {
            // Move device from pending to authorized
            const currentDevices = session.device_ids || [];
            const newDevices = [...currentDevices, deviceRequest.device_id];

            const newPending = (session.pending_devices || []).filter(d => d.device_id !== deviceRequest.device_id);

            const { error } = await supabase
                .from('pos_sessions')
                .update({
                    device_ids: newDevices,
                    pending_devices: newPending
                })
                .eq('id', session.id);

            if (error) throw error;
            toast.success('Cihaz onaylandı!');
            setApprovalModal({ open: false, table: null, session: null });
            fetchData();
        } catch (error) {
            toast.error('Hata oluştu.');
        }
    };

    const handleRejectRequest = async (session, deviceRequest = null) => {
        try {
            if (deviceRequest) {
                // Reject single device
                const newPending = (session.pending_devices || []).filter(d => d.device_id !== deviceRequest.device_id);
                await supabase.from('pos_sessions').update({ pending_devices: newPending }).eq('id', session.id);
            } else {
                // Reject entire session (Block/Close table)
                // If it was a pending session, we close it and empty table
                await supabase.from('pos_sessions').update({ status: 'cancelled', closed_at: new Date().toISOString() }).eq('id', session.id);
                await supabase.from('restaurant_tables').update({ status: 'empty', current_session_id: null }).eq('id', approvalModal.table.id);
            }

            toast.success('İstek reddedildi.');
            setApprovalModal({ open: false, table: null, session: null });
            fetchData();
        } catch (error) {
            toast.error('İşlem başarısız.');
        }
    };
    // Moved state to top


    // Theme helper
    const theme = isDarkMode ? THEMES.dark : THEMES.light;

    // --- EFFECTS ---
    useEffect(() => {
        fetchData();
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        const courierInterval = setInterval(() => {
            if (tenantId) fetchCouriers(tenantId);
        }, 15000); // Update couriers every 15s

        window.addEventListener('online', () => setIsOnline(true));
        window.addEventListener('offline', () => setIsOnline(false));
        return () => {
            clearInterval(interval);
            clearInterval(courierInterval);
        };
    }, []);

    // Real-time subscription for online orders
    useEffect(() => {
        if (!tenantId) return;

        const subscription = supabase
            .channel('external-platform-orders')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'external_platform_orders',
                filter: `tenant_id=eq.${tenantId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    toast.success('Yeni online sipariş geldi!', { icon: '🔔' });
                }
                fetchOnlineOrders(tenantId);
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [tenantId]);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: sectionsData } = await supabase
                .from('sections')
                .select('*')
                .eq('tenant_id', user.id)
                .order('sort_order', { ascending: true });
            setSections(sectionsData || []);

            const { data: tablesData } = await supabase
                .from('restaurant_tables')
                .select(`*, pos_sessions(id, status, total_amount, opened_at)`)
                .eq('tenant_id', user.id)
                .order('table_number', { ascending: true });

            const processed = (tablesData || []).map(table => {
                // Support both 'active' (POS standard) and 'open' (WhatsApp standard)
                const session = table.pos_sessions?.find(s => s.status === 'active' || s.status === 'open');
                return {
                    ...table,
                    status: session ? 'occupied' : 'empty',
                    amount: session?.total_amount || 0,
                    time: session ? Math.floor((Date.now() - new Date(session.opened_at).getTime()) / 60000) : 0,
                    sessionId: session?.id
                };
            });
            setTables(processed);
            setStats({
                totalTables: processed.length,
                occupied: processed.filter(t => t.status === 'occupied').length,
                amount: processed.reduce((s, t) => s + (t.amount || 0), 0)
            });

            // Set tenant ID and fetch online orders
            setTenantId(user.id);
            fetchOnlineOrders(user.id);

            // Cache for offline use
            localStorage.setItem('cached_sections', JSON.stringify(sectionsData || []));
            localStorage.setItem('cached_tables', JSON.stringify(processed));

        } catch (err) {
            console.error('Fetch error:', err);

            // Offline Fallback
            if (!navigator.onLine) {
                const cachedSections = localStorage.getItem('cached_sections');
                const cachedTables = localStorage.getItem('cached_tables');

                if (cachedSections && cachedTables) {
                    setSections(JSON.parse(cachedSections));
                    setTables(JSON.parse(cachedTables));

                    // Recalculate stats from cache
                    const t = JSON.parse(cachedTables);
                    setStats({
                        totalTables: t.length,
                        occupied: t.filter(x => x.status === 'occupied').length,
                        amount: t.reduce((s, x) => s + (x.amount || 0), 0)
                    });
                    toast('Offline Mod: Masalar önbellekten yüklendi', { icon: '📡' });
                    return;
                }
            }
            toast.error('Veri yüklenirken hata oluştu');
        }
    };

    const fetchOnlineOrders = async (tid) => {
        const targetId = tid || tenantId;
        if (!targetId) return;

        try {
            const { data, error } = await supabase
                .from('external_platform_orders')
                .select('*')
                .eq('tenant_id', targetId)
                .order('ordered_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setOnlineOrders(data || []);
        } catch (err) {
            console.error('Online orders fetch error:', err);
        }
    };

    const fetchCouriers = async () => {
        try {
            const { data, error } = await supabase
                .from('courier_profiles')
                .select('*, profile:profiles(full_name)')
                .eq('tenant_id', tenantId)
                .eq('is_active', true);

            if (error) throw error;
            setCouriers(data || []);
        } catch (err) {
            console.error('Couriers fetch error:', err);
        }
    };

    // --- TABLE CLICK HANDLER (CRITICAL FIX) ---
    const handleTableClick = async (table) => {
        try {
            // RESTORED LOGIC: Using sessionId from join
            if (table.sessionId) {
                const { data: session, error } = await supabase
                    .from('pos_sessions')
                    .select('*')
                    .eq('id', table.sessionId)
                    .single();

                if (error) throw error;

                setActiveSession(session);
                setSelectedTable(table);
            }
            // 2. If table is empty -> Create new session
            else {
                const { data: { user } } = await supabase.auth.getUser();
                const { data: newSession, error } = await supabase
                    .from('pos_sessions')
                    .insert({
                        tenant_id: user.id,
                        table_id: table.id,
                        status: 'active',
                        total_amount: 0
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Update table linkage immediately
                await supabase
                    .from('restaurant_tables')
                    .update({
                        status: 'occupied',
                        current_session_id: newSession.id
                    })
                    .eq('id', table.id);

                setActiveSession(newSession);
                setSelectedTable({ ...table, status: 'occupied', current_session_id: newSession.id });
                // No toast on creation to keep it quiet
            }


        } catch (err) {
            console.error('Table click error:', err);
            toast.error('Hata: ' + err.message);
        }
    };

    // --- SECTION CRUD ---
    const handleAddSection = async () => {
        if (!canManageTables) return toast.error('Yetkiniz yok');
        const name = prompt('Bölge Adı (Örn: Salon, Teras, Bahçe):');
        if (!name) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('sections').insert({
                tenant_id: user.id,
                name,
                sort_order: sections.length
            });
            toast.success('Bölge eklendi');
            fetchData();
        } catch (err) {
            toast.error('Hata: ' + err.message);
        }
    };

    const handleEditSection = async (section) => {
        if (!canManageTables) return toast.error('Yetkiniz yok');
        const newName = prompt('Yeni Bölge Adı:', section.name);
        if (!newName || newName === section.name) return;
        try {
            await supabase.from('sections').update({ name: newName }).eq('id', section.id);
            toast.success('Bölge güncellendi');
            fetchData();
        } catch (err) {
            toast.error('Hata: ' + err.message);
        }
    };

    const handleDeleteSection = async (section) => {
        if (!canManageTables) return toast.error('Yetkiniz yok');
        if (!window.confirm(`${section.name} bölgesini silmek istediğinize emin misiniz?`)) return;
        try {
            await supabase.from('sections').delete().eq('id', section.id);
            toast.success('Bölge silindi');
            if (activeSection === section.id) setActiveSection('all');
            fetchData();
        } catch (err) {
            toast.error('Hata: ' + err.message);
        }
    };

    // --- ONLINE ORDER STATUS UPDATE ---
    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            // Update selected order UI state
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
            // Update orders list UI state
            setOnlineOrders(prevOrders =>
                prevOrders.map(order =>
                    order.id === orderId ? { ...order, status: newStatus } : order
                )
            );

            // Update database
            const { error } = await supabase
                .from('external_platform_orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
        } catch (err) {
            console.error('Order status update error:', err);
            toast.error('Durum güncellenemedi');
        }
    };

    // --- TABLE CRUD ---
    const handleAddTable = async () => {
        if (!canManageTables) return toast.error('Yetkiniz yok');
        const name = prompt('Masa Adı (Örn: A-1, VIP-3):');
        if (!name) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const sectionId = activeSection === 'all' ? sections[0]?.id : activeSection;
            if (!sectionId) {
                toast.error('Önce bir bölge ekleyin');
                return;
            }
            await supabase.from('restaurant_tables').insert({
                tenant_id: user.id,
                section_id: sectionId,
                table_number: name,
                capacity: 4
            });
            toast.success('Masa eklendi');
            fetchData();
        } catch (err) {
            toast.error('Hata: ' + err.message);
        }
    };

    const handleEditTable = async (table) => {
        const newName = prompt('Yeni Masa Adı:', table.table_number);
        if (!newName || newName === table.table_number) return;
        try {
            await supabase.from('restaurant_tables').update({ table_number: newName }).eq('id', table.id);
            toast.success('Masa güncellendi');
            fetchData();
        } catch (err) {
            toast.error('Hata: ' + err.message);
        }
    };

    const handleDeleteTable = async (table) => {
        if (!window.confirm(`${table.table_number} masasını silmek istediğinize emin misiniz?`)) return;
        try {
            await supabase.from('restaurant_tables').delete().eq('id', table.id);
            toast.success('Masa silindi');
            fetchData();
        } catch (err) {
            toast.error('Hata: ' + err.message);
        }
    };

    // --- ACTION HANDLERS ---
    const handleActionClick = (actionId) => {
        if (!selectedTable) {
            toast.error('Önce bir masa seçin');
            return;
        }
        switch (actionId) {
            case 'barcode': toast('Barkod okuyucu açılıyor...', { icon: '📷' }); break;
            case 'edit':
                if (!canManageTables) { toast.error('Yetkiniz yok'); break; }
                handleEditTable(selectedTable); break;
            case 'cancel':
                if (!canCancelOrders) { toast.error('Yetkiniz yok'); break; }
                if (window.confirm(`${selectedTable.table_number} adisyonunu iptal etmek istediğinize emin misiniz?`)) {
                    toast.success('Adisyon iptal edildi');
                    setSelectedTable(null);
                    fetchData();
                }
                break;
            case 'notes': {
                const note = prompt('Masa notu ekleyin:');
                if (note) toast.success('Not eklendi: ' + note);
                break;
            }
            case 'move': toast('Masa taşıma özelliği yakında...', { icon: '🔄' }); break;
            default: break;
        }
    };

    // --- RENDER: HEADER ---
    const renderHeader = () => (
        <div className={`h-16 ${theme.header} border-b ${theme.border} flex items-center justify-between px-4 shrink-0 shadow-sm`}>
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/restore')} className={`p-2 ${theme.surfaceAlt} rounded-lg ${theme.textSecondary} transition-all`}>
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                    className={`p-2 ${theme.surfaceAlt} rounded-lg ${isLeftCollapsed ? 'text-blue-500 bg-blue-50' : theme.textSecondary} transition-all`}
                    title={isLeftCollapsed ? "Menüyü Göster" : "Menüyü Gizle"}
                >
                    <PanelLeft className="w-5 h-5" />
                </button>

                <div className={`flex ${theme.surfaceAlt} rounded-xl p-1 border ${theme.border}`}>
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tables' ? 'bg-blue-500 text-white shadow-lg' : theme.textSecondary}`}
                    >
                        <Utensils className="w-4 h-4 inline mr-1.5" /> MASALAR
                    </button>
                    <button
                        onClick={() => setActiveTab('online')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'online' ? 'bg-purple-500 text-white shadow-lg' : theme.textSecondary}`}
                    >
                        <Globe className="w-4 h-4 inline mr-1.5" /> ONLİNE SİPARİŞLER
                    </button>
                </div>
            </div>

            <div className="text-center">
                <div className={`text-2xl font-mono font-bold ${theme.text}`}>
                    {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`text-xs ${theme.textSecondary}`}>
                    {currentTime.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Fullscreen Toggle */}
                <button
                    onClick={() => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        } else {
                            document.documentElement.requestFullscreen();
                        }
                    }}
                    className={`p-2 ${theme.surfaceAlt} rounded-lg transition-all ${theme.textSecondary}`}
                    title="Tam Ekran"
                >
                    {document.fullscreenElement ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 ${theme.surfaceAlt} rounded-lg transition-all ${isDarkMode ? 'text-yellow-400' : 'text-slate-600'}`}
                    title={isDarkMode ? 'Açık Tema' : 'Koyu Tema'}
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <button
                    onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                    className={`p-2 ${theme.surfaceAlt} rounded-lg ${isRightCollapsed ? 'text-purple-500 bg-purple-50' : theme.textSecondary} transition-all`}
                    title={isRightCollapsed ? "Panel Göster" : "Panel Gizle"}
                >
                    <PanelRight className="w-5 h-5" />
                </button>

                {/* Lock Button (New) */}
                <button
                    onClick={() => window.dispatchEvent(new Event('app-lock'))}
                    className={`p-2 ${theme.surfaceAlt} rounded-lg text-red-500 hover:bg-red-50 transition-all`}
                    title="Ekranı Kilitle"
                >
                    <Lock className="w-5 h-5" />
                </button>

                {/* Notifications */}
                <button className={`relative p-2 ${theme.surfaceAlt} rounded-lg ${theme.textSecondary}`}>
                    <Bell className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">3</span>
                </button>

                {/* Connection Status */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                    {isOnline ? 'Bağlı' : 'Çevrimdışı'}
                </div>
            </div>
        </div>
    );

    // --- RENDER: LEFT COLUMN (Compact Summary Panel) ---
    const renderLeftColumn = () => {
        const onlineStats = {
            new: onlineOrders.filter(o => o.status === 'new').length,
            in_kitchen: onlineOrders.filter(o => o.status === 'in_kitchen').length,
            ready: onlineOrders.filter(o => o.status === 'ready').length,
            awaiting_courier: onlineOrders.filter(o => o.status === 'awaiting_courier').length,
        };

        return (
            <div className={`transition-all duration-300 ease-in-out ${isLeftCollapsed ? 'w-0 opacity-0 invisible' : 'w-64 opacity-100 visible'} ${theme.surface} border-r ${theme.border} flex flex-col shrink-0 overflow-y-auto`}>
                <div className="flex flex-col min-h-full w-64"> {/* Fixed width wrapper */}
                    {/* Section Header */}
                    <div className={`p-4 border-b ${theme.border}`}>
                        <h2 className={`text-sm font-bold ${theme.text} flex items-center gap-2`}>
                            🚀 Operasyonel Takip
                        </h2>
                    </div>

                    {/* Masa Durumu */}
                    <div className={`p-4 border-b ${theme.border}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[11px] font-bold ${theme.textSecondary} uppercase tracking-wider`}>Masalar</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-blue-50'} border ${isDarkMode ? 'border-slate-700' : 'border-blue-100'}`}>
                                <div className="text-[10px] text-blue-500 font-bold uppercase">Dolu</div>
                                <div className={`text-xl font-black ${theme.text}`}>{stats.occupied}</div>
                            </div>
                            <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'} border ${theme.border}`}>
                                <div className="text-[10px] text-gray-400 font-bold uppercase">Boş</div>
                                <div className={`text-xl font-black ${theme.text}`}>{stats.totalTables - stats.occupied}</div>
                            </div>
                        </div>
                    </div>

                    {/* Online Order Activity */}
                    <div className={`p-4 border-b ${theme.border}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[11px] font-bold ${theme.textSecondary} uppercase tracking-wider`}>Online Aktivite</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondary} flex items-center gap-2`}>
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div> Yeni
                                </span>
                                <span className={`font-bold ${theme.text}`}>{onlineStats.new}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondary} flex items-center gap-2`}>
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div> Mutfakta
                                </span>
                                <span className={`font-bold ${theme.text}`}>{onlineStats.in_kitchen}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondary} flex items-center gap-2`}>
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div> Hazır
                                </span>
                                <span className={`font-bold ${theme.text}`}>{onlineStats.ready}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-sm ${theme.textSecondary} flex items-center gap-2`}>
                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div> Kurye Bekleyen
                                </span>
                                <span className={`font-bold ${theme.text}`}>{onlineStats.awaiting_courier}</span>
                            </div>
                        </div>
                    </div>

                    {/* Kurye Durumu */}
                    <div className={`p-4 border-b ${theme.border} flex-1`}>
                        <div className="flex justify-between items-center mb-3">
                            <span className={`text-[11px] font-bold ${theme.textSecondary} uppercase tracking-wider flex items-center gap-1`}>
                                <Bike className="w-3 h-3" /> Kuryeler
                            </span>
                        </div>
                        {couriers.length === 0 ? (
                            <div className="text-[11px] text-gray-400 text-center py-4 italic">
                                Aktif kurye bulunmuyor
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {couriers.map(courier => (
                                    <div key={courier.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={`w-2 h-2 rounded-full ${courier.status === 'available' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                                            <span className={`text-xs font-medium ${theme.text} truncate`}>{courier.profile?.full_name?.split(' ')[0]}</span>
                                        </div>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${courier.status === 'available'
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-amber-100 text-amber-600'
                                            }`}>
                                            {courier.status === 'available' ? 'Müsait' : 'Yolda'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Daily Total - Privacy Focused */}
                    {canAccessSettings && (
                        <div className={`p-4 border-t ${theme.border} ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[10px] font-bold ${theme.textSecondary} uppercase tracking-tight`}>Günlük Ciro</span>
                                <button
                                    onClick={() => setShowRevenue(!showRevenue)}
                                    className={`p-1 hover:${theme.surfaceAlt} rounded-md transition-colors ${theme.textSecondary}`}
                                >
                                    {showRevenue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black ${theme.text} transition-all duration-300 ${!showRevenue ? 'blur-[6px] select-none' : ''}`}>
                                    ₺{stats.amount.toLocaleString('tr-TR')}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className={`p-4 border-t ${theme.border} space-y-2`}>
                        {ACTION_ITEMS.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleActionClick(item.id)}
                                className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all ${selectedTable
                                    ? `${theme.card} ${theme.cardHover} ${theme.text} border ${theme.border}`
                                    : `${theme.surfaceAlt} text-gray-400 cursor-not-allowed`
                                    }`}
                                disabled={!selectedTable}
                            >
                                <item.icon className="w-4 h-4" />
                                <span className="text-xs font-medium">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // --- RENDER: CENTER COLUMN ---
    const renderCenterColumn = () => (
        <div className={`flex-1 overflow-hidden flex flex-col ${theme.bg}`}>
            {activeTab === 'tables' ? (
                <>
                    <div className={`p-4 border-b ${theme.border} flex items-center gap-4`}>
                        <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                            <span className="text-gray-500 text-sm">Boş: {stats.totalTables - stats.occupied}</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-blue-100 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-blue-600 text-sm">Dolu: {stats.occupied}</span>
                        </div>
                        <button onClick={fetchData} className={`ml-auto p-2 ${theme.surfaceAlt} rounded-lg ${theme.textSecondary}`}>
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-4 gap-4">
                            {tables
                                .filter(t => activeSection === 'all' || t.section_id === activeSection)
                                .map(table => {
                                    const colors = TABLE_COLORS[table.status] || TABLE_COLORS.empty;
                                    const isSelected = selectedTable?.id === table.id;
                                    const finalColors = isSelected ? TABLE_COLORS.selected : colors;

                                    // Check for pending requests
                                    const session = Array.isArray(table.current_session) ? table.current_session[0] : table.current_session;
                                    const hasPending = session && (session.status === 'pending_approval' || (session.pending_devices && session.pending_devices.length > 0));

                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => handleTableClick(table)}
                                            className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${finalColors.bg} ${finalColors.border} ${finalColors.text} hover:scale-[1.03] hover:shadow-xl min-h-[140px] flex flex-col justify-between group
                                            ${hasPending ? 'animate-pulse ring-4 ring-red-400 ring-offset-2' : ''}`}
                                        >
                                            {hasPending && (
                                                <div className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg z-20 animate-bounce">
                                                    <Lock className="w-5 h-5" />
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start">
                                                <div className="text-2xl font-black">{table.table_number}</div>
                                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEditTable(table); }} className="p-1 bg-white/20 rounded">
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTable(table); }} className="p-1 bg-white/20 rounded">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            {table.status === 'occupied' ? (
                                                <div className="flex-1 flex flex-col items-center justify-center">
                                                    <div className="text-2xl font-black">₺{table.amount.toLocaleString('tr-TR')}</div>
                                                    <div className="text-xs opacity-70 mt-1"><Clock className="w-3 h-3 inline" /> {table.time} dk</div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center text-sm opacity-60">
                                                    <Users className="w-4 h-4 mr-1" /> {table.capacity} Kişi
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                            <button onClick={handleAddTable} className="min-h-[140px] rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all flex flex-col items-center justify-center gap-2">
                                <Plus className="w-8 h-8" />
                                <span className="text-sm font-bold">Masa Ekle</span>
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                /* ONLINE ORDERS VIEW - FULL WORKFLOW */
                <div className="flex-1 flex overflow-hidden">
                    {/* Platform Sidebar */}
                    <div className={`w-20 ${theme.sidebar} border-r ${theme.border} flex flex-col items-center py-4 gap-3`}>
                        {PLATFORMS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setActivePlatform(p.id)}
                                className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all ${activePlatform === p.id ? `${p.bg} border-2` : theme.card}`}
                            >
                                <p.icon className={`w-6 h-6 ${p.color}`} />
                                <span className={`text-[9px] ${theme.textSecondary} mt-1`}>{p.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Orders List - Grouped by Status */}
                    <div className={`w-80 ${theme.surface} border-r ${theme.border} flex flex-col`}>
                        <div className={`p-4 border-b ${theme.border} flex justify-between items-center`}>
                            <h2 className={`text-sm font-bold ${theme.text}`}>
                                🌐 {activePlatform === 'all' ? 'Tüm Siparişler' : PLATFORMS.find(p => p.id === activePlatform)?.name}
                            </h2>
                            <button onClick={fetchData} className={`p-1.5 ${theme.surfaceAlt} rounded-lg`}>
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {onlineOrders
                                .filter(order => activePlatform === 'all' || order.platform === activePlatform)
                                .map(order => {
                                    const statusInfo = ORDER_STATUSES[order.status];
                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedOrder?.id === order.id
                                                ? 'bg-purple-100 border-purple-400'
                                                : `${theme.card} ${theme.border} hover:border-purple-300`
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className={`font-bold ${theme.text}`}>#{2000 + order.id}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.bgLight} ${statusInfo.textColor} font-bold`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <div className={`text-xs ${theme.textSecondary} mt-2 flex items-center gap-1`}>
                                                {PLATFORMS.find(p => p.id === order.platform)?.icon &&
                                                    React.createElement(PLATFORMS.find(p => p.id === order.platform).icon, { className: 'w-3 h-3' })
                                                }
                                                {PLATFORMS.find(p => p.id === order.platform)?.name}
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-purple-500 font-bold">₺{order.total_amount}</span>
                                                <span className={`text-xs ${theme.textSecondary}`}>
                                                    {Math.floor((Date.now() - new Date(order.ordered_at).getTime()) / 60000)} dk önce
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Order Detail & Actions */}
                    <div className={`flex-1 ${theme.bg} p-6 overflow-y-auto`}>
                        {selectedOrder ? (
                            <div className="max-w-lg mx-auto">
                                {/* Order Header */}
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className={`text-xl font-bold ${theme.text}`}>
                                        Sipariş #{2000 + selectedOrder.id}
                                    </h2>
                                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${ORDER_STATUSES[selectedOrder.status].bgLight} ${ORDER_STATUSES[selectedOrder.status].textColor}`}>
                                        {ORDER_STATUSES[selectedOrder.status].label}
                                    </span>
                                </div>

                                {/* Order Items */}
                                <div className={`${theme.card} rounded-xl border ${theme.border} mb-4 overflow-hidden`}>
                                    <div className={`p-3 border-b ${theme.border} ${theme.surfaceAlt} flex items-center gap-2`}>
                                        <ChefHat className="w-4 h-4" />
                                        <span className="font-bold text-sm">Ürünler</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className={`flex justify-between ${theme.text}`}>
                                            <span>2x Classic Burger</span>
                                            <span className="font-bold">₺{selectedOrder.amount - 35}</span>
                                        </div>
                                        <div className={`flex justify-between ${theme.text}`}>
                                            <span>1x İçecek</span>
                                            <span className="font-bold">₺35</span>
                                        </div>
                                        <div className={`border-t pt-3 flex justify-between font-bold ${theme.text}`}>
                                            <span>TOPLAM</span>
                                            <span className="text-purple-500">₺{selectedOrder.total_amount}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Delivery Address */}
                                <div className={`${theme.card} rounded-xl border ${theme.border} mb-6 p-4`}>
                                    <div className={`flex items-center gap-2 ${theme.textSecondary} mb-2`}>
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-sm font-bold">Teslimat Adresi</span>
                                    </div>
                                    <p className={`${theme.text}`}>{selectedOrder.customer_address || selectedOrder.address}</p>
                                </div>

                                {/* Status Flow - Dynamic Buttons based on current status */}
                                <div className="space-y-3">
                                    {selectedOrder.status === 'in_kitchen' && (
                                        <button
                                            onClick={() => {
                                                toast.success('Sipariş HAZIR olarak işaretlendi');
                                                updateOrderStatus(selectedOrder.id, 'ready');
                                            }}
                                            className="w-full py-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                                        >
                                            <CheckCircle className="w-5 h-5" /> SİPARİŞ HAZIR
                                        </button>
                                    )}

                                    {selectedOrder.status === 'ready' && (
                                        <button
                                            onClick={() => {
                                                setCourierOrderId(selectedOrder.id);
                                                setCourierOrderDetails({
                                                    display_id: selectedOrder.platform_order_number || selectedOrder.id.slice(0, 8),
                                                    delivery_address: selectedOrder.customer_address || selectedOrder.address,
                                                    customer_phone: selectedOrder.customer_phone || 'Kayıtlı değil'
                                                });
                                                setShowCourierModal(true);
                                                updateOrderStatus(selectedOrder.id, 'awaiting_courier');
                                            }}
                                            className="w-full py-4 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Truck className="w-5 h-5" /> KURYE ATA
                                        </button>
                                    )}

                                    {selectedOrder.status === 'awaiting_courier' && (
                                        <>
                                            <div className={`p-4 rounded-xl ${theme.surfaceAlt} border ${theme.border} text-center`}>
                                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                                                <p className={`font-bold ${theme.text}`}>Kurye Bekleniyor</p>
                                                <p className={`text-sm ${theme.textSecondary}`}>Dahili kurye veya Maxijett ataması yapıldı</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    toast.success('Kurye siparişi aldı - Teslimde');
                                                    updateOrderStatus(selectedOrder.id, 'delivering');
                                                }}
                                                className="w-full py-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Bike className="w-5 h-5" /> KURYE YOLA ÇIKTI
                                            </button>
                                        </>
                                    )}

                                    {selectedOrder.status === 'delivering' && (
                                        <>
                                            <div className={`p-4 rounded-xl bg-indigo-100 border border-indigo-200 text-center`}>
                                                <Truck className="w-8 h-8 mx-auto mb-2 text-indigo-500 animate-pulse" />
                                                <p className="font-bold text-indigo-700">Kurye Yolda</p>
                                                <p className="text-sm text-indigo-600">Teslimat yapılıyor...</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    toast.success('Sipariş TESLİM EDİLDİ ✓');
                                                    updateOrderStatus(selectedOrder.id, 'delivered');
                                                }}
                                                className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                                            >
                                                <CheckCircle className="w-5 h-5" /> TESLİM EDİLDİ
                                            </button>
                                        </>
                                    )}

                                    {selectedOrder.status === 'delivered' && (
                                        <div className={`p-6 rounded-xl bg-green-100 border border-green-200 text-center`}>
                                            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                            <p className="font-bold text-green-700 text-lg">Sipariş Tamamlandı</p>
                                            <p className="text-sm text-green-600 mt-1">Teslimat başarıyla gerçekleştirildi</p>
                                            <button
                                                onClick={() => setSelectedOrder(null)}
                                                className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg font-bold"
                                            >
                                                Kapat
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className={`h-full flex flex-col items-center justify-center ${theme.textSecondary}`}>
                                <Globe className="w-16 h-16 mb-4 opacity-30" />
                                <p className="text-lg font-bold">Online Sipariş Seçin</p>
                                <p className="text-sm mt-1 opacity-60">Soldaki listeden bir sipariş seçin</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // --- RENDER: RIGHT COLUMN ---
    const renderRightColumn = () => (
        <div className={`transition-all duration-300 ease-in-out ${isRightCollapsed ? 'w-0 opacity-0 invisible' : 'w-28 opacity-100 visible'} ${theme.sidebar} border-l ${theme.border} flex flex-col overflow-hidden`}>
            <div className="flex flex-col h-full w-28"> {/* Fixed width wrapper */}
                <div className="flex-1 py-4 space-y-2 overflow-y-auto">
                    <button onClick={() => setActiveSection('all')} className={`w-full py-3 text-center text-sm font-bold transition-all ${activeSection === 'all' ? 'bg-blue-500 text-white' : theme.textSecondary}`}>
                        <span className="block text-lg">🏠</span>
                        <span className="text-[10px]">TÜM</span>
                    </button>

                    {sections.map((section, i) => (
                        <div key={section.id} className="relative group">
                            <button onClick={() => setActiveSection(section.id)} className={`w-full py-3 text-center text-sm font-bold transition-all ${activeSection === section.id ? 'bg-purple-500 text-white' : theme.textSecondary}`}>
                                <span className="block text-lg">{['🍽️', '🌿', '☀️', '🌙'][i % 4]}</span>
                                <span className="text-[10px] truncate block px-1">{section.name}</span>
                            </button>
                            <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                <button onClick={() => handleEditSection(section)} className="p-1 bg-white/80 rounded text-gray-600 hover:text-blue-500"><Edit className="w-3 h-3" /></button>
                                <button onClick={() => handleDeleteSection(section)} className="p-1 bg-white/80 rounded text-gray-600 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                        </div>
                    ))}

                    <button onClick={handleAddSection} className={`w-full py-3 text-center border-2 border-dashed ${isDarkMode ? 'border-slate-600 text-slate-500' : 'border-gray-300 text-gray-400'} hover:border-purple-400 hover:text-purple-500`}>
                        <Plus className="w-5 h-5 mx-auto" />
                        <span className="text-[10px]">Bölge Ekle</span>
                    </button>
                </div>

                <div className={`border-t ${theme.border} p-2 space-y-2`}>
                    <button onClick={() => navigate('/restore/settings')} className={`w-full p-3 rounded-xl ${theme.surfaceAlt} ${theme.textSecondary}`}>
                        <Settings className="w-5 h-5 mx-auto" />
                    </button>
                    <button onClick={() => supabase.auth.signOut().then(() => navigate('/restore/login'))} className="w-full p-3 rounded-xl bg-red-100 text-red-500">
                        <LogOut className="w-5 h-5 mx-auto" />
                    </button>
                </div>
            </div>
        </div>
    );

    // --- MAIN RENDER ---
    if (selectedTable && activeTab === 'tables' && activeSession) {
        return <POSOrderView table={selectedTable} session={activeSession} onBack={() => { setSelectedTable(null); setActiveSession(null); fetchData(); }} />;
    }

    return (
        <div className={`h-screen w-screen ${theme.bg} flex flex-col overflow-hidden font-sans`}>
            {renderHeader()}
            <div className="flex-1 flex overflow-hidden">
                {renderLeftColumn()}
                {renderCenterColumn()}
                {renderRightColumn()}
            </div>

            {/* Courier Assignment Modal */}
            <AssignCourierModal
                isOpen={showCourierModal}
                onClose={() => setShowCourierModal(false)}
                orderId={courierOrderId}
                tenantId={tenantId}
                orderSource="external"
                orderDetails={courierOrderDetails}
            />

            {/* Approval Modal */}
            {approvalModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <Lock className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Erişim İsteği</h2>
                                    <p className="text-sm text-slate-500">{approvalModal.table?.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setApprovalModal({ open: false, table: null, session: null })} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {approvalModal.session?.status === 'pending_approval' ? (
                                <div className="text-center py-4">
                                    <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 border border-green-100">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <p className="font-medium">Müşteri masayı açmak istiyor.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => handleRejectRequest(approvalModal.session)}
                                            className="py-3 px-4 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition"
                                        >
                                            Reddet
                                        </button>
                                        <button
                                            onClick={() => handleApproveSession(approvalModal.session)}
                                            className="py-3 px-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition"
                                        >
                                            Masayı Aç
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        Yeni Cihaz İstekleri
                                    </h3>
                                    <div className="space-y-3">
                                        {approvalModal.session?.pending_devices?.map((req, i) => (
                                            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                                                <div>
                                                    <div className="font-mono text-xs text-slate-400 mb-1">ID: {req.device_id?.slice(0, 8)}</div>
                                                    <div className="text-sm font-medium text-slate-600">{new Date(req.requested_at).toLocaleTimeString('tr-TR')}</div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleRejectRequest(approvalModal.session, req)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                        title="Reddet"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveDevice(approvalModal.session, req)}
                                                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition flex items-center gap-2"
                                                        title="Onayla"
                                                    >
                                                        <CheckCircle className="w-5 h-5" />
                                                        Onayla
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
