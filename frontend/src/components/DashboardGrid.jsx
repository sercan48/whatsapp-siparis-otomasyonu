import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
    LayoutGrid, UtensilsCrossed, Megaphone, ClipboardList, Users,
    Settings, MessageCircle, CreditCard, Truck, BarChart3,
    ChefHat, Bell, Store, Receipt, UserCog, Package, FileText, Palette,
    Phone, MessageSquare, Monitor, TrendingUp
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const DashboardGrid = () => {
    const { tenantId } = useOutletContext();
    const [stats, setStats] = useState({
        pendingOrders: 0,
        activeCampaigns: 0,
        totalCustomers: 0
    });
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('admin'); // default admin, adjusted by fetch

    useEffect(() => {
        if (!tenantId) return;

        // Quick stat fetch for badges
        const fetchStats = async () => {
            try {
                // 1. Pending Orders (KDS)
                const orders = await supabase
                    .from('orders')
                    .select('id', { count: 'exact' })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'pending');

                // 2. Customers
                const customers = await supabase
                    .from('customers')
                    .select('id', { count: 'exact' });

                setStats({
                    pendingOrders: orders.count || 0,
                    activeCampaigns: 0, // Placeholder
                    totalCustomers: customers.count || 0
                });
            } catch (error) {
                console.error('Stat fetch error', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchUserRole = async () => {
            try {
                // Fetch Profile Role and Tenant
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', tenantId)
                    .single();

                if (profile) setUserRole(profile.role);

            } catch (err) {
                console.error('Role fetch error:', err);
            }
        };

        fetchStats();
        fetchUserRole();
    }, [tenantId]);

    const modules = [
        {
            id: 'kds',
            title: 'Mutfak (KDS)',
            desc: 'Sipariş Yönetimi',
            icon: ChefHat,
            path: '/restore/kds',
            size: 'col-span-1 lg:col-span-2',
            badge: stats.pendingOrders > 0 ? `${stats.pendingOrders} Sipariş` : null // Red badge for attention
        },
        {
            id: 'touch-pos',
            title: 'Sipariş Terminali',
            desc: 'Masa, Paket & Kurye',
            icon: Monitor,
            path: '/restore/touch-pos',
            size: 'col-span-1 lg:col-span-2',
            isNew: true
        },
        {
            id: 'integrations',
            title: 'Ödeme Entegrasyonları',
            desc: 'Yazarkasa & POS',
            icon: CreditCard,
            path: '/restore/settings',
            size: 'col-span-1',
            badge: 'Yakında'
        },
        {
            id: 'menu',
            title: 'Menü Yönetimi',
            desc: 'Ürün & Fiyat',
            icon: UtensilsCrossed,
            path: '/restore/menu',
            size: 'col-span-1',
        },
        {
            id: 'crm',
            title: 'Müşteriler',
            desc: 'CRM & Sadakat',
            icon: Users,
            path: '/restore/customers',
            size: 'col-span-1',
            badge: `${stats.totalCustomers} Kişi`
        },
        {
            id: 'campaigns',
            title: 'Kampanya Yönetimi',
            desc: 'SMS & Özel Teklifler',
            icon: Megaphone,
            path: '/restore/campaigns',
            size: 'col-span-1',
        },
        {
            id: 'orders',
            title: 'Geçmiş',
            desc: 'Arşiv & Rapor',
            icon: ClipboardList,
            path: '/restore/history',
            size: 'col-span-1'
        },
        {
            id: 'courier',
            title: 'Kurye Takip',
            desc: 'Canlı Teslimat',
            icon: Truck,
            path: '/courier', // External courier app
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'courier-manager',
            title: 'Kurye Yönetimi',
            desc: 'Kurye Ekle/Düzenle',
            icon: UserCog,
            path: '/restore/courier-manager',
            size: 'col-span-1'
        },
        {
            id: 'billing',
            title: 'Fatura & Ödeme',
            desc: 'Abonelik Yönetimi',
            icon: Receipt,
            path: '/restore/billing',
            size: 'col-span-1'
        },
        {
            id: 'campaigns',
            title: 'Kampanyalar',
            desc: 'SMS & WhatsApp',
            icon: Megaphone,
            path: '/restore/campaigns',
            size: 'col-span-1'
        },
        {
            id: 'reports',
            title: 'Raporlar',
            desc: 'Ciro & Analiz',
            icon: BarChart3,
            path: '/restore/reports',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'complaints',
            title: 'Şikayetler',
            desc: 'Destek',
            icon: MessageCircle,
            path: '/restore/complaints',
            size: 'col-span-1'
        },
        {
            id: 'accounting',
            title: 'Muhasebe',
            desc: 'Gelir & Gider',
            icon: CreditCard,
            path: '/restore/accounting',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'reservations',
            title: 'Rezervasyonlar',
            desc: 'Masa Ayırtma',
            icon: Bell,
            path: '/restore/reservations',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'inventory',
            title: 'Envanter',
            desc: 'Stok & Hammadde',
            icon: Package,
            path: '/restore/inventory',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'invoices',
            title: 'E-Fatura',
            desc: 'Fatura Yönetimi',
            icon: FileText,
            path: '/restore/invoices',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'branding',
            title: 'Marka Ayarları',
            desc: 'Logo & Renkler',
            icon: Palette,
            path: '/restore/branding',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'settings',
            title: 'Ayarlar',
            desc: 'Yapılandırma & QR',
            icon: Settings,
            path: '/restore/settings',
            size: 'col-span-1'
        },
        {
            id: 'payments',
            title: 'Ödeme Ayarları',
            desc: 'Online Ödeme',
            icon: CreditCard,
            path: '/restore/payments',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'sms',
            title: 'SMS Sistemi',
            desc: 'Netgsm Entegrasyonu',
            icon: MessageSquare,
            path: '/restore/sms-settings',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'caller-id',
            title: 'Caller ID',
            desc: 'Gelen Arama Tanıma',
            icon: Phone,
            path: '/restore/caller-id',
            size: 'col-span-1',
            isNew: true
        },
        {
            id: 'conversion',
            title: 'Platform Dönüşüm',
            desc: 'Trendyol/Getir → WhatsApp',
            icon: TrendingUp,
            path: '/restore/conversion',
            size: 'col-span-1',
            isNew: true
        }
    ];

    // Filter modules based on role
    const filteredModules = modules.filter(m => {
        if (userRole === 'admin') return true; // Admin sees all
        if (userRole === 'cashier') {
            const blocked = ['settings', 'courier', 'invoices', 'branding', 'billing', 'sms'];
            return !blocked.includes(m.id);
        }
        if (userRole === 'waiter') {
            return ['touch-pos', 'menu', 'reservations', 'complaints'].includes(m.id);
        }
        if (userRole === 'kitchen') {
            return ['kds'].includes(m.id);
        }
        if (userRole === 'courier') {
            return ['courier'].includes(m.id);
        }
        return false;
    });

    if (loading) return <div className="p-10 text-center animate-pulse">Sistem hazırlanıyor...</div>;

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10 text-center">
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
                    Restoran İşletim Sistemi
                </h1>
                <p className="text-slate-500">
                    {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredModules.map((m) => (
                    <Link
                        key={m.id}
                        to={m.path}
                        className={`
                            ${m.size} 
                            bg-white
                            border border-blue-100 hover:border-blue-300
                            hover:bg-blue-50/50
                            relative p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg
                            flex flex-col items-center justify-center text-center group
                        `}
                    >
                        {/* Icon Circle */}
                        <div className="mb-4 p-4 rounded-full bg-blue-50 group-hover:bg-white text-blue-600 transition-colors shadow-sm">
                            <m.icon className="w-8 h-8" />
                        </div>

                        {/* Title & Desc */}
                        <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">
                            {m.title}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium">
                            {m.desc}
                        </p>

                        {/* Badges */}
                        {m.isNew && (
                            <span className="absolute top-4 right-4 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                YENİ
                            </span>
                        )}
                        {m.badge && (
                            <span className="absolute top-4 left-4 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                                {m.badge}
                            </span>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
};
