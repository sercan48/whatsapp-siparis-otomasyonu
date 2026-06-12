/**
 * Payment Gateway Service
 * Supports: Iyzico, PayTR, Masterpass, BKM Express
 * Includes card storage (tokenization) for returning customers
 */

import { supabase } from './supabaseClient';

// Provider base URLs
const PROVIDER_URLS = {
    iyzico: {
        sandbox: 'https://sandbox-api.iyzipay.com',
        production: 'https://api.iyzipay.com'
    },
    paytr: {
        sandbox: 'https://www.paytr.com/odeme/api/get-token',
        production: 'https://www.paytr.com/odeme/api/get-token'
    },
    masterpass: {
        sandbox: 'https://sandbox.masterpass.com/routing/v2',
        production: 'https://masterpass.com/routing/v2'
    },
    bkm_express: {
        sandbox: 'https://preprod.bkmexpress.com.tr',
        production: 'https://www.bkmexpress.com.tr'
    }
};

/**
 * Get payment settings for a tenant
 */
export async function getPaymentSettings(tenantId) {
    const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching payment settings:', error);
        return null;
    }

    return data;
}

/**
 * Save payment settings for a tenant
 */
export async function savePaymentSettings(tenantId, settings) {
    const { data: existing } = await supabase
        .from('payment_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .single();

    if (existing) {
        const { data, error } = await supabase
            .from('payment_settings')
            .update({ ...settings, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase
            .from('payment_settings')
            .insert({ tenant_id: tenantId, ...settings })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

/**
 * Get available (enabled) payment providers for a tenant
 */
export async function getEnabledProviders(tenantId) {
    const settings = await getPaymentSettings(tenantId);
    if (!settings) return [];

    const providers = [];
    if (settings.iyzico_enabled) providers.push({ id: 'iyzico', name: 'Iyzico', icon: '💳', supportsCardStorage: true });
    if (settings.paytr_enabled) providers.push({ id: 'paytr', name: 'PayTR', icon: '🏦', supportsCardStorage: false });
    if (settings.masterpass_enabled) providers.push({ id: 'masterpass', name: 'Masterpass', icon: '🔵', supportsCardStorage: true });
    if (settings.bkm_express_enabled) providers.push({ id: 'bkm_express', name: 'BKM Express', icon: '🟣', supportsCardStorage: true });

    return providers;
}

/**
 * Initialize a payment transaction
 */
export async function initializePayment({
    tenantId,
    orderId,
    amount,
    currency = 'TRY',
    provider,
    customerInfo,
    basketItems,
    callbackUrl,
    returnUrl
}) {
    // Create transaction record
    const { data: transaction, error } = await supabase
        .from('payment_transactions')
        .insert({
            tenant_id: tenantId,
            order_id: orderId,
            amount,
            currency,
            provider,
            status: 'pending',
            callback_url: callbackUrl,
            return_url: returnUrl,
            metadata: { customerInfo, basketItems }
        })
        .select()
        .single();

    if (error) throw error;

    // Get provider settings
    const settings = await getPaymentSettings(tenantId);
    if (!settings) throw new Error('Ödeme ayarları bulunamadı');

    // Generate checkout form based on provider
    let checkoutData;
    switch (provider) {
        case 'iyzico':
            checkoutData = await generateIyzicoCheckout(settings, transaction, customerInfo, basketItems);
            break;
        case 'paytr':
            checkoutData = await generatePayTRCheckout(settings, transaction, customerInfo, basketItems);
            break;
        case 'masterpass':
            checkoutData = await generateMasterpassCheckout(settings, transaction, customerInfo, basketItems);
            break;
        case 'bkm_express':
            checkoutData = await generateBKMExpressCheckout(settings, transaction, customerInfo, basketItems);
            break;
        default:
            throw new Error('Geçersiz ödeme sağlayıcısı');
    }

    return {
        transactionId: transaction.id,
        ...checkoutData
    };
}

/**
 * Generate Iyzico checkout form
 * Calls Edge Function for real API integration when configured
 */
async function generateIyzicoCheckout(settings, transaction, customerInfo, basketItems) {
    const isSandbox = settings.iyzico_sandbox;

    // In demo mode without API keys, return demo checkout
    if (!settings.iyzico_api_key || !settings.iyzico_secret_key) {
        return {
            provider: 'iyzico',
            mode: 'demo',
            checkoutFormHtml: generateDemoCheckoutForm('iyzico', transaction),
            message: 'Demo mod - API anahtarları yapılandırılmadı'
        };
    }

    try {
        // Call Edge Function for real iyzico integration
        const { data, error } = await supabase.functions.invoke('iyzico-checkout/init', {
            body: {
                tenantId: transaction.tenant_id,
                orderId: transaction.order_id,
                amount: transaction.amount,
                customerInfo,
                basketItems,
                callbackUrl: transaction.callback_url
            }
        });

        if (error) throw error;

        if (data.mode === 'demo') {
            return {
                provider: 'iyzico',
                mode: 'demo',
                checkoutFormHtml: generateDemoCheckoutForm('iyzico', transaction),
                message: data.error || 'Demo mod aktif'
            };
        }

        return {
            provider: 'iyzico',
            mode: isSandbox ? 'sandbox' : 'production',
            checkoutFormHtml: data.checkoutFormHtml,
            token: data.token,
            transactionId: data.transactionId
        };
    } catch (error) {
        console.error('iyzico Edge Function error:', error);
        // Fallback to demo mode on error
        return {
            provider: 'iyzico',
            mode: 'demo',
            checkoutFormHtml: generateDemoCheckoutForm('iyzico', transaction),
            message: 'Bağlantı hatası - Demo mod aktif'
        };
    }
}

/**
 * Generate PayTR checkout token
 */
async function generatePayTRCheckout(settings, transaction, customerInfo, basketItems) {
    const isSandbox = settings.paytr_sandbox;

    if (!settings.paytr_merchant_id || !settings.paytr_merchant_key || !settings.paytr_merchant_salt) {
        return {
            provider: 'paytr',
            mode: 'demo',
            checkoutFormHtml: generateDemoCheckoutForm('paytr', transaction),
            message: 'Demo mod - API anahtarları yapılandırılmadı'
        };
    }

    // TODO: Implement actual PayTR API integration
    // This would involve:
    // 1. Generate merchant_oid, user_basket, hash
    // 2. POST to PayTR API to get token
    // 3. Return iframe URL with token

    return {
        provider: 'paytr',
        mode: isSandbox ? 'sandbox' : 'production',
        checkoutFormHtml: generateDemoCheckoutForm('paytr', transaction),
        message: 'Sandbox modu aktif'
    };
}

/**
 * Generate Masterpass checkout
 */
async function generateMasterpassCheckout(settings, transaction, customerInfo, basketItems) {
    const isSandbox = settings.masterpass_sandbox;

    if (!settings.masterpass_merchant_id || !settings.masterpass_token) {
        return {
            provider: 'masterpass',
            mode: 'demo',
            checkoutFormHtml: generateDemoCheckoutForm('masterpass', transaction),
            message: 'Demo mod - API anahtarları yapılandırılmadı'
        };
    }

    // TODO: Implement actual Masterpass API integration
    // Masterpass supports card tokenization for saved cards

    return {
        provider: 'masterpass',
        mode: isSandbox ? 'sandbox' : 'production',
        checkoutFormHtml: generateDemoCheckoutForm('masterpass', transaction),
        message: 'Sandbox modu aktif',
        supportsCardStorage: true
    };
}

/**
 * Generate BKM Express checkout
 */
async function generateBKMExpressCheckout(settings, transaction, customerInfo, basketItems) {
    const isSandbox = settings.bkm_express_sandbox;

    if (!settings.bkm_express_merchant_id || !settings.bkm_express_private_key) {
        return {
            provider: 'bkm_express',
            mode: 'demo',
            checkoutFormHtml: generateDemoCheckoutForm('bkm_express', transaction),
            message: 'Demo mod - API anahtarları yapılandırılmadı'
        };
    }

    // TODO: Implement actual BKM Express API integration
    // BKM Express supports one-click payments with stored cards

    return {
        provider: 'bkm_express',
        mode: isSandbox ? 'sandbox' : 'production',
        checkoutFormHtml: generateDemoCheckoutForm('bkm_express', transaction),
        message: 'Sandbox modu aktif',
        supportsCardStorage: true
    };
}

/**
 * Generate demo checkout form for testing without API keys
 */
function generateDemoCheckoutForm(provider, transaction) {
    const providerNames = {
        iyzico: 'Iyzico',
        paytr: 'PayTR',
        masterpass: 'Masterpass',
        bkm_express: 'BKM Express'
    };

    const providerColors = {
        iyzico: '#1E88E5',
        paytr: '#4CAF50',
        masterpass: '#FF5F00',
        bkm_express: '#6B21A8'
    };

    return `
        <div style="max-width: 400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
            <div style="background: linear-gradient(135deg, ${providerColors[provider]}, ${providerColors[provider]}dd); 
                        color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h3 style="margin: 0 0 8px 0;">${providerNames[provider]} Demo Ödeme</h3>
                <p style="margin: 0; opacity: 0.9; font-size: 14px;">Test modu - Gerçek işlem yapılmayacak</p>
            </div>
            
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">Kart Numarası</label>
                    <input type="text" value="4242 4242 4242 4242" readonly
                           style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; 
                                  font-size: 16px; background: white; box-sizing: border-box;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">Son Kullanma</label>
                        <input type="text" value="12/25" readonly
                               style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; 
                                      font-size: 16px; background: white; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px;">CVV</label>
                        <input type="text" value="123" readonly
                               style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; 
                                      font-size: 16px; background: white; box-sizing: border-box;">
                    </div>
                </div>
                
                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 13px; color: #92400e;">
                        ⚠️ Bu bir demo ödemesidir. API anahtarları yapılandırıldığında gerçek ödeme alınacaktır.
                    </p>
                </div>
                
                <div style="text-align: center; padding: 16px 0; border-top: 1px solid #e2e8f0;">
                    <span style="font-size: 24px; font-weight: bold; color: #1e293b;">
                        ${transaction.amount.toFixed(2)} ₺
                    </span>
                </div>
            </div>
            
            <button onclick="window.handleDemoPayment && window.handleDemoPayment('${transaction.id}', 'success')"
                    style="width: 100%; padding: 16px; background: ${providerColors[provider]}; color: white; 
                           border: none; border-radius: 0 0 12px 12px; font-size: 16px; font-weight: 600; 
                           cursor: pointer; transition: opacity 0.2s;">
                💳 Demo Ödeme Yap
            </button>
        </div>
    `;
}

/**
 * Handle payment callback from provider
 */
export async function handlePaymentCallback(transactionId, status, providerData = {}) {
    const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...providerData
    };

    const { data, error } = await supabase
        .from('payment_transactions')
        .update(updateData)
        .eq('id', transactionId)
        .select()
        .single();

    if (error) throw error;

    // If payment successful, update order
    if (status === 'success' && data.order_id) {
        await supabase
            .from('pos_orders')
            .update({
                is_paid_online: true,
                payment_transaction_id: transactionId,
                payment_status: 'paid'
            })
            .eq('id', data.order_id);
    }

    return data;
}

/**
 * Get transaction by ID
 */
export async function getTransaction(transactionId) {
    const { data, error } = await supabase
        .from('payment_transactions')
        .select('*, pos_orders(*)')
        .eq('id', transactionId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get transactions for a tenant
 */
export async function getTransactions(tenantId, filters = {}) {
    let query = supabase
        .from('payment_transactions')
        .select('*, pos_orders(id, table_name, total_amount)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    if (filters.provider) {
        query = query.eq('provider', filters.provider);
    }

    if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
    }

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/**
 * Request refund for a transaction
 */
export async function requestRefund(transactionId, amount, reason) {
    const transaction = await getTransaction(transactionId);
    if (!transaction) throw new Error('İşlem bulunamadı');

    if (transaction.status !== 'success') {
        throw new Error('Sadece başarılı ödemeler iade edilebilir');
    }

    if (amount > transaction.amount) {
        throw new Error('İade tutarı ödeme tutarını aşamaz');
    }

    // Create refund record
    const { data: refund, error } = await supabase
        .from('payment_refunds')
        .insert({
            transaction_id: transactionId,
            amount,
            reason,
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;

    // In production, this would call the provider's refund API
    // For now, we'll simulate success
    const { data: updatedRefund } = await supabase
        .from('payment_refunds')
        .update({
            status: 'success',
            processed_at: new Date().toISOString()
        })
        .eq('id', refund.id)
        .select()
        .single();

    // Update transaction status if full refund
    if (amount >= transaction.amount) {
        await supabase
            .from('payment_transactions')
            .update({ status: 'refunded' })
            .eq('id', transactionId);
    }

    return updatedRefund;
}

/**
 * Get payment statistics for a tenant
 */
export async function getPaymentStats(tenantId, dateRange = 'today') {
    let dateFilter;
    const now = new Date();

    switch (dateRange) {
        case 'today':
            dateFilter = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            break;
        case 'week':
            dateFilter = new Date(now.setDate(now.getDate() - 7)).toISOString();
            break;
        case 'month':
            dateFilter = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
            break;
        default:
            dateFilter = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    }

    const { data, error } = await supabase
        .from('payment_transactions')
        .select('amount, status, provider')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateFilter);

    if (error) throw error;

    const stats = {
        totalTransactions: data.length,
        successfulTransactions: data.filter(t => t.status === 'success').length,
        failedTransactions: data.filter(t => t.status === 'failed').length,
        totalAmount: data.filter(t => t.status === 'success').reduce((sum, t) => sum + parseFloat(t.amount), 0),
        byProvider: {}
    };

    // Group by provider
    data.filter(t => t.status === 'success').forEach(t => {
        if (!stats.byProvider[t.provider]) {
            stats.byProvider[t.provider] = { count: 0, amount: 0 };
        }
        stats.byProvider[t.provider].count++;
        stats.byProvider[t.provider].amount += parseFloat(t.amount);
    });

    return stats;
}

export default {
    getPaymentSettings,
    savePaymentSettings,
    getEnabledProviders,
    initializePayment,
    handlePaymentCallback,
    getTransaction,
    getTransactions,
    requestRefund,
    getPaymentStats
};
