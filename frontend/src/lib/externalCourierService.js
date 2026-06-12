/**
 * External Courier Service
 * Integrates with: Paketaxi, Maxijet, Getir Kurye
 * Uses webhook-based communication for real-time updates
 */

import { supabase } from './supabaseClient';

// Provider Configurations
const PROVIDERS = {
    paketaxi: {
        name: 'Paketaxi',
        logo: '🚕',
        color: '#FFD700',
        webhookPath: '/api/webhooks/paketaxi',
        // Paketaxi uses partner platforms, we simulate via webhook
        supportsTracking: true,
        supportsScheduled: true,
        avgDeliveryTime: 35 // minutes
    },
    maxijet: {
        name: 'Maxijet',
        logo: '🏍️',
        color: '#FF5722',
        webhookPath: '/api/webhooks/maxijet',
        supportsTracking: true,
        supportsScheduled: false,
        avgDeliveryTime: 30
    },
    getir: {
        name: 'Getir Kurye',
        logo: '💜',
        color: '#5C3997',
        webhookPath: '/api/webhooks/getir',
        supportsTracking: true,
        supportsScheduled: false,
        avgDeliveryTime: 25
    }
};

// ==================== PROVIDER MANAGEMENT ====================

/**
 * Get all configured providers for a tenant
 */
export async function getProviders(tenantId) {
    const { data, error } = await supabase
        .from('external_courier_providers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false });

    if (error) throw error;

    // Merge with static config
    return (data || []).map(p => ({
        ...p,
        ...PROVIDERS[p.provider_code]
    }));
}

/**
 * Get enabled providers only
 */
export async function getEnabledProviders(tenantId) {
    const providers = await getProviders(tenantId);
    return providers.filter(p => p.is_enabled);
}

/**
 * Enable/disable a provider
 */
export async function toggleProvider(tenantId, providerCode, enabled) {
    const { error } = await supabase
        .from('external_courier_providers')
        .upsert({
            tenant_id: tenantId,
            provider_code: providerCode,
            provider_name: PROVIDERS[providerCode]?.name || providerCode,
            is_enabled: enabled,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'tenant_id,provider_code'
        });

    if (error) throw error;
    return true;
}

/**
 * Update provider configuration
 */
export async function updateProviderConfig(tenantId, providerCode, config) {
    const { error } = await supabase
        .from('external_courier_providers')
        .upsert({
            tenant_id: tenantId,
            provider_code: providerCode,
            provider_name: PROVIDERS[providerCode]?.name || providerCode,
            ...config,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'tenant_id,provider_code'
        });

    if (error) throw error;
    return true;
}

// ==================== PRICE QUOTES ====================

/**
 * Get price quotes from all enabled providers
 */
export async function getDeliveryQuotes(tenantId, orderData) {
    const providers = await getEnabledProviders(tenantId);
    const quotes = [];

    for (const provider of providers) {
        try {
            const quote = await getProviderQuote(provider, orderData);
            quotes.push(quote);
        } catch (error) {
            console.error(`Error getting quote from ${provider.provider_code}:`, error);
            quotes.push({
                provider: provider.provider_code,
                providerName: provider.provider_name,
                available: false,
                error: error.message
            });
        }
    }

    // Sort by fee (cheapest first)
    quotes.sort((a, b) => {
        if (!a.available) return 1;
        if (!b.available) return -1;
        return a.fee - b.fee;
    });

    // Save quotes for reference
    await supabase.from('external_courier_quotes').insert({
        tenant_id: tenantId,
        order_id: orderData.orderId,
        pickup_lat: orderData.pickupLat,
        pickup_lng: orderData.pickupLng,
        delivery_lat: orderData.deliveryLat,
        delivery_lng: orderData.deliveryLng,
        distance_km: orderData.distanceKm,
        quotes: quotes,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min expiry
    });

    return quotes;
}

/**
 * Get quote from a specific provider
 */
async function getProviderQuote(provider, orderData) {
    const distanceKm = orderData.distanceKm || 3;

    // Calculate fee based on provider config
    let fee = provider.base_fee || 0;
    fee += (provider.per_km_rate || 3) * distanceKm;
    fee = Math.max(fee, provider.min_fee || 15);

    // Add surge pricing for peak hours
    const hour = new Date().getHours();
    if (hour >= 12 && hour <= 14) {
        fee *= 1.2; // 20% surge during lunch
    } else if (hour >= 19 && hour <= 21) {
        fee *= 1.3; // 30% surge during dinner
    }

    // Check if within service area
    const isWithinArea = distanceKm <= (provider.max_distance_km || 10);

    // Check operating hours
    const isOperating = checkOperatingHours(provider);

    return {
        provider: provider.provider_code,
        providerName: provider.provider_name,
        logo: PROVIDERS[provider.provider_code]?.logo || '📦',
        color: PROVIDERS[provider.provider_code]?.color || '#666',
        available: isWithinArea && isOperating,
        fee: Math.round(fee * 100) / 100,
        currency: 'TRY',
        estimatedMinutes: PROVIDERS[provider.provider_code]?.avgDeliveryTime || 30,
        supportsTracking: PROVIDERS[provider.provider_code]?.supportsTracking || false,
        reason: !isWithinArea ? 'Mesafe limiti aşıldı' : (!isOperating ? 'Çalışma saatleri dışında' : null)
    };
}

/**
 * Check if provider is currently operating
 */
function checkOperatingHours(provider) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 100 + now.getMinutes();

    // Check operating days
    const operatingDays = provider.operating_days || [0, 1, 2, 3, 4, 5, 6];
    if (!operatingDays.includes(currentDay)) return false;

    // Check operating hours
    const hours = provider.operating_hours || { start: '09:00', end: '23:00' };
    const startTime = parseInt(hours.start.replace(':', ''));
    const endTime = parseInt(hours.end.replace(':', ''));

    return currentTime >= startTime && currentTime <= endTime;
}

