import React, { useState, useEffect, useRef } from 'react';
import {
    QrCode, Download, Palette, Eye, Printer, Copy, Check,
    Smartphone, Utensils, ShoppingCart, Settings, Loader2,
    Type, Image as ImageIcon, LayoutTemplate
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export const QRCodeManager = () => {
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState(null);
    const [tenantSlug, setTenantSlug] = useState(null);
    const [tenantName, setTenantName] = useState('');
    const [tenantLogo, setTenantLogo] = useState(null);
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);

    // Customization State
    const [qrStyle, setQrStyle] = useState({
        color: '#000000',
        bgColor: '#ffffff',
        size: 200,
        includeLogo: true,
        designTemplate: 'modern', // simple, modern, elegant, playful
        customSlogan: 'Afiyet Olsun!',
        customTitle: 'MENÜ',
        showTableNumber: true,
        categoryIcon: 'default' // burger, pizza, coffee, default
    });

    const [previewUrl, setPreviewUrl] = useState('');
    const qrRef = useRef(null);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setTenantId(user.id);

            // Fetch tenant slug & branding
            const { data: profile } = await supabase
                .from('profiles')
                .select('slug, branding, company_name')
                .eq('id', user.id)
                .single();

            if (profile) {
                setTenantSlug(profile.slug);
                setTenantName(profile.company_name || 'Restoran');
                if (profile.branding?.logo_url) {
                    setTenantLogo(profile.branding.logo_url);
                }
            }

            loadTables(user.id);
        }
        setLoading(false);
    };

    const loadTables = async (tenantId) => {
        try {
            const { data, error } = await supabase
                .from('restaurant_tables')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('table_number');

            if (error) throw error;

            setTables(data || []);
            if (data && data.length > 0) {
                setSelectedTable(data[0]);
            }
        } catch (error) {
            // Tables not found, showing create option
            setTables([]);
        }
    };

    const createTables = async (count = 10) => {
        if (!tenantId) return;

        try {
            const tablesToInsert = [];
            for (let i = 1; i <= count; i++) {
                tablesToInsert.push({
                    tenant_id: tenantId,
                    table_number: i,
                    name: `Masa ${i}`,
                    capacity: 4,
                    status: 'available'
                });
            }

            const { data, error } = await supabase
                .from('restaurant_tables')
                .upsert(tablesToInsert, { onConflict: 'tenant_id,table_number' })
                .select();

            if (error) throw error;

            setTables(data || []);
            if (data && data.length > 0) {
                setSelectedTable(data[0]);
            }
            toast.success(`${count} masa oluşturuldu!`);
        } catch (error) {
            console.error('Create tables error:', error);
            toast.error('Masalar oluşturulamadı: ' + error.message);
        }
    };

    const generateQRUrl = (table) => {
        const baseUrl = window.location.origin;
        if (tenantSlug) {
            return `${baseUrl}/m/${tenantSlug}?table=${table?.table_number || table?.id}`;
        }
        return `${baseUrl}/menu/${tenantId}?table=${table?.table_number || table?.id}`;
    };

    const generateQRCode = async () => {
        if (!selectedTable) return;
        const url = generateQRUrl(selectedTable);
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrStyle.size}x${qrStyle.size}&data=${encodeURIComponent(url)}&color=${qrStyle.color.replace('#', '')}&bgcolor=${qrStyle.bgColor.replace('#', '')}&margin=0`;
        setPreviewUrl(qrApiUrl);
    };

    useEffect(() => {
        if (selectedTable && tenantId) {
            generateQRCode();
        }
    }, [selectedTable, qrStyle.color, qrStyle.bgColor, tenantId]);

    // SECURITY: XSS Prevention - HTML escape utility
    const escapeHtml = (text) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    };

    const getDesignHTML = (table, qrSrc, isPrint = false) => {
        // SECURITY: Escape all user-controlled inputs to prevent XSS
        const safeTitle = escapeHtml(qrStyle.customTitle);
        const safeSlogan = escapeHtml(qrStyle.customSlogan);
        const safeTenantName = escapeHtml(tenantName);
        const safeTableNumber = escapeHtml(table?.table_number || '');

        // Validate logo URL (must be https or data URL)
        const safeLogoUrl = tenantLogo && (tenantLogo.startsWith('https://') || tenantLogo.startsWith('data:image/'))
            ? tenantLogo
            : '';

        const logoHtml = (qrStyle.includeLogo && safeLogoUrl)
            ? `<img src="${safeLogoUrl}" class="logo" alt="Logo" />`
            : '';

        const categoryIconHtml = () => {
            switch (qrStyle.categoryIcon) {
                case 'burger': return '🍔';
                case 'pizza': return '🍕';
                case 'coffee': return '☕';
                default: return '🍽️';
            }
        };

        const commonStyles = `
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            text-align: center;
            page-break-inside: avoid;
        `;

        if (qrStyle.designTemplate === 'simple') {
            return `
                <div class="card simple" style="${commonStyles} border: 2px solid #eee; padding: 20px; border-radius: 12px; width: 300px; margin: auto;">
                    ${logoHtml}
                    <h2 style="margin: 10px 0; color: #333;">${safeTitle}</h2>
                    <img src="${qrSrc}" style="width: 200px; height: 200px; margin: 10px auto; display: block;" />
                    ${qrStyle.showTableNumber ? `<div style="font-size: 1.5rem; font-weight: bold; margin: 10px 0;">Masa ${safeTableNumber}</div>` : ''}
                    <p style="color: #666; font-size: 0.9rem;">${safeSlogan}</p>
                </div>
            `;
        }

        if (qrStyle.designTemplate === 'modern') {
            return `
                <div class="card modern" style="${commonStyles} background: #1e293b; color: white; padding: 30px; border-radius: 20px; width: 300px; margin: auto; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                    ${safeLogoUrl ? `<div style="background: white; padding: 10px; border-radius: 12px; display: inline-block; margin-bottom: 15px;"><img src="${safeLogoUrl}" style="height: 40px;" /></div>` : ''}
                    <h2 style="margin: 0 0 15px 0; letter-spacing: 2px; text-transform: uppercase; font-size: 1.2rem;">${safeTitle}</h2>
                    <div style="background: white; padding: 10px; border-radius: 10px; display: inline-block;">
                        <img src="${qrSrc}" style="width: 180px; height: 180px; display: block;" />
                    </div>
                    ${qrStyle.showTableNumber ? `<div style="font-size: 2rem; font-weight: 800; margin: 15px 0; color: #60a5fa;">${safeTableNumber}</div>` : ''}
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0.8;">
                        <span>${categoryIconHtml()}</span>
                        <span style="font-size: 0.9rem;">${safeSlogan}</span>
                    </div>
                </div>
            `;
        }

        if (qrStyle.designTemplate === 'elegant') {
            return `
                <div class="card elegant" style="${commonStyles} border: 1px solid #d4d4d4; padding: 40px 20px; width: 280px; margin: auto; background: #fffcf5;">
                    <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                        ${logoHtml}
                        <h2 style="margin: 5px 0; font-family: 'Playfair Display', serif; font-size: 1.5rem;">${safeTenantName}</h2>
                    </div>
                    <p style="letter-spacing: 3px; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 20px;">${safeTitle}</p>
                    <img src="${qrSrc}" style="width: 180px; height: 180px; margin: 0 auto; display: block;" />
                    ${qrStyle.showTableNumber ? `<div style="font-family: 'Playfair Display', serif; font-size: 1.8rem; margin: 20px 0 10px 0;">No. ${safeTableNumber}</div>` : ''}
                    <p style="font-style: italic; color: #555; font-size: 0.9rem;">${safeSlogan}</p>
                </div>
            `;
        }

        return '';
    };

    const printQR = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>QR Kod Yazdır</title>
                    <style>
                        body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
                        .logo { max-height: 50px; max-width: 150px; object-fit: contain; }
                        @media print {
                            body { background: white; -webkit-print-color-adjust: exact; }
                        }
                    </style>
                    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
                </head>
                <body>
                    ${getDesignHTML(selectedTable, previewUrl, true)}
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const printAllQRs = () => {
        const printWindow = window.open('', '_blank');
        let content = `
            <html>
                <head>
                    <title>Tüm QR Kodlar</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
                        .logo { max-height: 50px; max-width: 150px; object-fit: contain; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                            .grid { grid-template-columns: repeat(2, 1fr); }
                            .card { page-break-inside: avoid; margin-bottom: 20px; }
                        }
                    </style>
                    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
                </head>
                <body>
                    <div class="grid">
        `;

        tables.forEach(table => {
            const url = generateQRUrl(table);
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}&color=${qrStyle.color.replace('#', '')}&bgcolor=${qrStyle.bgColor.replace('#', '')}&margin=0`;
            content += getDesignHTML(table, qrSrc, true);
        });

        content += `</div></body></html>`;
        printWindow.document.write(content);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 1000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
                        <QrCode className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">QR Menü Oluşturucu</h1>
                        <p className="text-slate-500">Masalarınız için profesyonel QR tasarımları oluşturun</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={printAllQRs}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-md transition-all active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        Tümünü Yazdır
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
                {/* Left Sidebar: Controls */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Design Templates */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-indigo-500" />
                            Tasarım Şablonu
                        </h2>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'simple', name: 'Sade', color: 'bg-gray-100' },
                                { id: 'modern', name: 'Modern', color: 'bg-slate-800 text-white' },
                                { id: 'elegant', name: 'Şık', color: 'bg-orange-50' }
                            ].map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => setQrStyle({ ...qrStyle, designTemplate: template.id })}
                                    className={`p-3 rounded-xl text-sm font-medium transition-all ${qrStyle.designTemplate === template.id
                                        ? 'ring-2 ring-indigo-500 transform scale-105'
                                        : 'hover:bg-gray-50'
                                        } ${template.color}`}
                                >
                                    {template.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Customization Options */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-pink-500" />
                            Özelleştirme
                        </h2>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Başlık</label>
                            <div className="relative">
                                <Type className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    value={qrStyle.customTitle}
                                    onChange={(e) => setQrStyle({ ...qrStyle, customTitle: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Örn: MENÜ"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Slogan</label>
                            <input
                                type="text"
                                value={qrStyle.customSlogan}
                                onChange={(e) => setQrStyle({ ...qrStyle, customSlogan: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="Örn: Lezzetin adresi..."
                            />
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg flex-1">
                                <input
                                    type="checkbox"
                                    checked={qrStyle.includeLogo}
                                    onChange={(e) => setQrStyle({ ...qrStyle, includeLogo: e.target.checked })}
                                    className="w-4 h-4 rounded text-indigo-600"
                                />
                                <span className="text-sm font-medium text-slate-700">Logo Göster</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg flex-1">
                                <input
                                    type="checkbox"
                                    checked={qrStyle.showTableNumber}
                                    onChange={(e) => setQrStyle({ ...qrStyle, showTableNumber: e.target.checked })}
                                    className="w-4 h-4 rounded text-indigo-600"
                                />
                                <span className="text-sm font-medium text-slate-700">Masa No</span>
                            </label>
                        </div>
                    </div>

                    {/* Table Selection */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm max-h-96 overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Utensils className="w-5 h-5 text-orange-500" />
                                Masalar
                            </h2>
                            <button
                                onClick={() => createTables(5)}
                                className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                            >
                                +5 Ekle
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {tables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => setSelectedTable(table)}
                                    className={`p-2 rounded-lg text-center transition-all ${selectedTable?.id === table.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <span className="block text-sm font-bold">{table.table_number}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Area: Preview */}
                <div className="lg:col-span-8">
                    <div className="bg-slate-100 rounded-3xl p-8 border border-slate-200 flex flex-col items-center justify-center min-h-[600px] relative">
                        <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm font-medium text-slate-500">
                            <Eye className="w-4 h-4" />
                            Canlı Önizleme
                        </div>

                        {/* Dynamic HTML Preview Render */}
                        <div dangerouslySetInnerHTML={{ __html: getDesignHTML(selectedTable, previewUrl) }} />

                        <div className="mt-8 flex gap-3">
                            <button onClick={printQR} className="px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 flex items-center gap-2 font-medium">
                                <Printer className="w-5 h-5" />
                                Bu Masayı Yazdır
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QRCodeManager;
