/**
 * AI Credits Service
 * Manages credit balance, usage tracking, and billing
 */

import { supabase } from './supabaseClient';

/**
 * Get credit status for tenant
 */
export const getCreditStatus = async (tenantId) => {
    try {
        const { data, error } = await supabase.rpc('get_ai_credit_status', {
            p_tenant_id: tenantId
        });

        if (error) {
            // If function doesn't exist, return default
            console.warn('Credit status RPC error, using defaults:', error);
            return getDefaultCreditStatus();
        }

        return data;
    } catch (error) {
        console.error('Error getting credit status:', error);
        return getDefaultCreditStatus();
    }
};

/**
 * Default credit status for new tenants
 */
const getDefaultCreditStatus = () => ({
    monthly_free: 5,
    used_free: 0,
    remaining_free: 5,
    price_per_image: 3.00,
    total_due: 0,
    last_reset: new Date().toISOString()
});

/**
 * Use a credit and return result
 */
export const useCredit = async (tenantId) => {
    try {
        const { data, error } = await supabase.rpc('use_ai_credit', {
            p_tenant_id: tenantId
        });

        if (error) {
            console.warn('Use credit RPC error, using local tracking:', error);
            return localCreditCheck(tenantId);
        }

        return data;
    } catch (error) {
        console.error('Error using credit:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Local credit tracking fallback (when RPC not available)
 */
const localCreditCheck = async (tenantId) => {
    // Get or create credit record
    let { data: credits } = await supabase
        .from('ai_credits')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

    if (!credits) {
        const { data: newCredits } = await supabase
            .from('ai_credits')
            .insert({ tenant_id: tenantId })
            .select()
            .single();
        credits = newCredits || { monthly_free_credits: 5, used_free_credits: 0, price_per_image: 3 };
    }

    const remainingFree = credits.monthly_free_credits - credits.used_free_credits;

    if (remainingFree > 0) {
        // Use free credit
        await supabase
            .from('ai_credits')
            .update({ used_free_credits: credits.used_free_credits + 1 })
            .eq('tenant_id', tenantId);

        return {
            success: true,
            credit_type: 'free',
            cost: 0,
            remaining_free: remainingFree - 1
        };
    } else {
        // Use paid credit
        await supabase
            .from('ai_credits')
            .update({
                paid_credits_balance: (credits.paid_credits_balance || 0) + credits.price_per_image
            })
            .eq('tenant_id', tenantId);

        return {
            success: true,
            credit_type: 'paid',
            cost: credits.price_per_image,
            remaining_free: 0,
            total_due: (credits.paid_credits_balance || 0) + credits.price_per_image
        };
    }
};

/**
 * Log AI usage
 */
export const logUsage = async (tenantId, usageData) => {
    try {
        const { data, error } = await supabase
            .from('ai_usage_logs')
            .insert({
                tenant_id: tenantId,
                prompt: usageData.prompt,
                image_url: usageData.imageUrl,
                format: usageData.format,
                campaign_type: usageData.campaignType,
                product_name: usageData.productName,
                provider: usageData.provider,
                credit_type: usageData.creditType,
                cost: usageData.cost,
                status: usageData.status || 'completed'
            })
            .select()
            .single();

        return data;
    } catch (error) {
        console.error('Error logging usage:', error);
        return null;
    }
};

/**
 * Get usage history
 */
export const getUsageHistory = async (tenantId, limit = 20) => {
    try {
        const { data, error } = await supabase
            .from('ai_usage_logs')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting usage history:', error);
        return [];
    }
};

/**
 * Get billing summary for current month
 */
export const getCurrentBilling = async (tenantId) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('ai_billing')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('billing_period_start', startOfMonth.toISOString().split('T')[0])
            .single();

        return data || {
            free_images_used: 0,
            paid_images_used: 0,
            total_cost: 0
        };
    } catch (error) {
        console.error('Error getting billing:', error);
        return { free_images_used: 0, paid_images_used: 0, total_cost: 0 };
    }
};

export default {
    getCreditStatus,
    useCredit,
    logUsage,
    getUsageHistory,
    getCurrentBilling
};