// ==================== ORDER MANAGEMENT ====================

/**
 * Create external courier order
 */
export async function createExternalOrder(tenantId, providerCode, orderData) {
    // Get provider config
    const { data: provider } = await supabase
        .from('external_courier_providers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('provider_code', providerCode)
        .single();

    if (!provider) throw new Error('Kurye sağlayıcısı bulunamadı');
    if (!provider.is_enabled) throw new Error('Bu kurye sağlayıcısı aktif değil');

    // Create external order record
    const { data: extOrder, error } = await supabase
        .from('external_courier_orders')
        .insert({
            tenant_id: tenantId,
            provider_id: provider.id,
            provider_code: providerCode,
            order_id: orderData.orderId,
            delivery_id: orderData.deliveryId,
            status: 'requested',

            pickup_address: orderData.pickupAddress,
            pickup_lat: orderData.pickupLat,
            pickup_lng: orderData.pickupLng,
            pickup_phone: orderData.pickupPhone,
            pickup_notes: orderData.pickupNotes,

            delivery_address: orderData.deliveryAddress,
            delivery_lat: orderData.deliveryLat,
            delivery_lng: orderData.deliveryLng,
            delivery_phone: orderData.deliveryPhone,
            delivery_notes: orderData.deliveryNotes,

            package_description: orderData.packageDescription || 'Yemek siparişi',
            package_size: orderData.packageSize || 'medium',
            is_food: true,

            estimated_fee: orderData.estimatedFee,

            raw_request: orderData
        })
        .select()
        .single();

    if (error) throw error;

    // In production, this would call the provider's API
    // For now, simulate acceptance after a delay
    await simulateProviderResponse(extOrder.id, providerCode);

    return extOrder;
}

/**
 * Simulate provider response (for demo/testing)
 */
async function simulateProviderResponse(externalOrderId, providerCode) {
    // Simulate courier assignment after 5 seconds
    setTimeout(async () => {
        const courierNames = {
            paketaxi: 'Mehmet K.',
            maxijet: 'Ali Y.',
            getir: 'Ahmet D.'
        };

        await supabase
            .from('external_courier_orders')
            .update({
                status: 'courier_assigned',
                courier_name: courierNames[providerCode] || 'Kurye',
                courier_phone: '0532 XXX XX XX',
                courier_vehicle: 'Motosiklet',
                provider_order_id: `${providerCode.toUpperCase()}-${Date.now()}`,
                estimated_pickup_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                estimated_delivery_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', externalOrderId);
    }, 5000);
}

/**
 * Get external order by ID
 */
export async function getExternalOrder(orderId) {
    const { data, error } = await supabase
        .from('external_courier_orders')
        .select(`
            *,
            provider:external_courier_providers(*)
        `)
        .eq('id', orderId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get external orders for a tenant
 */
export async function getExternalOrders(tenantId, filters = {}) {
    let query = supabase
        .from('external_courier_orders')
        .select(`
            *,
            provider:external_courier_providers(provider_name, provider_code)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    if (filters.providerCode) {
        query = query.eq('provider_code', filters.providerCode);
    }
    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/**
 * Cancel external order
 */
export async function cancelExternalOrder(orderId, reason) {
    const { data, error } = await supabase
        .from('external_courier_orders')
        .update({
            status: 'cancelled',
            error_message: reason,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ==================== TRACKING ====================

/**
 * Get real-time tracking info
 */
export async function getTrackingInfo(externalOrderId) {
    const order = await getExternalOrder(externalOrderId);

    if (!order) throw new Error('Sipariş bulunamadı');

    return {
        status: order.status,
        statusText: getStatusText(order.status),
        courier: order.courier_name ? {
            name: order.courier_name,
            phone: order.courier_phone,
            vehicle: order.courier_vehicle,
            plate: order.courier_plate,
            photo: order.courier_photo_url
        } : null,
        location: order.courier_lat ? {
            lat: order.courier_lat,
            lng: order.courier_lng,
            lastUpdate: order.last_location_update
        } : null,
        timing: {
            estimatedPickup: order.estimated_pickup_time,
            actualPickup: order.actual_pickup_time,
            estimatedDelivery: order.estimated_delivery_time,
            actualDelivery: order.actual_delivery_time
        },
        trackingUrl: order.provider_tracking_url
    };
}

/**
 * Get human-readable status text
 */
function getStatusText(status) {
    const statusMap = {
        pending: 'Bekliyor',
        requested: 'Talep Gönderildi',
        accepted: 'Kabul Edildi',
        courier_assigned: 'Kurye Atandı',
        picked_up: 'Alındı',
        in_transit: 'Yolda',
        delivered: 'Teslim Edildi',
        cancelled: 'İptal Edildi',
        failed: 'Başarısız'
    };
    return statusMap[status] || status;
}

// ==================== WEBHOOKS ====================

/**
 * Process incoming webhook from provider
 */
export async function processWebhook(providerCode, payload, signature) {
    // Log the webhook
    const { data: log } = await supabase
        .from('external_courier_webhook_logs')
        .insert({
            provider_code: providerCode,
            event_type: payload.event || payload.type,
            payload: payload,
            signature: signature,
            is_verified: true // In production, verify signature
        })
        .select()
        .single();

    // Find the related order
    const providerOrderId = payload.order_id || payload.orderId;

    const { data: order } = await supabase
        .from('external_courier_orders')
        .select('*')
        .eq('provider_order_id', providerOrderId)
        .single();

    if (!order) {
        console.warn('Order not found for webhook:', providerOrderId);
        return { success: false, error: 'Order not found' };
    }

    // Update the order based on event type
    const updateData = {
        updated_at: new Date().toISOString(),
        webhook_events: [...(order.webhook_events || []), {
            event: payload.event,
            timestamp: new Date().toISOString(),
            data: payload
        }]
    };

    // Map provider events to our status
    switch (payload.event) {
        case 'courier_assigned':
        case 'assigned':
            updateData.status = 'courier_assigned';
            updateData.courier_name = payload.courier?.name;
            updateData.courier_phone = payload.courier?.phone;
            updateData.courier_vehicle = payload.courier?.vehicle;
            break;
        case 'picked_up':
        case 'pickup':
            updateData.status = 'picked_up';
            updateData.actual_pickup_time = new Date().toISOString();
            break;
        case 'in_transit':
        case 'on_way':
            updateData.status = 'in_transit';
            break;
        case 'delivered':
        case 'completed':
            updateData.status = 'delivered';
            updateData.actual_delivery_time = new Date().toISOString();
            if (payload.proof_url) updateData.delivery_proof_url = payload.proof_url;
            break;
        case 'cancelled':
        case 'failed':
            updateData.status = payload.event;
            updateData.error_message = payload.reason;
            break;
        case 'location_update':
            updateData.courier_lat = payload.lat;
            updateData.courier_lng = payload.lng;
            updateData.last_location_update = new Date().toISOString();
            break;
    }

    await supabase
        .from('external_courier_orders')
        .update(updateData)
        .eq('id', order.id);

    // Mark webhook as processed
    await supabase
        .from('external_courier_webhook_logs')
        .update({ processed: true, external_order_id: order.id })
        .eq('id', log.id);

    return { success: true, orderId: order.id };
}

// ==================== UTILITIES ====================

/**
 * Get provider info by code
 */
export function getProviderInfo(providerCode) {
    return PROVIDERS[providerCode] || null;
}

/**
 * Get all available provider codes
 */
export function getAvailableProviderCodes() {
    return Object.keys(PROVIDERS);
}

export default {
    getProviders,
    getEnabledProviders,
    toggleProvider,
    updateProviderConfig,
    getDeliveryQuotes,
    createExternalOrder,
    getExternalOrder,
    getExternalOrders,
    cancelExternalOrder,
    getTrackingInfo,
    processWebhook,
    getProviderInfo,
    getAvailableProviderCodes
};
