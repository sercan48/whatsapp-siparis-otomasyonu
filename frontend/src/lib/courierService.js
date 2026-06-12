/**
 * Courier Service - Complete Courier Management
 * Supports: GPS tracking, earnings calculation, flexible payment models
 */

import { supabase } from './supabaseClient';

// ==================== COURIER PROFILE ====================

/**
 * Get courier profile by user ID
 */
export async function getCourierProfile(userId) {
    const { data, error } = await supabase
        .from('courier_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Create or update courier profile
 */
export async function upsertCourierProfile(userId, profileData) {
    const { data, error } = await supabase
        .from('courier_profiles')
        .upsert({
            id: userId,
            ...profileData,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update courier status (online/offline/busy)
 */
export async function updateCourierStatus(userId, status) {
    const { error } = await supabase
        .from('courier_profiles')
        .update({
            status,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (error) throw error;
    return true;
}

/**
 * Update courier location
 */
export async function updateCourierLocation(userId, latitude, longitude, additionalData = {}) {
    const { error: profileError } = await supabase
        .from('courier_profiles')
        .update({
            current_lat: latitude,
            current_lng: longitude,
            last_seen: new Date().toISOString()
        })
        .eq('id', userId);

    if (profileError) throw profileError;

    // Also log to history if there's an active delivery
    if (additionalData.deliveryId) {
        await supabase
            .from('courier_location_history')
            .insert({
                courier_id: userId,
                delivery_id: additionalData.deliveryId,
                latitude,
                longitude,
                accuracy: additionalData.accuracy,
                speed: additionalData.speed,
                heading: additionalData.heading
            });
    }

    return true;
}

// ==================== DELIVERIES ====================

/**
 * Get active deliveries for a courier
 */
export async function getCourierDeliveries(courierId, status = null) {
    let query = supabase
        .from('deliveries')
        .select(`
            *,
            pos_orders:order_id (
                id,
                table_name,
                total_amount,
                items,
                customer_name,
                customer_phone
            )
        `)
        .eq('courier_id', courierId)
        .order('created_at', { ascending: false });

    if (status) {
        if (Array.isArray(status)) {
            query = query.in('status', status);
        } else {
            query = query.eq('status', status);
        }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/**
 * Get pending deliveries (unassigned) for a tenant
 */
export async function getPendingDeliveries(tenantId) {
    const { data, error } = await supabase
        .from('deliveries')
        .select(`
            *,
            pos_orders:order_id (
                id,
                table_name,
                total_amount,
                items
            )
        `)
        .eq('tenant_id', tenantId)
        .is('courier_id', null)
        .eq('status', 'assigned')
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
}

/**
 * Accept a delivery
 */
export async function acceptDelivery(deliveryId, courierId) {
    const { data, error } = await supabase
        .from('deliveries')
        .update({
            courier_id: courierId,
            status: 'assigned',
            updated_at: new Date().toISOString()
        })
        .eq('id', deliveryId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update delivery status
 */
export async function updateDeliveryStatus(deliveryId, status, additionalData = {}) {
    const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
    };

    if (status === 'picked_up') {
        updateData.pickup_time = new Date().toISOString();
    } else if (status === 'delivered') {
        updateData.delivery_time = new Date().toISOString();
    }

    const { data, error } = await supabase
        .from('deliveries')
        .update(updateData)
        .eq('id', deliveryId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Upload delivery proof (photo)
 */
export async function uploadDeliveryProof(deliveryId, file, type = 'photo') {
    const fileName = `delivery_${deliveryId}_${type}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery-proofs')
        .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(fileName);

    // Update delivery with proof URL
    const updateField = type === 'photo' ? 'proof_photo_url' : 'proof_signature_url';

    const { error } = await supabase
        .from('deliveries')
        .update({ [updateField]: publicUrl })
        .eq('id', deliveryId);

    if (error) throw error;
    return publicUrl;
}

// ==================== EARNINGS ====================

/**
 * Get payment configuration for a tenant
 */
export async function getPaymentConfig(tenantId) {
    const { data, error } = await supabase
        .from('courier_payment_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Calculate earnings for a delivery
 */
export async function calculateDeliveryEarnings(delivery, config) {
    if (!config) return 15; // Default fallback

    let baseAmount = 0;
    let bonuses = [];

    // Calculate base amount
    switch (config.payment_model) {
        case 'per_package':
            baseAmount = parseFloat(config.base_rate_per_package) || 15;
            break;
        case 'per_km':
            const distance = delivery.distance_km || 2;
            const kmRate = parseFloat(config.base_rate_per_km) || 3;
            const minCharge = parseFloat(config.min_km_charge) || 10;
            baseAmount = Math.max(minCharge, distance * kmRate);
            break;
        case 'hybrid':
            const hybridBase = parseFloat(config.hybrid_base_fee) || 10;
            const hybridKm = parseFloat(config.hybrid_km_rate) || 2;
            const dist = delivery.distance_km || 2;
            baseAmount = hybridBase + (dist * hybridKm);
            break;
        default:
            baseAmount = 15;
    }

    // Calculate time-based bonuses
    const deliveryTime = new Date(delivery.created_at);
    const hour = deliveryTime.getHours();
    const isWeekend = [0, 6].includes(deliveryTime.getDay());

    // Peak hour bonus (12:00-14:00)
    if (hour >= 12 && hour < 14 && config.peak_hour_bonus) {
        bonuses.push({
            type: 'peak_hour',
            amount: parseFloat(config.peak_hour_bonus),
            label: 'Öğle Saati Bonusu'
        });
    }

    // Night bonus (22:00-06:00)
    if ((hour >= 22 || hour < 6) && config.night_bonus) {
        bonuses.push({
            type: 'night',
            amount: parseFloat(config.night_bonus),
            label: 'Gece Mesai Bonusu'
        });
    }

    // Weekend bonus
    if (isWeekend && config.weekend_bonus_percent) {
        const weekendBonus = baseAmount * (parseFloat(config.weekend_bonus_percent) / 100);
        bonuses.push({
            type: 'weekend',
            amount: weekendBonus,
            label: 'Hafta Sonu Bonusu'
        });
    }

    const totalBonuses = bonuses.reduce((sum, b) => sum + b.amount, 0);

    return {
        baseAmount,
        bonuses,
        totalBonuses,
        total: baseAmount + totalBonuses,
        paymentModel: config.payment_model
    };
}

/**
 * Record earnings for a delivery
 */
export async function recordDeliveryEarnings(courierId, delivery, earnings) {
    // Record base delivery earning
    const { error: baseError } = await supabase
        .from('courier_earnings')
        .insert({
            courier_id: courierId,
            tenant_id: delivery.tenant_id,
            delivery_id: delivery.id,
            earning_type: 'delivery',
            amount: earnings.baseAmount,
            distance_km: delivery.distance_km,
            payment_model: earnings.paymentModel,
            base_rate: earnings.baseAmount,
            status: 'pending'
        });

    if (baseError) throw baseError;

    // Record bonuses separately
    for (const bonus of earnings.bonuses) {
        await supabase
            .from('courier_earnings')
            .insert({
                courier_id: courierId,
                tenant_id: delivery.tenant_id,
                delivery_id: delivery.id,
                earning_type: `bonus_${bonus.type}`,
                amount: bonus.amount,
                notes: bonus.label,
                status: 'pending'
            });
    }

    // Record tip if any
    if (delivery.tip_amount > 0) {
        await supabase
            .from('courier_earnings')
            .insert({
                courier_id: courierId,
                tenant_id: delivery.tenant_id,
                delivery_id: delivery.id,
                earning_type: 'tip',
                amount: delivery.tip_amount,
                status: 'pending'
            });
    }

    // Update courier total earnings
    await supabase
        .from('courier_profiles')
        .update({
            total_earnings: supabase.rpc('increment', { x: earnings.total })
        })
        .eq('id', courierId);

    return true;
}

/**
 * Get courier earnings summary
 */
export async function getCourierEarnings(courierId, period = 'today') {
    let dateFilter;
    const now = new Date();

    switch (period) {
        case 'today':
            dateFilter = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            break;
        case 'week':
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            dateFilter = new Date(startOfWeek.setHours(0, 0, 0, 0)).toISOString();
            break;
        case 'month':
            dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            break;
        default:
            dateFilter = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    }

    const { data, error } = await supabase
        .from('courier_earnings')
        .select('*')
        .eq('courier_id', courierId)
        .gte('created_at', dateFilter);

    if (error) throw error;

    // Calculate summary
    const summary = {
        total: 0,
        deliveries: 0,
        tips: 0,
        bonuses: 0,
        breakdown: []
    };

    data.forEach(earning => {
        summary.total += parseFloat(earning.amount);

        if (earning.earning_type === 'delivery') {
            summary.deliveries += parseFloat(earning.amount);
        } else if (earning.earning_type === 'tip') {
            summary.tips += parseFloat(earning.amount);
        } else if (earning.earning_type.startsWith('bonus_')) {
            summary.bonuses += parseFloat(earning.amount);
        }
    });

    summary.breakdown = data;
    return summary;
}

/**
 * Get earnings history
 */
export async function getEarningsHistory(courierId, limit = 50) {
    const { data, error } = await supabase
        .from('courier_earnings')
        .select(`
            *,
            deliveries:delivery_id (
                customer_name,
                delivery_address
            )
        `)
        .eq('courier_id', courierId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// ==================== RATINGS ====================

/**
 * Submit delivery rating (customer side)
 */
export async function submitDeliveryRating(deliveryId, rating, feedback = {}) {
    const { data: delivery } = await supabase
        .from('deliveries')
        .select('courier_id, customer_phone')
        .eq('id', deliveryId)
        .single();

    if (!delivery) throw new Error('Teslimat bulunamadı');

    const { error } = await supabase
        .from('courier_ratings')
        .insert({
            delivery_id: deliveryId,
            courier_id: delivery.courier_id,
            customer_phone: delivery.customer_phone,
            rating: rating,
            feedback: feedback.comment,
            was_polite: feedback.wasPolite,
            was_on_time: feedback.wasOnTime,
            food_condition_ok: feedback.foodConditionOk
        });

    if (error) throw error;

    // Update delivery with rating
    await supabase
        .from('deliveries')
        .update({ delivery_rating: rating })
        .eq('id', deliveryId);

    return true;
}

/**
 * Get courier ratings
 */
export async function getCourierRatings(courierId, limit = 20) {
    const { data, error } = await supabase
        .from('courier_ratings')
        .select('*')
        .eq('courier_id', courierId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// ==================== ZONES ====================

/**
 * Get delivery zones for a tenant
 */
export async function getDeliveryZones(tenantId) {
    const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Check if location is in delivery zone
 */
export function isInDeliveryZone(lat, lng, zones) {
    for (const zone of zones) {
        if (zone.zone_type === 'radius') {
            const distance = calculateDistance(
                lat, lng,
                zone.center_lat, zone.center_lng
            );
            if (distance <= zone.radius_km) {
                return zone;
            }
        } else if (zone.zone_type === 'polygon' && zone.boundaries) {
            if (isPointInPolygon(lat, lng, zone.boundaries)) {
                return zone;
            }
        }
    }
    return null;
}

// ==================== UTILITIES ====================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Check if point is inside polygon
 */
function isPointInPolygon(lat, lng, polygon) {
    if (!polygon || !polygon.coordinates) return false;

    const coords = polygon.coordinates[0]; // GeoJSON format
    let inside = false;

    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const xi = coords[i][0], yi = coords[i][1];
        const xj = coords[j][0], yj = coords[j][1];

        if (((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * Format currency
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(amount);
}

/**
 * Get estimated delivery time based on distance
 */
export function getEstimatedTime(distanceKm, vehicleType = 'moto') {
    const speeds = {
        moto: 25, // km/h average in city
        car: 20,
        bike: 15,
        walker: 5
    };

    const speed = speeds[vehicleType] || 20;
    const minutes = Math.round((distanceKm / speed) * 60);

    return Math.max(5, minutes); // Minimum 5 minutes
}

export default {
    getCourierProfile,
    upsertCourierProfile,
    updateCourierStatus,
    updateCourierLocation,
    getCourierDeliveries,
    getPendingDeliveries,
    acceptDelivery,
    updateDeliveryStatus,
    uploadDeliveryProof,
    getPaymentConfig,
    calculateDeliveryEarnings,
    recordDeliveryEarnings,
    getCourierEarnings,
    getEarningsHistory,
    submitDeliveryRating,
    getCourierRatings,
    getDeliveryZones,
    isInDeliveryZone,
    calculateDistance,
    formatCurrency,
    getEstimatedTime
};
