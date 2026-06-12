import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Save, Store, Palette, MessageSquare, Power, Clock, Truck, Shield, Gift, Users, FileText, Cloud, Printer, Monitor, Package, ArrowLeft } from 'lucide-react';
import { DEMO_TENANT_ID } from '../lib/constants';
import { InventorySettings } from './InventorySettings';
import { HardwareSettings } from './HardwareSettings';
import toast from 'react-hot-toast';

import { AdminUserList } from './AdminUserList'; // NEW
import { PinPad } from './PinPad'; // NEW (for setting PIN)

export const Settings = ({ tenantId = DEMO_TENANT_ID }) => { // eslint-disable-line no-unused-vars
    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [devices, setDevices] = useState([]); // Devices State
    const [invitations, setInvitations] = useState([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'waiter' });
    const [settings, setSettings] = useState({
        name: '',
        is_active: true,
        logo_url: '',
        theme_config: { primary: '#2563eb', font: 'Inter' },
        ai_config: { tone: 'friendly', rules: '' },
        store_config: {
            opening_time: '09:00',
            closing_time: '23:00',
            min_basket: 0,
            delivery_fee: 0,
            free_delivery_threshold: 0
        },
        compensation_settings: {
            monthly_budget: 500,
            current_spend: 0,
            require_proof_score_threshold: 40,
            product_compensation_enabled: true,
            gift_product_id: null
        },
        legal_info: {
            company_title: '',
            tax_id: '',
            tax_office: '',
            mersis_no: '',
            is_efatura_user: false
        },
        integration_config: {
            provider: 'manual',
            api_key: '',
            api_secret: '',
            distributor_code: '',
            is_active: false
        }
    });

    useEffect(() => {
        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase.from('tenants').select('*').eq('id', user.id).maybeSingle();

            if (error) {
                console.error('Error fetching tenant:', error);
                setLoading(false);
                return;
            }

            if (data) {
                // Fetch Menu Items (Unused for now, commented out)
                // const menuRes = await supabase.from('menu_items').select('id, name, price').eq('tenant_id', data.id);
                // setMenuItems(menuRes.data || []);

                // Fetch Legal Info (use maybeSingle to avoid error when no data)
                const legalRes = await supabase.from('tenant_legal_info').select('*').eq('tenant_id', data.id).maybeSingle();

                // Fetch Integration Config (use maybeSingle to avoid error when no data)
                const integrationRes = await supabase.from('integration_configs').select('*').eq('tenant_id', data.id).maybeSingle();

                setSettings({
                    id: data.id,
                    name: data.name,
                    is_active: data.is_active,
                    logo_url: data.logo_url || '',
                    theme_config: data.theme_config || { primary: '#2563eb', font: 'Inter' },
                    ai_config: data.ai_config || { tone: 'friendly', rules: '' },
                    store_config: data.store_config || {
                        opening_time: '09:00',
                        closing_time: '23:00',
                        min_basket: 0,
                        delivery_fee: 0,
                        free_delivery_threshold: 0
                    },

                    compensation_settings: data.compensation_settings || {
                        monthly_budget: 500,
                        current_spend: 0,
                        require_proof_score_threshold: 40,
                        product_compensation_enabled: true,
                        gift_product_id: null
                    },
                    legal_info: legalRes?.data || { company_title: '', tax_id: '', tax_office: '', is_efatura_user: false },
                    integration_config: integrationRes?.data || { provider: 'manual', api_key: '', is_active: false }
                });

                fetchStaff(data.id);
                fetchDevices(data.id);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Ayarlar yüklenirken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const fetchDevices = async (tenantId) => {
        try {
            const { data } = await supabase.from('devices').select('*').eq('tenant_id', tenantId);
            setDevices(data || []);
        } catch (error) {
            console.error('Devices fetch error:', error);
        }
    };

    const handleAddDevice = async () => { // eslint-disable-line no-unused-vars
        const name = prompt('Cihaz Adı (Örn: Mutfak Yazıcısı):');
        if (!name) return;

        try {
            const { data, error } = await supabase
                .from('devices')
                .insert([{
                    tenant_id: settings.id,
                    name,
                    type: 'printer', // Default
                    settings: { paper_width: '80mm' }
                }])
                .select()
                .single();

            if (error) throw error;
            setDevices([...devices, data]);
            toast.success('Cihaz eklendi.');
        } catch (error) { // eslint-disable-line no-unused-vars
            toast.error('Cihaz eklenemedi.');
        }
    };

    const handleDeleteDevice = async (id) => { // eslint-disable-line no-unused-vars
        if (!window.confirm('Bu cihazı silmek istediğinize emin misiniz?')) return;
        try {
            await supabase.from('devices').delete().eq('id', id);
            setDevices(devices.filter(d => d.id !== id));
            toast.success('Cihaz silindi.');
        } catch (error) { // eslint-disable-line no-unused-vars
            toast.error('Silinemedi.');
        }
    };

    const fetchStaff = async (tenantId) => {
        try {
            // Fetch active staff
            const { data, error } = await supabase.from('profiles').select('*').eq('tenant_id', tenantId);
            if (!error) setStaffList(data || []);

            // Fetch pending invitations
            const { data: invData } = await supabase.from('tenant_invitations').select('*').eq('tenant_id', tenantId).eq('status', 'pending');
            setInvitations(invData || []);
        } catch (error) {
            console.warn('Staff fetch error:', error.message);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase.rpc('add_staff_or_courier', {
                p_email: inviteForm.email,
                p_role: inviteForm.role,
                p_tenant_id: settings.id
            });

            if (error) throw error;

            toast.success(data.message || 'İşlem başarılı.');
            setShowInviteModal(false);
            setInviteForm({ email: '', role: 'waiter' });
            fetchStaff(settings.id);

        } catch (error) {
            console.error(error);
            toast.error('Davet gönderilemedi: ' + error.message);
        }
    };

    const updateStaffRole = async (userId, newRole) => {
        try {
            await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            setStaffList(prev => prev.map(s => s.id === userId ? { ...s, role: newRole } : s));
            toast.success('Rol güncellendi.');
        } catch (error) {
            toast.error('Rol güncellenemedi.');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // 1. Save Main Settings
            await supabase.from('tenants').update({
                name: settings.name,
                is_active: settings.is_active,
                logo_url: settings.logo_url,
                theme_config: settings.theme_config,
                ai_config: { ...settings.ai_config, store_rules: settings.store_config },
                compensation_settings: settings.compensation_settings
            }).eq('id', settings.id);

            // 2. Save Legal Info (Upsert)
            const { error: legalError } = await supabase.from('tenant_legal_info').upsert({
                tenant_id: settings.id,
                ...settings.legal_info
            });
            if (legalError) throw legalError;

            // 3. Save Integration Config (Upsert)
            const { error: intError } = await supabase.from('integration_configs').upsert({
                tenant_id: settings.id,
                ...settings.integration_config
            });
            if (intError) throw intError; // eslint-disable-line no-unused-vars

            toast.success('Ayarlar ve Entegrasyon bilgileri kaydedildi! 🎉');
        } catch (error) {
            toast.error('Hata: ' + error.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

    return (
        <div className="flex-1 p-8 overflow-y-auto h-full bg-gray-50 pb-24">
            <div className="flex items-center gap-4 mb-2">
                <button onClick={() => window.location.href = '/restore'} className="p-2 bg-white text-gray-600 rounded-lg hover:bg-gray-100 border transition-colors shadow-sm">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">Mağaza Ayarları</h1>
            </div>
            <p className="text-gray-500 mb-8 ml-14">Restoran operasyonel kuralları, teslimat ve resmi bilgiler.</p>

            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">

                {/* General Settings */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center mb-6 text-gray-800">
                        <Store className="w-5 h-5 mr-2 text-blue-600" />
                        <h2 className="text-lg font-bold">Genel Bilgiler</h2>
                    </div>
                    {/* ... (Keep existing inputs: Name, Logo, Active Toggle) ... */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Restoran Adı</label>
                            <input value={settings.name} onChange={e => setSettings({ ...settings, name: e.target.value })} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                            <input value={settings.logo_url} onChange={e => setSettings({ ...settings, logo_url: e.target.value })} className="w-full border p-2 rounded" />
                        </div>
                        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                            <div className="flex items-center">
                                <Power className={`w-5 h-5 mr-3 ${settings.is_active ? 'text-green-500' : 'text-red-500'}`} />
                                <span className="font-medium text-gray-800">Mağaza Durumu</span>
                            </div>
                            <input type="checkbox" checked={settings.is_active} onChange={e => setSettings({ ...settings, is_active: e.target.checked })} className="w-6 h-6 accent-green-600" />
                        </div>
                    </div>
                </div>

                {/* LEGAL INFO (NEW) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200 lg:col-span-2">
                    <div className="flex items-center mb-6 text-gray-800">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        <h2 className="text-lg font-bold">Resmi Firma Bilgileri (Adisyon & Fatura)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Resmi Firma Ünvanı</label>
                            <input
                                value={settings.legal_info.company_title || ''}
                                onChange={e => setSettings({ ...settings, legal_info: { ...settings.legal_info, company_title: e.target.value } })}
                                placeholder="Örn: Lezzet Gıda A.Ş."
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Kimlik No (VKN)</label>
                                <input
                                    value={settings.legal_info.tax_id || ''}
                                    onChange={e => setSettings({ ...settings, legal_info: { ...settings.legal_info, tax_id: e.target.value } })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Dairesi</label>
                                <input
                                    value={settings.legal_info.tax_office || ''}
                                    onChange={e => setSettings({ ...settings, legal_info: { ...settings.legal_info, tax_office: e.target.value } })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5"
                                />
                            </div>
                        </div>
                        <div className="flex items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <input
                                type="checkbox"
                                checked={settings.legal_info.is_efatura_user}
                                onChange={e => setSettings({ ...settings, legal_info: { ...settings.legal_info, is_efatura_user: e.target.checked } })}
                                className="w-5 h-5 accent-blue-600 mr-3"
                            />
                            <span className="text-sm font-medium text-blue-900">E-Fatura Mükellefiyim</span>
                        </div>
                    </div>
                </div>

                {/* INTEGRATION CONFIG (NEW) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-200 lg:col-span-2">
                    <div className="flex items-center mb-6 text-gray-800">
                        <Cloud className="w-5 h-5 mr-2 text-indigo-600" />
                        <h2 className="text-lg font-bold">Entegrasyonlar (E-Fatura & Yazarkasa & Pazaryeri)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Entegratör / Platform Seçimi</label>
                            <select
                                value={settings.integration_config.provider}
                                onChange={e => setSettings({ ...settings, integration_config: { ...settings.integration_config, provider: e.target.value } })}
                                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white"
                            >
                                <optgroup label="E-Dönüşüm">
                                    <option value="manual">Entegrasyon Yok (Manuel)</option>
                                    <option value="parasut">Paraşüt</option>
                                    <option value="bizimhesap">BizimHesap</option>
                                    <option value="izibiz">İzibiz (Özel)</option>
                                    <option value="qnb">QNB eFinans</option>
                                </optgroup>
                                <optgroup label="Yazarkasa POS">
                                    <option value="beko">Beko X30 TR (Token GMP3)</option>
                                    <option value="ingenico">Ingenico (iDE280, iWE280)</option>
                                    <option value="hugin">Hugin (Tiger, VX)</option>
                                    <option value="profilo">Profilo S900</option>
                                    <option value="pax">PAX Android POS</option>
                                </optgroup>
                                <optgroup label="Yemek Platformları">
                                    <option value="yemeksepeti">Yemeksepeti</option>
                                    <option value="getir">GetirYemek</option>
                                    <option value="trendyol">Trendyol Yemek</option>
                                    <option value="migros">Migros Yemek</option>
                                </optgroup>
                            </select>
                        </div>
                        {settings.integration_config.provider !== 'manual' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Kullanıcı Adı</label>
                                    <input
                                        value={settings.integration_config.api_key || ''}
                                        onChange={e => setSettings({ ...settings, integration_config: { ...settings.integration_config, api_key: e.target.value } })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                        type="password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Secret / Şifre</label>
                                    <input
                                        value={settings.integration_config.api_secret || ''}
                                        onChange={e => setSettings({ ...settings, integration_config: { ...settings.integration_config, api_secret: e.target.value } })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5"
                                        type="password"
                                    />
                                </div>
                                <div className="flex items-center pt-6">
                                    <button type="button" className="text-indigo-600 font-bold text-sm hover:underline">Bağlantıyı Test Et</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Keep existing sections below... (Staff, etc) */}
                {/* INVENTORY MANAGEMENT (NEW) */}
                <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-orange-100">
                    <div className="flex items-center mb-6 text-gray-800">
                        <Package className="w-6 h-6 mr-2 text-orange-600" />
                        <h2 className="text-xl font-bold">Stok & Reçete Yönetimi</h2>
                    </div>
                    {settings.id && <InventorySettings tenantId={settings.id} />}
                </div>

                {/* HARDWARE MANAGEMENT */}
                <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-purple-100">
                    <HardwareSettings
                        tenantId={settings.id}
                        devices={devices}
                        onChange={setDevices}
                    />
                </div>

                {/* Staff Management */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex items-center mb-6 text-gray-800">
                        <Users className="w-5 h-5 mr-2 text-indigo-600" />
                        <h2 className="text-lg font-bold">Personel Yönetimi</h2>
                    </div>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="mb-4 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 flex items-center gap-2"
                    >
                        <Users className="w-4 h-4" /> Personel Ekle / Davet Et
                    </button>
                    {/* ... Simplified table for brevity in this task update ... */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Rol</th>
                                    <th className="px-6 py-3">Kayıt Tarihi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffList.map(staff => (
                                    <tr key={staff.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4">{staff.email}</td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={staff.role || 'waiter'}
                                                onChange={(e) => updateStaffRole(staff.id, e.target.value)}
                                                className="bg-gray-50 border border-gray-300 rounded-lg p-1"
                                            >
                                                <option value="waiter">Garson</option>
                                                <option value="cashier">Kasa</option>
                                                <option value="admin">Yönetici</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">{new Date(staff.created_at).toLocaleDateString("tr-TR")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pending Invitations */}
                        {invitations.length > 0 && (
                            <div className="mt-6 border-t pt-4">
                                <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Bekleyen Davetler</h3>
                                <div className="space-y-2">
                                    {invitations.map(inv => (
                                        <div key={inv.id} className="flex justify-between items-center bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                            <div>
                                                <p className="font-medium text-gray-800">{inv.email}</p>
                                                <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded capitalize">{inv.role} (Bekliyor)</span>
                                            </div>
                                            <button className="text-xs text-red-500 hover:underline">İptal Et</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ADMIN USER MANAGEMENT (Role Switching) */}
                <div className="lg:col-span-2">
                    <AdminUserList />
                </div>

                {/* PIN Setting Section (Simplified for now - could be in Profile) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 mt-6">
                    <div className="flex items-center mb-6 text-gray-800">
                        <Shield className="w-5 h-5 mr-2 text-red-600" />
                        <h2 className="text-lg font-bold">Güvenlik & PIN</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        Terminal kilidi için kullanılacak 4-6 haneli PIN kodunuzu buradan belirleyebilirsiniz.
                        Bu PIN kodu "Kilitli Ekran"ı açmak için kullanılacaktır.
                    </p>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                const newPin = prompt("Yeni PIN Kodunuzu Girin (4-6 hane):");
                                if (newPin && newPin.length >= 4) {
                                    // Direct update for quick prototype
                                    supabase.auth.getUser().then(({ data: { user } }) => {
                                        if (user) {
                                            supabase.from('profiles').update({ pin_code: newPin }).eq('id', user.id)
                                                .then(({ error }) => {
                                                    if (error) toast.error("PIN güncellenemedi");
                                                    else toast.success("PIN başarıyla güncellendi");
                                                });
                                        }
                                    });
                                } else if (newPin) {
                                    toast.error("PIN en az 4 hane olmalı");
                                }
                            }}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 transition"
                        >
                            PIN Kodunu Güncelle
                        </button>
                    </div>
                </div>

                {/* Invite Modal */}
                {showInviteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-xl font-bold mb-4">Personel Ekle / Davet Et</h3>
                            <form onSubmit={handleInvite}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-1">E-Posta Adresi</label>
                                    <input
                                        type="email"
                                        required
                                        value={inviteForm.email}
                                        onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                        className="w-full border p-2 rounded-lg"
                                        placeholder="ornek@email.com"
                                    />
                                </div>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium mb-1">Rol</label>
                                    <select
                                        value={inviteForm.role}
                                        onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                                        className="w-full border p-2 rounded-lg"
                                    >
                                        <option value="waiter">Garson</option>
                                        <option value="vis_waiter">Görsel Garson (Sadece Sipariş)</option>
                                        <option value="kitchen">Mutfak</option>
                                        <option value="cashier">Kasa</option>
                                        <option value="admin">Yönetici</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowInviteModal(false)}
                                        className="flex-1 py-2 bg-gray-100 rounded-lg text-gray-700"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                                    >
                                        Davet Gönder
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* QR Codes Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center text-gray-800">
                            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m6-8h.01M4 8h2m6 8h.01" />
                            </svg>
                            <h2 className="text-lg font-bold">QR Kod Yönetimi</h2>
                        </div>
                        <a
                            href="/restore/qr-codes"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-all"
                        >
                            QR Kodları Yönet →
                        </a>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Masa QR kodlarını oluşturun, özelleştirin ve yazdırın. Her masa için benzersiz QR kodları ile müşterileriniz menüye kolayca erişebilir.
                    </p>
                    <div className="mt-4 grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(num => (
                            <div key={num} className="bg-gray-50 p-3 rounded-lg text-center border border-dashed border-gray-300">
                                <div className="w-12 h-12 mx-auto mb-2 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">QR</div>
                                <p className="text-xs text-gray-500">Masa {num}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center transform active:scale-95 transition-all"
                    >
                        <Save className="w-6 h-6 mr-2" />
                        Tüm Ayarları Kaydet
                    </button>
                </div>
            </form>
        </div>
    );
};
