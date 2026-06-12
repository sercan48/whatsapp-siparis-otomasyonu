import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Building2, Users, Briefcase, Wallet, TrendingUp, TrendingDown, PanelLeftClose, PanelLeftOpen, LayoutGrid, Edit, Trash2, X, Check, FileText, Settings } from 'lucide-react';
import { TenantConfigPage } from './TenantConfigPage';

const Badge = ({ active }) => (
    <span className={`px-2 py-1 rounded text-xs font-bold ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {active ? 'Aktif' : 'Pasif'}
    </span>
);

const TURKEY_CITIES = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
];

export const SuperAdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('tenants');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Data States
    const [tenants, setTenants] = useState([]);
    const [resellers, setResellers] = useState([]);
    const [applications, setApplications] = useState([]);
    const [tenantRequests, setTenantRequests] = useState([]); // NEW: Business requests from resellers
    const [editingTenant, setEditingTenant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ledger, setLedger] = useState([]);

    // Modal & Form States
    const [showEditTenantModal, setShowEditTenantModal] = useState(false);
    const [showEditResellerModal, setShowEditResellerModal] = useState(false);
    const [editingReseller, setEditingReseller] = useState(null);
    const [viewLog, setViewLog] = useState(null);

    // Tenant Config View
    const [selectedTenantForConfig, setSelectedTenantForConfig] = useState(null);

    const [tenantForm, setTenantForm] = useState({ name: '', slug: '', city: '', reseller_id: '', subscription_fee: 1500 });
    const [resellerForm, setResellerForm] = useState({ name: '', code: '', commission_rate: 10 });

    // Stats
    const totalRevenue = ledger.filter(l => l.direction === 'credit' && l.type === 'subscription_payment').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalPayouts = ledger.filter(l => l.direction === 'credit' && l.type === 'reseller_commission').reduce((acc, curr) => acc + Number(curr.amount), 0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tenantsRes, resellersRes, ledgerRes, appsRes, ticketsRes, tenantReqsRes] = await Promise.all([
                supabase.from('tenants').select('*, resellers:reseller_id(name)'),
                supabase.from('resellers').select('*'),
                supabase.from('ledger').select('*, tenants(name), resellers(name)').order('created_at', { ascending: false }),
                supabase.from('reseller_applications').select('*').order('created_at', { ascending: false }),
                supabase.from('support_tickets').select('tenant_id, status, ai_confidence_score'),
                supabase.from('tenant_requests').select('*, resellers(name)').order('created_at', { ascending: false })
            ]);

            // Calculate Complaint Stats per Tenant
            const tickets = ticketsRes.data || [];
            const tenantsWithStats = (tenantsRes.data || []).map(t => {
                const tenantTickets = tickets.filter(bt => bt.tenant_id === t.id);
                const activeComplaints = tenantTickets.filter(bt => bt.status === 'open').length;
                const totalTickets = tenantTickets.length;
                return { ...t, active_complaints: activeComplaints, total_complaints: totalTickets };
            });

            setTenants(tenantsWithStats);
            setResellers(resellersRes.data || []);
            setApplications(appsRes.data || []);
            setTenantRequests(tenantReqsRes.data || []); // NEW
            setLedger(ledgerRes.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- TENANT (RESTORAN) HANDLERS ---

    const handleAddTenant = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: tenantForm.name,
                slug: tenantForm.slug,
                city: tenantForm.city,
                subscription_fee: tenantForm.subscription_fee,
                reseller_id: tenantForm.reseller_id ? tenantForm.reseller_id : null
            };
            const { error } = await supabase.from('tenants').insert([payload]);
            if (error) throw error;
            setTenantForm({ name: '', slug: '', city: '', reseller_id: '', subscription_fee: 1500 });
            alert('Müşteri (Restoran) başarıyla eklendi!');
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleEditTenant = (tenant) => {
        setEditingTenant({
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            city: tenant.city || '',
            reseller_id: tenant.reseller_id || '',
            subscription_fee: tenant.subscription_fee || 1500,
            is_active: tenant.is_active
        });
        setShowEditTenantModal(true);
    };

    const handleUpdateTenant = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    name: editingTenant.name,
                    slug: editingTenant.slug,
                    city: editingTenant.city,
                    reseller_id: editingTenant.reseller_id || null,
                    subscription_fee: editingTenant.subscription_fee,
                    is_active: editingTenant.is_active
                })
                .eq('id', editingTenant.id);

            if (error) throw error;
            alert('Restoran bilgileri güncellendi!');
            setShowEditTenantModal(false);
            setEditingTenant(null);
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleDeleteTenant = async (tenantId, tenantName) => {
        if (!confirm(`"${tenantName}" restoranını silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) return;

        try {
            const { error } = await supabase
                .from('tenants')
                .delete()
                .eq('id', tenantId);

            if (error) throw error;
            alert('Restoran silindi.');
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const toggleTenantStatus = async (id, currentStatus) => {
        await supabase.from('tenants').update({ is_active: !currentStatus }).eq('id', id);
        fetchData();
    };

    const simulatePayment = async (tenant) => {
        const amount = tenant.subscription_fee || 1000;
        try {
            const { error } = await supabase.from('ledger').insert({
                tenant_id: tenant.id,
                type: 'subscription_payment',
                amount: amount,
                direction: 'credit',
                description: `${tenant.name} - Abonelik Ödemesi`,
                status: 'paid'
            });
            if (error) throw error;
            alert('Ödeme Simüle Edildi! (Komisyon otomatiği tetiklendi)');
            fetchData();
        } catch (err) {
            alert(err.message);
        }
    };

    // --- RESELLER (BAYİ) HANDLERS ---

    const handleAddReseller = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('resellers').insert([resellerForm]);
            if (error) throw error;
            setResellerForm({ name: '', code: '', commission_rate: 20 });
            alert('Bayi başarıyla eklendi!');
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleEditReseller = (reseller) => {
        setEditingReseller({
            id: reseller.id,
            name: reseller.name,
            code: reseller.code,
            commission_rate: reseller.commission_rate,
            tier: reseller.tier || 'bronze',
            contact_info: reseller.contact_info || '',
            is_active: reseller.is_active
        });
        setShowEditResellerModal(true);
    };

    const handleUpdateReseller = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('resellers')
                .update({
                    name: editingReseller.name,
                    code: editingReseller.code,
                    commission_rate: editingReseller.commission_rate,
                    tier: editingReseller.tier,
                    contact_info: editingReseller.contact_info,
                    is_active: editingReseller.is_active
                })
                .eq('id', editingReseller.id);

            if (error) throw error;
            alert('Bayi bilgileri güncellendi!');
            setShowEditResellerModal(false);
            setEditingReseller(null);
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleDeleteReseller = async (resellerId, resellerName) => {
        if (!confirm(`"${resellerName}" bayisini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) return;

        try {
            const { error } = await supabase
                .from('resellers')
                .delete()
                .eq('id', resellerId);

            if (error) throw error;
            alert('Bayi silindi.');
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    // --- APPLICATION HANDLERS ---

    const handleApproveApplication = async (app) => {
        try {
            // Generate unique reseller code
            const city = (app.city || 'GENEL').toUpperCase().replace(/[^A-Z]/g, '');
            const name = app.first_name.toUpperCase().replace(/[^A-Z]/g, '');
            const baseCode = `${city}-${name}`;

            // Check if code exists, add random suffix if needed
            let resellerCode = baseCode;
            const { data: existing } = await supabase.from('resellers').select('code').eq('code', baseCode).single();
            if (existing) {
                resellerCode = `${baseCode}-${Math.floor(Math.random() * 999)}`;
            }

            // Create new reseller
            const { error: resellerError } = await supabase.from('resellers').insert([{
                name: `${app.first_name} ${app.last_name}`,
                code: resellerCode,
                commission_rate: 20,
                tier: 'bronze',
                contact_info: app.phone,
                is_active: true
            }]);

            if (resellerError) throw resellerError;

            // Update application status
            const { error: updateError } = await supabase
                .from('reseller_applications')
                .update({ status: 'approved' })
                .eq('id', app.id);

            if (updateError) throw updateError;

            // Send WhatsApp notification via n8n webhook
            try {
                await fetch('http://localhost:5678/webhook/reseller-approved', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: app.phone,
                        name: app.first_name,
                        code: resellerCode
                    })
                });
            } catch (webhookErr) {
                console.log('WhatsApp notification failed (n8n may be offline):', webhookErr);
            }

            alert(`✅ Başvuru onaylandı! Bayi Kodu: ${resellerCode}\nWhatsApp bildirimi gönderildi.`);
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleRejectApplication = async (appId) => {
        if (!confirm('Bu başvuruyu reddetmek istediğinizden emin misiniz?')) return;

        try {
            const { error } = await supabase
                .from('reseller_applications')
                .update({ status: 'rejected' })
                .eq('id', appId);

            if (error) throw error;
            alert('Başvuru reddedildi.');
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    // NEW: Handle Tenant Request Approval (Business requests from resellers)
    const handleApproveTenantRequest = async (req) => {
        try {
            // Generate slug from business name
            const slug = req.business_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/--+/g, '-');

            // Create new tenant
            const { error: tenantError } = await supabase.from('tenants').insert([{
                name: req.business_name,
                slug: slug,
                reseller_id: req.reseller_id,
                subscription_fee: 1500,
                is_active: true
            }]);

            if (tenantError) throw tenantError;

            // Update request status
            const { error: updateError } = await supabase
                .from('tenant_requests')
                .update({ status: 'approved', reviewed_at: new Date().toISOString() })
                .eq('id', req.id);

            if (updateError) throw updateError;

            alert(`✅ İşletme onaylandı: ${req.business_name}\nSlug: /m/${slug}`);
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const handleRejectTenantRequest = async (reqId) => {
        const reason = prompt('Reddetme sebebini yazın (opsiyonel):');
        try {
            const { error } = await supabase
                .from('tenant_requests')
                .update({
                    status: 'rejected',
                    rejection_reason: reason,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reqId);

            if (error) throw error;
            alert('İşletme başvurusu reddedildi.');
            fetchData();
        } catch (error) {
            alert('Hata: ' + error.message);
        }
    };

    const inputClass = "w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all";

    const btnClass = "w-full bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 font-bold flex items-center justify-center";
    const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    const tdClass = "px-6 py-4 whitespace-nowrap text-sm";

    const SidebarItem = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center w-full p-3 rounded transition-colors mb-2 ${activeTab === id ? 'bg-gray-800 text-blue-400' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
        >
            <Icon className="w-5 h-5 mr-3" />
            <span className="font-medium">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
            <div className={`bg-slate-900 text-white flex flex-col shadow-xl flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
                <div className="p-6 border-b border-gray-800 flex justify-between items-center whitespace-nowrap">
                    <div className="flex items-center">
                        <Briefcase className="w-6 h-6 text-blue-500 mr-2" />
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white">SaaS Admin</h1>
                            <p className="text-xs text-gray-500">Super Yönetici</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarCollapsed(true)} className="p-1 rounded-md hover:bg-slate-800 text-gray-400 hover:text-white transition-colors">
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 overflow-y-auto whitespace-nowrap">
                    <SidebarItem id="tenants" icon={LayoutGrid} label="Restoranlar" />
                    <SidebarItem id="resellers" icon={Users} label="Bayiler (Partners)" />
                    <SidebarItem id="finance" icon={Wallet} label="Finans & Defter" />
                </nav>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {isSidebarCollapsed && (
                    <button onClick={() => setIsSidebarCollapsed(false)} className="absolute top-4 left-4 z-50 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 text-gray-600 border border-gray-200" title="Menüyü Göster">
                        <PanelLeftOpen className="w-5 h-5" />
                    </button>
                )}

                {/* Tenant Config Page - Full Screen Overlay */}
                {selectedTenantForConfig ? (
                    <TenantConfigPage
                        tenantId={selectedTenantForConfig.id}
                        tenantName={selectedTenantForConfig.name}
                        onBack={() => setSelectedTenantForConfig(null)}
                    />
                ) : (
                    <main className="flex-1 overflow-y-auto p-8">
                        <div className="mb-8">
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                                {activeTab === 'tenants' && 'Restoran Yönetimi'}
                                {activeTab === 'resellers' && 'Bayi & Partner Yönetimi'}
                                {activeTab === 'finance' && 'Finansal Genel Bakış'}
                            </h1>
                        </div>

                        {activeTab === 'tenants' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="text-sm text-gray-500">Toplam Restoran</div>
                                        <div className="text-2xl font-bold text-gray-900">{tenants.length}</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="text-sm text-gray-500">Aktif Abonelik</div>
                                        <div className="text-2xl font-bold text-green-600">{tenants.filter(t => t.is_active).length}</div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Building2 className="w-5 h-5 mr-2 text-blue-500" /> Yeni Ekle
                                    </h2>
                                    <form onSubmit={handleAddTenant} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                        <input value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} placeholder="Restoran Adı" required className={inputClass} />
                                        <input value={tenantForm.slug} onChange={e => setTenantForm({ ...tenantForm, slug: e.target.value })} placeholder="Slug" required className={inputClass} />
                                        <select value={tenantForm.city} onChange={e => setTenantForm({ ...tenantForm, city: e.target.value })} className={`${inputClass} bg-white`}>
                                            <option value="">-- Şehir Seçin --</option>
                                            {TURKEY_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                                        </select>
                                        <select value={tenantForm.reseller_id} onChange={e => setTenantForm({ ...tenantForm, reseller_id: e.target.value })} className={`${inputClass} bg-white`}>
                                            <option value="">-- Bayi Seçin (Opsiyonel) --</option>
                                            {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <div className="flex items-center space-x-2">
                                            <input type="number" value={tenantForm.subscription_fee} onChange={e => setTenantForm({ ...tenantForm, subscription_fee: e.target.value })} placeholder="Ücret" className={`${inputClass} w-24`} />
                                            <button type="submit" className={btnClass}>Kaydet</button>
                                        </div>
                                    </form>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className={thClass}>Restoran</th>
                                                <th className={thClass}>Partner</th>
                                                <th className={thClass}>Aylık Ücret</th>
                                                <th className={thClass}>Risk / Şikayet</th>
                                                <th className={thClass}>Durum</th>
                                                <th className={thClass}>İşlemler</th>
                                                <th className={thClass}>Simülasyon</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {tenants.map(t => (
                                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className={`${tdClass} font-medium text-gray-900`}>{t.name}</td>
                                                    <td className={`${tdClass} text-purple-600 font-medium`}>{t.resellers?.name || '-'}</td>
                                                    <td className={`${tdClass} text-gray-900 font-bold`}>{t.subscription_fee} ₺</td>
                                                    <td className={tdClass}>
                                                        {t.active_complaints > 0 ? (
                                                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded border border-red-200 flex items-center w-fit">
                                                                Ref: {t.active_complaints}
                                                            </span>
                                                        ) : (
                                                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded border border-green-200 flex items-center w-fit">
                                                                Temiz 🛡️
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className={tdClass}><Badge active={t.is_active} /></td>
                                                    <td className={tdClass}>
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleEditTenant(t)}
                                                                className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                                                title="Düzenle"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => toggleTenantStatus(t.id, t.is_active)}
                                                                className={`text-sm font-medium underline ${t.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}`}
                                                            >
                                                                {t.is_active ? 'Pasife Al' : 'Aktifleştir'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTenant(t.id, t.name)}
                                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                                title="Sil"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedTenantForConfig(t)}
                                                                className="text-green-500 hover:text-green-700 p-1 hover:bg-green-50 rounded"
                                                                title="N8N / WhatsApp Konfigürasyonu"
                                                            >
                                                                <Settings className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className={tdClass}>
                                                        <button onClick={() => simulatePayment(t)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold hover:bg-green-200 transition-colors">
                                                            Ödeme Al
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {tenants.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pending Business Requests from Resellers */}
                                {tenantRequests.filter(r => r.status === 'pending').length > 0 && (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden border-l-4 border-l-amber-500">
                                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                                            <h3 className="font-bold text-amber-800 flex items-center">
                                                <Building2 className="w-5 h-5 mr-2" />
                                                Bayi İşletme Başvuruları
                                            </h3>
                                            <span className="bg-amber-200 text-amber-800 px-2 py-1 rounded text-xs font-bold">
                                                {tenantRequests.filter(r => r.status === 'pending').length} Yeni
                                            </span>
                                        </div>
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className={thClass}>İşletme</th>
                                                    <th className={thClass}>Sahip</th>
                                                    <th className={thClass}>Telefon</th>
                                                    <th className={thClass}>Bayi</th>
                                                    <th className={thClass}>İşlemler</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {tenantRequests.filter(r => r.status === 'pending').map(req => (
                                                    <tr key={req.id} className="hover:bg-gray-50">
                                                        <td className={`${tdClass} font-medium text-gray-900`}>{req.business_name}</td>
                                                        <td className={tdClass}>{req.owner_name}</td>
                                                        <td className={tdClass}>{req.business_phone}</td>
                                                        <td className={`${tdClass} text-purple-600`}>{req.resellers?.name || '-'}</td>
                                                        <td className={tdClass}>
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => handleApproveTenantRequest(req)} className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center">
                                                                    <Check className="w-3 h-3 mr-1" /> Onayla
                                                                </button>
                                                                <button onClick={() => handleRejectTenantRequest(req.id)} className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center">
                                                                    <X className="w-3 h-3 mr-1" /> Reddet
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}


                        {activeTab === 'resellers' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                                        <h3 className="font-bold text-orange-800 flex items-center">
                                            <Users className="w-5 h-5 mr-2" />
                                            Bekleyen Başvurular
                                        </h3>
                                        <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-bold">{applications.filter(a => a.status === 'pending').length} Yeni</span>
                                    </div>
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className={thClass}>Ad Soyad</th>
                                                <th className={thClass}>Telefon</th>
                                                <th className={thClass}>Şehir</th>
                                                <th className={thClass}>Tarih</th>
                                                <th className={thClass}>Durum</th>
                                                <th className={thClass}>İşlemler</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {applications.map(app => (
                                                <tr key={app.id} className="hover:bg-gray-50">
                                                    <td className={`${tdClass} font-medium`}>{app.first_name} {app.last_name}</td>
                                                    <td className={tdClass}>{app.phone}</td>
                                                    <td className={tdClass}>
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${app.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            app.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                                'bg-red-100 text-red-800'
                                                            }`}>
                                                            {app.status === 'pending' ? 'Bekliyor' : app.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                                                        </span>
                                                    </td>
                                                    <td className={tdClass}>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setViewLog(app)}
                                                                className="text-slate-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md"
                                                                title="Yasal Log Kayıtlarını İncele"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                            {app.status === 'pending' ? (
                                                                <div className="flex space-x-2">
                                                                    <button
                                                                        onClick={() => handleApproveApplication(app)}
                                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center shadow-sm shadow-green-200"
                                                                    >
                                                                        <Check className="w-3 h-3 mr-1" /> Onayla
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRejectApplication(app.id)}
                                                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center shadow-sm shadow-red-200"
                                                                    >
                                                                        <X className="w-3 h-3 mr-1" /> Reddet
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                                    {app.status === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {applications.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-400">Başvuru yok.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 border-l-4 border-l-purple-500">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Users className="w-5 h-5 mr-2 text-purple-500" /> Yeni Bayi Tanımla
                                    </h2>
                                    <form onSubmit={handleAddReseller} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <input value={resellerForm.name} onChange={e => setResellerForm({ ...resellerForm, name: e.target.value })} placeholder="Bayi Adı" required className={inputClass} />
                                        <input value={resellerForm.code} onChange={e => setResellerForm({ ...resellerForm, code: e.target.value })} placeholder="Bayi Kodu" required className={inputClass} />
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">%</span>
                                            <input type="number" value={resellerForm.commission_rate} onChange={e => setResellerForm({ ...resellerForm, commission_rate: e.target.value })} placeholder="Komisyon Oranı" className={`${inputClass} pl-7`} />
                                        </div>
                                        <button type="submit" className="bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors h-full">Bayi Oluştur</button>
                                    </form>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-purple-50">
                                            <tr>
                                                <th className={thClass}>Bayi Adı</th>
                                                <th className={thClass}>Kod</th>
                                                <th className={thClass}>Komisyon (%)</th>
                                                <th className={thClass}>Tier</th>
                                                <th className={thClass}>Durum</th>
                                                <th className={thClass}>İşlemler</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {resellers.map(r => (
                                                <tr key={r.id}>
                                                    <td className={`${tdClass} font-bold text-gray-900`}>{r.name}</td>
                                                    <td className={`${tdClass} font-mono text-xs text-gray-500`}>{r.code}</td>
                                                    <td className={`${tdClass} font-bold text-green-600`}>%{r.commission_rate}</td>
                                                    <td className={tdClass}>
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                                                            r.tier === 'silver' ? 'bg-gray-100 text-gray-800' :
                                                                'bg-orange-100 text-orange-800'
                                                            }`}>
                                                            {r.tier || 'BRONZE'}
                                                        </span>
                                                    </td>
                                                    <td className={tdClass}><Badge active={r.is_active} /></td>
                                                    <td className={tdClass}>
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleEditReseller(r)}
                                                                className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteReseller(r.id, r.name)}
                                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {resellers.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-400">Henüz bayi bulunmuyor.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'finance' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-medium text-green-100">Toplam Ciro (Abonelik)</h3>
                                            <TrendingUp className="w-6 h-6 text-green-200" />
                                        </div>
                                        <p className="text-3xl font-bold">{totalRevenue.toLocaleString('tr-TR')} ₺</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-6 text-white shadow-lg">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-medium text-red-100">Bayi Hak Edişleri (Gider)</h3>
                                            <TrendingDown className="w-6 h-6 text-red-200" />
                                        </div>
                                        <p className="text-3xl font-bold">{totalPayouts.toLocaleString('tr-TR')} ₺</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                        <h2 className="text-lg font-bold text-gray-800 flex items-center">
                                            <Wallet className="w-5 h-5 mr-2 text-green-600" />
                                            Hesap Defteri (Ledger)
                                        </h2>
                                    </div>
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className={thClass}>Tarih</th>
                                                <th className={thClass}>Açıklama</th>
                                                <th className={thClass}>İlgili Kişi</th>
                                                <th className={thClass}>Tip</th>
                                                <th className={thClass}>Tutar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {ledger.map(l => (
                                                <tr key={l.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-xs text-gray-500">{new Date(l.created_at).toLocaleString('tr-TR')}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{l.description}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">{l.tenants?.name || l.resellers?.name || '-'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${l.type === 'subscription_payment' ? 'bg-green-100 text-green-700' : l.type === 'reseller_commission' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                                            {l.type === 'subscription_payment' ? 'Ödeme Alındı' : l.type === 'reseller_commission' ? 'Bayi Hak Edişi' : l.type}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-4 text-sm font-extrabold ${l.direction === 'credit' && l.type === 'subscription_payment' ? 'text-green-600' : 'text-red-500'}`}>
                                                        {l.direction === 'credit' && l.type === 'subscription_payment' ? '+' : '-'}{l.amount} ₺
                                                    </td>
                                                </tr>
                                            ))}
                                            {ledger.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-400">Henüz finansal işlem yok.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </main>
                )}
            </div>

            {/* EDIT TENANT MODAL */}
            {showEditTenantModal && editingTenant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900">Restoran Düzenle</h3>
                            <button onClick={() => setShowEditTenantModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUpdateTenant} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Restoran Adı</label>
                                <input value={editingTenant.name} onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })} className={inputClass} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                                <input value={editingTenant.slug} onChange={e => setEditingTenant({ ...editingTenant, slug: e.target.value })} className={inputClass} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Şehir</label>
                                <select value={editingTenant.city} onChange={e => setEditingTenant({ ...editingTenant, city: e.target.value })} className={`${inputClass} bg-white`}>
                                    <option value="">-- Şehir Seçin --</option>
                                    {TURKEY_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bayi / Partner</label>
                                <select value={editingTenant.reseller_id} onChange={e => setEditingTenant({ ...editingTenant, reseller_id: e.target.value })} className={`${inputClass} bg-white`}>
                                    <option value="">-- Yok --</option>
                                    {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Aylık Ücret (₺)</label>
                                    <input type="number" value={editingTenant.subscription_fee} onChange={e => setEditingTenant({ ...editingTenant, subscription_fee: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                                    <select value={editingTenant.is_active} onChange={e => setEditingTenant({ ...editingTenant, is_active: e.target.value === 'true' })} className={`${inputClass} bg-white`}>
                                        <option value="true">Aktif</option>
                                        <option value="false">Pasif</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowEditTenantModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors">İptal</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/30">Güncelle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT RESELLER MODAL */}
            {showEditResellerModal && editingReseller && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-900">Bayi Düzenle</h3>
                            <button onClick={() => setShowEditResellerModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUpdateReseller} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bayi Adı</label>
                                <input value={editingReseller.name} onChange={e => setEditingReseller({ ...editingReseller, name: e.target.value })} className={inputClass} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bayi Kodu</label>
                                    <input value={editingReseller.code} onChange={e => setEditingReseller({ ...editingReseller, code: e.target.value })} className={inputClass} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Komisyon (%)</label>
                                    <input type="number" value={editingReseller.commission_rate} onChange={e => setEditingReseller({ ...editingReseller, commission_rate: e.target.value })} className={inputClass} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tier (Seviye)</label>
                                    <select value={editingReseller.tier} onChange={e => setEditingReseller({ ...editingReseller, tier: e.target.value })} className={`${inputClass} bg-white`}>
                                        <option value="bronze">Bronze</option>
                                        <option value="silver">Silver</option>
                                        <option value="gold">Gold</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                                    <select value={editingReseller.is_active} onChange={e => setEditingReseller({ ...editingReseller, is_active: e.target.value === 'true' })} className={`${inputClass} bg-white`}>
                                        <option value="true">Aktif</option>
                                        <option value="false">Pasif</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İletişim Bilgisi</label>
                                <textarea value={editingReseller.contact_info} onChange={e => setEditingReseller({ ...editingReseller, contact_info: e.target.value })} className={inputClass} rows="2" />
                            </div>
                            <div className="pt-4 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowEditResellerModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors">İptal</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/30">Güncelle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* LOG VIEWER MODAL */}
            {viewLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 cursor-default">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                <span className="text-xl">🛡️</span>
                                Yasal Kayıt & Onay Logları
                            </h3>
                            <button onClick={() => setViewLog(null)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-lg">
                                    {viewLog.first_name?.[0]}{viewLog.last_name?.[0]}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{viewLog.first_name} {viewLog.last_name}</div>
                                    <div className="text-xs text-gray-500">{viewLog.phone}</div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-xs space-y-3">
                                <div>
                                    <span className="text-slate-500 font-bold block mb-1">IP Adresi (Digital ID):</span>
                                    <span className="bg-white px-2 py-1 rounded border border-gray-200">{viewLog.ip_address || 'Kayıt Yok'}</span>
                                </div>
                                <div className="break-all">
                                    <span className="text-slate-500 font-bold block mb-1">Cihaz İmzası (User Agent):</span>
                                    <span className="bg-white px-2 py-1 rounded border border-gray-200 block">{viewLog.user_agent || 'Bilinmiyor'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold block mb-1">Onay Zaman Damgası:</span>
                                    <span className="bg-white px-2 py-1 rounded border border-gray-200">{new Date(viewLog.created_at).toLocaleString('tr-TR')}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-3 rounded border flex items-center gap-3 ${viewLog.kvkk_approved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className={`w-2 h-2 rounded-full ${viewLog.kvkk_approved ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div>
                                        <div className="font-bold text-sm">KVKK Onayı</div>
                                        <div className="text-[10px] text-gray-500">{viewLog.kvkk_approved ? 'Onaylandı' : 'Onaylanmadı'}</div>
                                    </div>
                                </div>
                                <div className={`p-3 rounded border flex items-center gap-3 ${viewLog.contract_approved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className={`w-2 h-2 rounded-full ${viewLog.contract_approved ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div>
                                        <div className="font-bold text-sm">Bayilik Sözleşmesi</div>
                                        <div className="text-[10px] text-gray-500">{viewLog.contract_approved ? 'Onaylandı' : 'Onaylanmadı'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 text-center text-[10px] text-slate-400 border-t border-slate-100">
                            Bu kayıtlar yasal zorunluluk (5651 Sayılı Kanun) gereği saklanmaktadır ve delil niteliği taşır.
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
