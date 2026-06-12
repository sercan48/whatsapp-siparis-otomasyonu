import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Minus, Trash2, Printer, CreditCard, X, QrCode, XCircle, Grid, LayoutTemplate, Monitor, LayoutGrid, BoxSelect, Settings, Clock, Square, Save } from 'lucide-react';

// ... (skip down to table rendering)


import toast from 'react-hot-toast';
import { printReceipt } from '../utils/receiptPrinter';
import { POSOrderView } from './POSOrderView'; // Import the new view

export const POSManagement = () => {
    const [sections, setSections] = useState([]);
    const [tables, setTables] = useState([]);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('view'); // 'view' or 'edit'

    // View State
    const [activeTable, setActiveTable] = useState(null);

    // Floor Plan State
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'floor'
    const [draggedTable, setDraggedTable] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Form States
    const [newSectionName, setNewSectionName] = useState('');
    const [newTableCount, setNewTableCount] = useState(1);
    const [newTablePrefix, setNewTablePrefix] = useState('A-');

    // Timer State
    const [now, setNow] = useState(new Date());

    // Role State
    const [userRole, setUserRole] = useState(null);

    // QR State
    const [qrTable, setQrTable] = useState(null);

    useEffect(() => {
        fetchData();
        fetchUserRole();
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchUserRole = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                setUserRole(data?.role || 'admin'); // Default to admin for testing
            }
        } catch (error) {
            console.error('Role fetch error:', error);
        }
    };



    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Sections
            const { data: sectionsData } = await supabase
                .from('sections')
                .select('*')
                .eq('tenant_id', user.id)
                .order('created_at');

            // Fetch Tables with Active Sessions
            const { data: tablesData, error: tablesError } = await supabase
                .from('restaurant_tables')
                .select(`
                    *,
                    current_session:pos_sessions(*)
                `)
                .eq('tenant_id', user.id)
                .order('name');

            if (tablesError) throw tablesError;

            setSections(sectionsData || []);
            setTables(tablesData || []);

            if (sectionsData?.length > 0 && !activeSectionId) {
                setActiveSectionId(sectionsData[0].id);
            }
        } catch (error) {
            console.error('Error fetching POS data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e, table) => {
        if (mode !== 'edit') return;
        setDraggedTable(table);
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        e.dataTransfer.effectAllowed = 'move';

        // Ghost Image
        const ghost = document.createElement('div');
        ghost.classList.add('invisible');
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (draggedTable) {
            const containerRect = e.currentTarget.getBoundingClientRect();
            let x = e.clientX - containerRect.left - dragOffset.x;
            let y = e.clientY - containerRect.top - dragOffset.y;

            x = Math.max(0, x);
            y = Math.max(0, y);

            setTables(prev => prev.map(t => t.id === draggedTable.id ? { ...t, position_x: Math.round(x), position_y: Math.round(y) } : t));
            setDraggedTable(null);
        }
    };

    const saveLayout = async () => {
        try {
            const updates = tables.map(t => ({
                id: t.id,
                position_x: t.position_x || 0,
                position_y: t.position_y || 0,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('restaurant_tables').upsert(updates);
            if (error) throw error;
            toast.success('Yerleşim kaydedildi!');
        } catch (error) {
            toast.error('Kayıt hatası: ' + error.message);
        }
    };

    const handleAddSection = async () => {
        if (!newSectionName.trim()) {
            toast.error('Lütfen bir bölge adı girin.');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('sections').insert({
                tenant_id: user.id,
                name: newSectionName
            });

            if (error) throw error;

            toast.success('Bölge eklendi!');
            setNewSectionName('');
            fetchData();
        } catch (error) {
            console.error('Section Error:', error);
            toast.error(`Hata: ${error.message}`);
        }
    };

    const handleAddTables = async () => {
        if (!activeSectionId) {
            toast.error('Önce bir bölge seçiniz.');
            return;
        }

        try {
            const { data: { user } = {} } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Kullanıcı oturumu bulunamadı.');
                return;
            }
            const newTables = Array.from({ length: newTableCount }).map((_, i) => ({
                tenant_id: user.id,
                section_id: activeSectionId,
                name: `${newTablePrefix}${i + 1}`,
                status: 'empty',
                shape: 'square'
            }));

            const { error } = await supabase.from('restaurant_tables').insert(newTables);
            if (error) throw error;

            toast.success(`${newTableCount} masa eklendi!`);
            fetchData();
        } catch (error) {
            console.error('Table Error:', error);
            toast.error(`Hata: ${error.message}`);
        }
    };

    const handleDeleteTable = async (id) => {
        try {
            const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
            if (error) throw error;
            toast.success('Masa silindi.', { duration: 1500 });
            setTables(tables.filter(t => t.id !== id));
        } catch (error) {
            toast.error(`Silinemedi: ${error.message}`);
        }
    };

    const handleTableClick = async (table) => {
        if (mode === 'edit') return;

        if (table.status === 'occupied') {
            setActiveTable(table); // Switch to Order View
        } else {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                const { data: session, error: sessionError } = await supabase
                    .from('pos_sessions')
                    .insert({
                        tenant_id: user.id,
                        table_id: table.id,
                        status: 'active',
                        opened_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (sessionError) throw sessionError;

                const { error: tableError } = await supabase
                    .from('restaurant_tables')
                    .update({
                        status: 'occupied',
                        current_session_id: session.id
                    })
                    .eq('id', table.id);

                if (tableError) throw tableError;

                toast.success('Oturum başlatıldı', { position: 'bottom-center', duration: 2000 });
                fetchData();
            } catch (error) {
                console.error('Session Start Error:', error);
                toast.error('Oturum açılamadı');
            }
        }
    };

    const getDuration = (openedAt) => {
        if (!openedAt) return '';
        const start = new Date(openedAt);
        const diff = now - start;

        if (diff < 0) return '0sn';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const hVal = hours > 0 ? `${hours}sa ` : '';
        const mVal = mins > 0 ? `${mins}dk ` : (hours > 0 ? '0dk ' : '');
        const sVal = `${secs}sn`;

        return `${hVal}${mVal}${sVal}`;
    };

    const currentTables = tables.filter(t => t.section_id === activeSectionId);

    if (loading) return <div className="p-10 text-center animate-pulse">POS Sistemleri Yükleniyor...</div>;

    // Render Order View if active
    if (activeTable) {
        const session = Array.isArray(activeTable.current_session)
            ? activeTable.current_session[0]
            : activeTable.current_session;

        return (
            <POSOrderView
                table={activeTable}
                session={session}
                onBack={() => {
                    setActiveTable(null);
                    fetchData();
                }}
            />
        );
    }

    return (
        <div className="p-6 h-[calc(100vh-64px)] flex flex-col bg-slate-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Masa Yönetimi</h1>
                    <p className="text-slate-500 text-sm">
                        {mode === 'edit' ? 'Yapılandırma Modu: Masa ekleyin veya düzenleyin.' : 'Operasyon Modu: Sipariş almak için masaya tıklayın.'}
                    </p>
                </div>
                <div className="flex gap-4">
                    {/* View Toggles */}
                    <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="hidden sm:inline">Liste</span>
                        </button>
                        <button
                            onClick={() => setViewMode('floor')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'floor' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'}`}
                        >
                            <BoxSelect className="w-4 h-4" />
                            <span className="hidden sm:inline">Kroki</span>
                        </button>
                    </div>

                    {/* Mode Toggles */}
                    {userRole !== 'waiter' && (
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                            <button
                                onClick={() => setMode('view')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'view' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                <LayoutGrid className="w-4 h-4 inline-block lg:mr-2" />
                                <span className="hidden lg:inline">Operasyon</span>
                            </button>
                            <button
                                onClick={() => setMode('edit')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'edit' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                <Settings className="w-4 h-4 inline-block lg:mr-2" />
                                <span className="hidden lg:inline">Düzenle</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Empty State */}
            {sections.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-gray-300 rounded-xl">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Henüz Bölge Yok</h2>
                    <p className="text-gray-500 mb-6">Önce restoranınızın bölgelerini oluşturun.</p>
                    <div className="flex gap-2">
                        <input
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Örn: Bahçe"
                        />
                        <button
                            onClick={handleAddSection}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
                        >
                            Oluştur
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {sections.length > 0 && (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 h-full overflow-hidden">
                    {/* Left: Sections & Tools (Mobile: Top Stick Bar, Desktop: Sidebar) */}
                    <div className="w-full lg:w-72 flex-shrink-0 flex flex-row lg:flex-col gap-2 lg:gap-4 bg-white p-2 lg:p-4 rounded-xl shadow-sm border border-gray-100 h-fit overflow-x-auto lg:overflow-visible">
                        <h3 className="font-bold text-gray-700 hidden lg:block mb-2">Bölgeler</h3>

                        {/* Sections List */}
                        <div className="flex flex-row lg:flex-col gap-2 min-w-max">
                            {sections.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSectionId(s.id)}
                                    className={`
                                        text-left px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-between gap-3
                                        ${activeSectionId === s.id
                                            ? 'bg-slate-800 text-white shadow-md transform scale-105'
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
                                    `}
                                >
                                    <span className="whitespace-nowrap">{s.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeSectionId === s.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        {tables.filter(t => t.section_id === s.id).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {mode === 'edit' && (
                            <div className="hidden lg:block">
                                <div className="border-t border-gray-100 my-2 pt-2"></div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Hızlı Bölge Ekle</h4>
                                <div className="flex gap-2">
                                    {/* ... keeping existing desktop edit inputs ... */}
                                    <input
                                        value={newSectionName}
                                        onChange={(e) => setNewSectionName(e.target.value)}
                                        className="w-full border border-gray-200 rounded p-2 text-sm focus:border-blue-500 outline-none"
                                        placeholder="Bölge Adı"
                                    />
                                    <button
                                        onClick={handleAddSection}
                                        className="bg-slate-800 text-white px-3 rounded text-sm font-bold hover:bg-slate-700"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Table Grid */}
                    <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100 flex-shrink-0">
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                                {sections.find(s => s.id === activeSectionId)?.name}
                            </h2>
                            <div className="flex gap-4 text-sm font-medium text-gray-500 items-center">
                                {mode === 'edit' && viewMode === 'floor' && (
                                    <button
                                        onClick={saveLayout}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-green-700 mr-4 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Yerleşimi Kaydet
                                    </button>
                                )}
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-white border-2 border-dashed border-gray-300 rounded-full"></div>
                                    Boş
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-100 border border-red-500 rounded-full"></div>
                                    Dolu
                                </div>
                            </div>
                        </div>

                        {/* VIEW MODE: GRID */}
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6 place-items-center">
                                {currentTables.map(table => (
                                    <div
                                        key={table.id}
                                        onClick={() => handleTableClick(table)}
                                        className={`
                                            w-full aspect-square rounded-2xl relative group cursor-pointer transition-all duration-300
                                            flex flex-col items-center justify-center p-2 lg:p-4 shadow-sm
                                            ${table.status === 'occupied'
                                                ? 'bg-red-50 border-2 border-red-400 shadow-red-100'
                                                : 'bg-white border-2 border-blue-100 hover:border-blue-400 hover:shadow-lg border-dashed'}
                                        `}
                                    >
                                        {mode === 'edit' && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                                                    className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 rounded-full shadow-md border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setQrTable(table); }}
                                                    className="absolute -top-2 right-8 p-1.5 bg-white text-blue-600 rounded-full shadow-md border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-blue-50"
                                                    title="QR Kod Göster"
                                                >
                                                    <QrCode className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        <div className="text-center z-0">
                                            <div className={`mb-2 p-2 rounded-lg ${table.status === 'occupied' ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                <Square className="w-6 h-6" />
                                            </div>
                                            <h3 className={`text-xl font-bold ${table.status === 'occupied' ? 'text-red-600' : 'text-slate-700'}`}>
                                                {table.name}
                                            </h3>

                                            {table.status === 'occupied' ? (() => {
                                                const session = Array.isArray(table.current_session)
                                                    ? table.current_session[0]
                                                    : table.current_session;

                                                return (
                                                    <div className="flex flex-col items-center">
                                                        <div className="mt-2 flex items-center gap-1 text-xs font-bold text-red-500 bg-white/50 px-2 py-1 rounded-full">
                                                            <Clock className="w-3 h-3" />
                                                            {getDuration(session?.opened_at) || '0sn'}
                                                        </div>
                                                        <div className="mt-1 text-sm font-black text-gray-800">
                                                            ₺{(session?.total_amount || 0).toFixed(2)}
                                                        </div>
                                                    </div>
                                                );
                                            })() : (
                                                <div className="mt-1 text-xs text-gray-400 font-medium">
                                                    Boş
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {mode === 'edit' && (
                                    <div className="w-full aspect-square rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 flex flex-col items-center justify-center p-4 hover:bg-blue-50 transition-colors">
                                        <div className="text-center space-y-3 w-full">
                                            <div className="text-blue-400 mb-1">
                                                <Plus className="w-8 h-8 mx-auto" />
                                            </div>

                                            <input
                                                value={newTablePrefix}
                                                onChange={e => setNewTablePrefix(e.target.value)}
                                                className="w-20 text-center text-sm border-b border-blue-300 bg-transparent outline-none font-bold text-slate-700 placeholder-blue-300"
                                                placeholder="A-"
                                            />

                                            <div className="flex items-center justify-center gap-2 bg-white rounded-lg px-2 py-1 border border-blue-100">
                                                <button onClick={() => setNewTableCount(Math.max(1, newTableCount - 1))} className="text-blue-600 hover:bg-blue-50 rounded px-1">-</button>
                                                <span className="text-sm font-bold text-slate-700 w-4 text-center">{newTableCount}</span>
                                                <button onClick={() => setNewTableCount(newTableCount + 1)} className="text-blue-600 hover:bg-blue-50 rounded px-1">+</button>
                                            </div>

                                            <button
                                                onClick={handleAddTables}
                                                className="w-full bg-blue-600 text-white text-xs py-2 rounded-lg font-bold shadow-sm hover:bg-blue-700 active:scale-95 transition-transform"
                                            >
                                                Hızlı Ekle
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* VIEW MODE: FLOOR PLAN */}
                        {viewMode === 'floor' && (
                            <div
                                className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl relative overflow-auto shadow-inner bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"
                                style={{ minHeight: '600px' }}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            >
                                {mode === 'edit' && <div className="absolute top-2 left-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded border border-yellow-200 z-10">Masa taşımak için sürükleyin. Kaydetmeyi unutmayın.</div>}

                                {currentTables.map(table => (
                                    <div
                                        key={table.id}
                                        draggable={mode === 'edit'}
                                        onDragStart={(e) => handleDragStart(e, table)}
                                        onClick={() => handleTableClick(table)}
                                        style={{
                                            position: 'absolute',
                                            left: table.position_x || 0, // database x
                                            top: table.position_y || 0, // database y
                                            zIndex: draggedTable?.id === table.id ? 50 : 10
                                        }}
                                        className={`
                                            w-32 h-32 rounded-full lg:rounded-2xl transition-shadow cursor-pointer flex flex-col items-center justify-center
                                            ${table.status === 'occupied'
                                                ? 'bg-red-500 text-white shadow-lg border-4 border-red-600'
                                                : 'bg-white text-gray-700 shadow-md border-2 border-gray-300 hover:border-blue-500'}
                                            ${mode === 'edit' ? 'cursor-move hover:scale-105' : ''}
                                        `}
                                    >
                                        <div className="font-bold text-xl">{table.name}</div>
                                        {table.status === 'occupied' ? (
                                            <div className="text-xs font-mono mt-1 opacity-90">
                                                ₺{Array.isArray(table.current_session)
                                                    ? table.current_session[0]?.total_amount
                                                    : table.current_session?.total_amount}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400">Boş</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}



            {/* QR Code Modal */}
            {qrTable && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center relative">
                        <button
                            onClick={() => setQrTable(null)}
                            className="absolute top-2 right-2 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <XCircle className="w-5 h-5 text-gray-500" />
                        </button>

                        <div className="bg-slate-900 text-white p-6 pb-12">
                            <h2 className="text-2xl font-bold">{qrTable.name}</h2>
                            <p className="opacity-80 text-sm mt-1">Bu masanın QR Kodunu okutun</p>
                        </div>

                        <div className="px-6 relative -mt-8">
                            <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.origin}/menu/${qrTable.id}`}
                                    alt={`QR Code for ${qrTable.name}`}
                                    className="w-48 h-48"
                                />
                            </div>
                        </div>

                        <div className="p-6 space-y-3">
                            <p className="text-xs text-gray-500 font-mono break-all bg-gray-50 p-2 rounded border">
                                {window.location.origin}/menu/{qrTable.id}
                            </p>

                            <div className="flex gap-2">
                                <a
                                    href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${window.location.origin}/menu/${qrTable.id}`}
                                    download={`Masa-${qrTable.name}-QR.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-700 transition"
                                >
                                    İndir / Yazdır
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
