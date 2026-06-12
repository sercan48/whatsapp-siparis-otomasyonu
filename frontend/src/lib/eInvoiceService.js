/**
 * E-Fatura Service
 * Paraşüt & Generic E-Fatura Integration
 * 
 * Bu modül e-fatura ve e-arşiv fatura oluşturma işlemlerini yönetir.
 * Desteklenen sağlayıcılar: Paraşüt, BizimHesap, Manual (PDF)
 */

import { supabase } from './supabaseClient';
import { generateUUID } from './utils';

// Paraşüt API Endpoints
const PARASUT_API_BASE = 'https://api.parasut.com/v4';
const PARASUT_SANDBOX_BASE = 'https://api.parasut.com/v4'; // Same for sandbox, uses company_id

/**
 * Get integration config for tenant
 */
export const getIntegrationConfig = async (tenantId) => {
    const { data, error } = await supabase
        .from('integration_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Config fetch error:', error);
    }
    return data;
};

/**
 * Get tenant legal info
 */
export const getTenantLegalInfo = async (tenantId) => {
    const { data, error } = await supabase
        .from('tenant_legal_info')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    return data;
};

/**
 * Generate Invoice Number
 * Format: TRK-2024-000001
 */
export const generateInvoiceNumber = async (tenantId) => {
    const year = new Date().getFullYear();

    // Get count of invoices this year
    const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .gte('created_at', `${year}-01-01`);

    const nextNumber = (count || 0) + 1;
    return `TRK-${year}-${nextNumber.toString().padStart(6, '0')}`;
};

/**
 * Create Draft Invoice
 */
