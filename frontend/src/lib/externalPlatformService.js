/**
 * External Platform Service
 * Integrates with: Yemeksepeti, Getir, Hepsiburada Yemek, Trendyol Yemek
 * Unified order management from all food delivery platforms
 */

import { supabase } from './supabaseClient';

// Platform Configurations
const PLATFORMS = {
    yemeksepeti: {
        name: 'Yemeksepeti',
        logo: '🍕',
        color: '#FA0050',
        webhookPath: '/api/webhooks/yemeksepeti'
    },
    getir: {
        name: 'Getir Yemek',
        logo: '💜',
        color: '#5C3997',
        webhookPath: '/api/webhooks/getir'
    },
    hepsiburada: {
        name: 'Hepsiburada Yemek',
        logo: '🟠',
        color: '#FF6000',
        webhookPath: '/api/webhooks/hepsiburada'
    },
    trendyol: {
        name: 'Trendyol Yemek',
        logo: '🟡',
        color: '#F27A1A',
        webhookPath: '/api/webhooks/trendyol'
    }
};

// ==================== PLATFORM MANAGEMENT ====================

export async function getPlatformConfigs(tenantId) {
    const { data, error } = await supabase
        .from('external_platform_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('platform_code');

    if (error) throw error;

    return (data || []).map(p => ({
        ...p,
        ...PLATFORMS[p.platform_code]
    }));
}

export async function getEnabledPlatforms(tenantId) {
    const configs = await getPlatformConfigs(tenantId);
    return configs.filter(p => p.is_enabled);
}

export async function togglePlatform(tenantId, platformCode, enabled) {
    const { error } = await supabase
        .from('external_platform_configs')
        .upsert({
            tenant_id: tenantId,
            platform_code: platformCode,
            platform_name: PLATFORMS[platformCode]?.name || platformCode,
            is_enabled: enabled,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'tenant_id,platform_code'
        });

    if (error) throw error;
    return true;
}

export async function updatePlatformConfig(tenantId, platformCode, config) {
    const { error } = await supabase
        .from('external_platform_configs')
        .upsert({
            tenant_id: tenantId,
            platform_code: platformCode,
            platform_name: PLATFORMS[platformCode]?.name || platformCode,
            ...config,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'tenant_id,platform_code'
        });

    if (error) throw error;
    return true;
}

// ==================== ORDER MANAGEMENT ====================

export async function getAllPlatformOrders(tenantId, filters = {}) {
    let query = supabase
        .from('external_platform_orders')
        .select(`
            *,
            platform_config:external_platform_configs(platform_name, platform_code)
        `)
        .eq('tenant_id', tenantId)
        .order('ordered_at', { ascending: false });

    if (filters.status) {
        if (Array.isArray(filters.status)) {
            query = query.in('status', filters.status);
        } else {
            query = query.eq('status', filters.status);
        }
    }

    if (filters.platformCode) {
        query = query.eq('platform_code', filters.platformCode);
    }

    if (filters.dateFrom) {
        query = query.gte('ordered_at', filters.dateFrom);
    }

    if (filters.dateTo) {
        query = query.lte('ordered_at', filters.dateTo);
    }

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(order => ({
        ...order,
        platformInfo: PLATFORMS[order.platform_code]
    }));
}

export async function getActiveOrders(tenantId) {
    return getAllPlatformOrders(tenantId, {
        status: ['new', 'confirmed', 'preparing', 'ready']
    });
}

export async function getOrderById(orderId) {
    const { data, error } = await supabase
        .from('external_platform_orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error) throw error;
    return data;
}

export async function updateOrderStatus(orderId, status, additionalData = {}) {
    const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
    };

    // Set timestamp based on status
    if (status === 'confirmed') updateData.confirmed_at = new Date().toISOString();
    if (status === 'preparing') updateData.prepared_at = new Date().toISOString();
    if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString();
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('external_platform_orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

    if (error) throw error;

    // TODO: In production, notify platform of status change via their API

    return data;
}

export async function confirmOrder(orderId, estimatedMinutes = 30) {
    return updateOrderStatus(orderId, 'confirmed', {
        estimated_delivery_time: new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString()
    });
}

export async function rejectOrder(orderId, reason) {
    return updateOrderStatus(orderId, 'rejected', {
        cancel_reason: reason,
        cancelled_at: new Date().toISOString()
    });
}

// ==================== WEBHOOK PROCESSING ====================

export async function processWebhook(platformCode, payload, signature) {
    // Log webhook
    const { data: log } = await supabase
        .from('external_platform_webhooks')
        .insert({
            platform_code: platformCode,
            event_type: payload.event || payload.type || 'unknown',
            payload,
            signature,
            processed: false
        })
        .select()
        .single();

    try {
        // Process based on event type
        const eventType = payload.event || payload.type;

        switch (eventType) {
            case 'order.new':
            case 'new_order':
                await createOrderFromWebhook(platformCode, payload);
                break;
            case 'order.cancelled':
            case 'order_cancelled':
                await handleOrderCancellation(platformCode, payload);
                break;
            case 'order.updated':
                await handleOrderUpdate(platformCode, payload);
                break;
        }

        // Mark as processed
        await supabase
            .from('external_platform_webhooks')
            .update({ processed: true, process_result: 'success' })
            .eq('id', log.id);

        return { success: true };
    } catch (error) {
        await supabase
            .from('external_platform_webhooks')
            .update({ processed: true, process_result: error.message })
            .eq('id', log.id);

        throw error;
    }
}

async function createOrderFromWebhook(platformCode, payload) {
    // Extract tenant ID from merchant_id or similar field
    const merchantId = payload.merchant_id || payload.restaurant_id;

    const { data: config } = await supabase
        .from('external_platform_configs')
        .select('tenant_id')
        .eq('platform_code', platformCode)
        .eq('merchant_id', merchantId)
        .single();

    if (!config) throw new Error('Platform config not found');

    const orderData = normalizeOrderData(platformCode, payload);

    const { data, error } = await supabase
        .from('external_platform_orders')
        .insert({
            tenant_id: config.tenant_id,
            platform_code: platformCode,
            ...orderData
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

function normalizeOrderData(platformCode, payload) {
    // Normalize different platform formats to our schema
    switch (platformCode) {
        case 'yemeksepeti':
            return {
                platform_order_id: payload.order_id,
                platform_order_number: payload.order_number,
                status: 'new',
                customer_name: payload.customer?.name,
                customer_phone: payload.customer?.phone,
                customer_address: payload.delivery?.address,
                customer_note: payload.note,
                delivery_type: payload.delivery_type || 'delivery',
                subtotal: payload.subtotal,
                delivery_fee: payload.delivery_fee,
                discount_amount: payload.discount,
                total_amount: payload.total,
                payment_method: payload.payment_method,
                is_paid: payload.is_paid,
                items: payload.items,
                ordered_at: payload.created_at || new Date().toISOString(),
                raw_order: payload
            };
        case 'getir':
            return {
                platform_order_id: payload.id,
                platform_order_number: payload.confirmationId,
                status: 'new',
                customer_name: payload.client?.name,
                customer_phone: payload.client?.phoneNumber,
                customer_address: payload.client?.deliveryAddress?.address,
                customer_note: payload.clientNote,
                delivery_type: 'delivery',
                subtotal: payload.totalPrice - (payload.deliveryFee || 0),
                delivery_fee: payload.deliveryFee,
                total_amount: payload.totalPrice,
                payment_method: payload.paymentMethod,
                is_paid: payload.paymentMethod !== 'CASH',
                items: payload.products?.map(p => ({
                    name: p.name,
                    quantity: p.count,
                    price: p.price,
                    options: p.optionCategories?.flatMap(oc => oc.options?.map(o => o.name)) || []
                })),
                ordered_at: payload.createdDate || new Date().toISOString(),
                raw_order: payload
            };
        default:
            return {
                platform_order_id: payload.order_id || payload.id,
                status: 'new',
                raw_order: payload
            };
    }
}

async function handleOrderCancellation(platformCode, payload) {
    const platformOrderId = payload.order_id || payload.id;

    await supabase
        .from('external_platform_orders')
        .update({
            status: 'cancelled',
            cancel_reason: payload.reason || 'Platform tarafından iptal edildi',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('platform_code', platformCode)
        .eq('platform_order_id', platformOrderId);
}

async function handleOrderUpdate(platformCode, payload) {
    const platformOrderId = payload.order_id || payload.id;

    await supabase
        .from('external_platform_orders')
        .update({
            platform_status: payload.status,
            updated_at: new Date().toISOString()
        })
        .eq('platform_code', platformCode)
        .eq('platform_order_id', platformOrderId);
}

// ==================== STATISTICS ====================

export async function getPlatformStats(tenantId, dateRange = 'today') {
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
        .from('external_platform_orders')
        .select('platform_code, status, total_amount, commission_amount')
        .eq('tenant_id', tenantId)
        .gte('ordered_at', dateFilter);

    if (error) throw error;

    const stats = {
        totalOrders: data.length,
        deliveredOrders: data.filter(o => o.status === 'delivered').length,
        cancelledOrders: data.filter(o => ['cancelled', 'rejected'].includes(o.status)).length,
        totalRevenue: data.filter(o => o.status === 'delivered').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0),
        totalCommission: data.filter(o => o.status === 'delivered').reduce((sum, o) => sum + parseFloat(o.commission_amount || 0), 0),
        byPlatform: {}
    };

    // Group by platform
    Object.keys(PLATFORMS).forEach(platform => {
        const platformOrders = data.filter(o => o.platform_code === platform);
        stats.byPlatform[platform] = {
            name: PLATFORMS[platform].name,
            logo: PLATFORMS[platform].logo,
            orders: platformOrders.length,
            delivered: platformOrders.filter(o => o.status === 'delivered').length,
            revenue: platformOrders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0)
        };
    });

    return stats;
}

// ==================== UTILITIES ====================

export function getPlatformInfo(platformCode) {
    return PLATFORMS[platformCode] || null;
}

export function getAvailablePlatforms() {
    return Object.entries(PLATFORMS).map(([code, info]) => ({
        code,
        ...info
    }));
}

export function getStatusText(status) {
    const statusMap = {
        new: 'Yeni Sipariş',
        confirmed: 'Onaylandı',
        preparing: 'Hazırlanıyor',
        ready: 'Hazır',
        picked_up: 'Yola Çıktı',
        delivered: 'Teslim Edildi',
        cancelled: 'İptal Edildi',
        rejected: 'Reddedildi'
    };
    return statusMap[status] || status;
}

export function getStatusColor(status) {
    const colorMap = {
        new: 'bg-blue-100 text-blue-700 border-blue-200',
        confirmed: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        preparing: 'bg-amber-100 text-amber-700 border-amber-200',
        ready: 'bg-green-100 text-green-700 border-green-200',
        picked_up: 'bg-purple-100 text-purple-700 border-purple-200',
        delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
        rejected: 'bg-rose-100 text-rose-700 border-rose-200'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-700';
}

export default {
    getPlatformConfigs,
    getEnabledPlatforms,
    togglePlatform,
    updatePlatformConfig,
    getAllPlatformOrders,
    getActiveOrders,
    getOrderById,
    updateOrderStatus,
    confirmOrder,
    rejectOrder,
    processWebhook,
    getPlatformStats,
    getPlatformInfo,
    getAvailablePlatforms,
    getStatusText,
    getStatusColor
};