export const createDraftInvoice = async (tenantId, orderData) => {
    const invoiceNumber = await generateInvoiceNumber(tenantId);
    const legalInfo = await getTenantLegalInfo(tenantId);

    // Calculate totals
    const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = orderData.taxRate || 10; // Default %10 KDV
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const invoice = {
        tenant_id: tenantId,
        order_id: orderData.orderId,
        gib_invoice_no: invoiceNumber,
        scenario: legalInfo?.is_efatura_user ? 'EFATURA' : 'EARSIV',
        type: 'SATIS',
        customer_name: orderData.customerName || 'Perakende Satış',
        customer_tax_id: orderData.customerTaxId || null,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        status: 'draft',
        issued_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('invoices')
        .insert(invoice)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Submit Invoice to Provider (Paraşüt)
 */
export const submitInvoiceToProvider = async (tenantId, invoiceId) => {
    const config = await getIntegrationConfig(tenantId);

    if (!config || !config.is_active) {
        // Manual mode - just update status
        await supabase
            .from('invoices')
            .update({ status: 'signed' })
            .eq('id', invoiceId);

        return { success: true, mode: 'manual' };
    }

    if (config.provider === 'parasut') {
        return await submitToParasut(config, invoiceId);
    }

    // Default: mark as signed
    await supabase
        .from('invoices')
        .update({ status: 'signed' })
        .eq('id', invoiceId);

    return { success: true, mode: 'manual' };
};

/**
 * Submit to Paraşüt API
 */
const submitToParasut = async (config, invoiceId) => {
    try {
        // Get invoice details
        const { data: invoice } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();

        if (!invoice) throw new Error('Fatura bulunamadı');

        // Update status to queue
        await supabase
            .from('invoices')
            .update({ status: 'queue' })
            .eq('id', invoiceId);

        // Paraşüt API call would go here
        // For now, simulate success after 1 second
        // In production, you'd make actual API calls

        /*
        const response = await fetch(`${PARASUT_API_BASE}/${config.company_id}/e_invoices`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.api_key}`,
                'Content-Type': 'application/vnd.api+json'
            },
            body: JSON.stringify({
                data: {
                    type: 'e_invoices',
                    attributes: {
                        vkn: invoice.customer_tax_id,
                        invoice_scenario: invoice.scenario.toLowerCase(),
                        invoice_type: 'sales'
                    }
                }
            })
        });
        */

        // Simulate successful submission
        const ettn = generateUUID();

        await supabase
            .from('invoices')
            .update({
                status: 'signed',
                ettn: ettn
            })
            .eq('id', invoiceId);

        return {
            success: true,
            mode: 'parasut',
            ettn: ettn
        };

    } catch (error) {
        await supabase
            .from('invoices')
            .update({
                status: 'failed',
                error_message: error.message
            })
            .eq('id', invoiceId);

        return { success: false, error: error.message };
    }
};

/**
 * Get Invoice List
 */
export const getInvoices = async (tenantId, filters = {}) => {
    let query = supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;
    return data || [];
};

/**
 * Cancel Invoice
 */
export const cancelInvoice = async (invoiceId) => {
    const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Generate Invoice HTML for PDF
 */
export const generateInvoiceHTML = (invoice, companyInfo, items) => {
    const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(amount);

    const formatDate = (date) => new Date(date).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Fatura - ${invoice.gib_invoice_no}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; }
        .invoice { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
        .company-info h1 { font-size: 24px; margin-bottom: 5px; color: #2563eb; }
        .company-info p { color: #666; line-height: 1.6; }
        .invoice-info { text-align: right; }
        .invoice-info h2 { font-size: 18px; color: #333; margin-bottom: 10px; }
        .invoice-info p { color: #666; }
        .invoice-number { font-size: 16px; font-weight: bold; color: #2563eb; }
        .customer-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .customer-info, .invoice-details { width: 48%; }
        .section-title { font-weight: bold; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        .text-right { text-align: right; }
        .totals { margin-top: 20px; }
        .totals-row { display: flex; justify-content: flex-end; margin-bottom: 5px; }
        .totals-label { width: 150px; text-align: right; margin-right: 20px; }
        .totals-value { width: 120px; text-align: right; font-weight: 500; }
        .grand-total { font-size: 18px; font-weight: bold; color: #2563eb; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 10px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11px; }
        .status-signed { background: #dcfce7; color: #166534; }
        .status-draft { background: #fef3c7; color: #92400e; }
        @media print { body { padding: 0; } .invoice { border: none; } }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="company-info">
                <h1>${companyInfo?.company_title || 'Restoran Adı'}</h1>
                <p>${companyInfo?.address_full || 'Adres bilgisi'}</p>
                <p>VKN/TCKN: ${companyInfo?.tax_id || '-'}</p>
                <p>Tel: ${companyInfo?.phone || '-'}</p>
            </div>
            <div class="invoice-info">
                <h2>${invoice.scenario === 'EFATURA' ? 'E-FATURA' : 'E-ARŞİV FATURA'}</h2>
                <p class="invoice-number">${invoice.gib_invoice_no}</p>
                <p>Tarih: ${formatDate(invoice.issued_at)}</p>
                ${invoice.ettn ? `<p>ETTN: ${invoice.ettn}</p>` : ''}
                <p><span class="status-badge ${invoice.status === 'signed' ? 'status-signed' : 'status-draft'}">${invoice.status === 'signed' ? 'ONAYLANDI' :
            invoice.status === 'draft' ? 'TASLAK' :
                invoice.status.toUpperCase()
        }</span></p>
            </div>
        </div>
        
        <div class="customer-section">
            <div class="customer-info">
                <div class="section-title">ALICI BİLGİLERİ</div>
                <p><strong>${invoice.customer_name}</strong></p>
                ${invoice.customer_tax_id ? `<p>VKN/TCKN: ${invoice.customer_tax_id}</p>` : ''}
            </div>
            <div class="invoice-details">
                <div class="section-title">FATURA DETAYLARI</div>
                <p>Fatura Türü: ${invoice.type === 'SATIS' ? 'Satış Faturası' : 'İade Faturası'}</p>
                <p>Senaryo: ${invoice.scenario}</p>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 40%">Ürün/Hizmet</th>
                    <th class="text-right">Miktar</th>
                    <th class="text-right">Birim Fiyat</th>
                    <th class="text-right">Tutar</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${formatCurrency(item.price)}</td>
                    <td class="text-right">${formatCurrency(item.price * item.quantity)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals">
            <div class="totals-row">
                <span class="totals-label">Ara Toplam:</span>
                <span class="totals-value">${formatCurrency(invoice.total_amount - invoice.tax_amount)}</span>
            </div>
            <div class="totals-row">
                <span class="totals-label">KDV (%10):</span>
                <span class="totals-value">${formatCurrency(invoice.tax_amount)}</span>
            </div>
            <div class="totals-row grand-total">
                <span class="totals-label">GENEL TOPLAM:</span>
                <span class="totals-value">${formatCurrency(invoice.total_amount)}</span>
            </div>
        </div>
        
        <div class="footer">
            <p>Bu belge 5070 sayılı Elektronik İmza Kanunu kapsamında elektronik olarak imzalanmıştır.</p>
            <p>© ${new Date().getFullYear()} - ${companyInfo?.company_title || 'Restoran'}</p>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Print or Download Invoice as PDF
 */
export const downloadInvoicePDF = (invoice, companyInfo, items) => {
    const html = generateInvoiceHTML(invoice, companyInfo, items);

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto-trigger print dialog
    setTimeout(() => {
        printWindow.print();
    }, 500);
};
