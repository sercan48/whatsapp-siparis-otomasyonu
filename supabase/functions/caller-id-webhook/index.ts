// Caller ID Webhook - Telsam, Netgsm VoIP, Mobile App Integration
// Receives incoming call notifications and pushes to realtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface IncomingCall {
    callerPhone: string;
    lineNumber?: string;
    callTime?: string;
    callDuration?: number;
    callStatus?: string;
}

// Format phone number to standard format
function formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");

    // Add country code if missing
    if (cleaned.startsWith("0")) {
        cleaned = "90" + cleaned.substring(1);
    } else if (!cleaned.startsWith("90") && cleaned.length === 10) {
        cleaned = "90" + cleaned;
    }

    return "+" + cleaned;
}

// Find customer by phone number
async function findCustomer(tenantId: string, phone: string) {
    const formattedPhone = formatPhoneNumber(phone);

    // Try multiple phone formats
    const phoneVariants = [
        formattedPhone,
        formattedPhone.replace("+90", "0"),
        formattedPhone.replace("+", ""),
        phone,
    ];

    const { data } = await supabase
        .from("customers")
        .select("id, name, phone, default_address, loyalty_points_balance, total_orders")
        .eq("tenant_id", tenantId)
        .in("phone", phoneVariants)
        .limit(1)
        .single();

    return data;
}

// Get tenant by webhook secret
async function getTenantByWebhookSecret(secret: string) {
    const { data } = await supabase
        .from("caller_id_settings")
        .select("tenant_id, is_active, provider, auto_popup, auto_create_customer")
        .eq("webhook_secret", secret)
        .eq("is_active", true)
        .single();

    return data;
}

// Get tenant by API credentials (for query-based auth)
async function getTenantByCredentials(username: string, password: string) {
    const { data } = await supabase
        .from("caller_id_settings")
        .select("tenant_id, is_active, provider, auto_popup, auto_create_customer")
        .eq("api_username", username)
        .eq("api_password", password)
        .eq("is_active", true)
        .single();

    return data;
}

// Create or update incoming call record
async function recordIncomingCall(
    tenantId: string,
    call: IncomingCall,
    customer: any
) {
    const record = {
        tenant_id: tenantId,
        caller_phone: formatPhoneNumber(call.callerPhone),
        line_number: call.lineNumber,
        call_time: call.callTime || new Date().toISOString(),
        call_duration: call.callDuration,
        call_status: call.callStatus || "ringing",
        customer_id: customer?.id,
        customer_name: customer?.name,
        customer_address: customer?.default_address,
        is_new_customer: !customer,
        handled: false,
    };

    const { data, error } = await supabase
        .from("incoming_calls")
        .insert(record)
        .select()
        .single();

    if (error) {
        console.error("Failed to record call:", error);
    }

    return data;
}

// Get recent orders for customer
async function getRecentOrders(tenantId: string, customerId: string) {
    if (!customerId) return [];

    const { data } = await supabase
        .from("orders")
        .select("id, created_at, total, status, items:order_items(name, quantity)")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(3);

    return data || [];
}

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    try {
        // ================================================
        // POST /telsam - Telsam Sanal Santral Webhook
        // ================================================
        if (req.method === "POST" && path === "telsam") {
            // Telsam sends call data as form data or JSON
            let callData: any;

            const contentType = req.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                callData = await req.json();
            } else {
                const formData = await req.formData();
                callData = Object.fromEntries(formData);
            }

            console.log("Telsam Webhook Data:", callData);

            // Telsam sends: caller (arayan), called (aranan), duration, status, callid
            const callerPhone = callData.caller || callData.from || callData.callerid;
            const lineNumber = callData.called || callData.to || callData.did;
            const callStatus = callData.status || callData.event;
            const duration = parseInt(callData.duration) || 0;

            if (!callerPhone) {
                return new Response(
                    JSON.stringify({ error: "No caller phone provided" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Get tenant from webhook secret (header or query)
            const webhookSecret = req.headers.get("x-webhook-secret") ||
                url.searchParams.get("secret");

            if (!webhookSecret) {
                return new Response(
                    JSON.stringify({ error: "No webhook secret provided" }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const settings = await getTenantByWebhookSecret(webhookSecret);
            if (!settings) {
                return new Response(
                    JSON.stringify({ error: "Invalid webhook secret" }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Find customer
            const customer = await findCustomer(settings.tenant_id, callerPhone);

            // Get recent orders if customer exists
            const recentOrders = customer ?
                await getRecentOrders(settings.tenant_id, customer.id) : [];

            // Record call
            const callRecord = await recordIncomingCall(
                settings.tenant_id,
                {
                    callerPhone,
                    lineNumber,
                    callStatus,
                    callDuration: duration
                },
                customer
            );

            // The frontend will receive this via realtime subscription to incoming_calls table

            return new Response(
                JSON.stringify({
                    success: true,
                    call_id: callRecord?.id,
                    customer: customer ? {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                        address: customer.default_address,
                        loyalty_points: customer.loyalty_points_balance,
                        total_orders: customer.total_orders,
                    } : null,
                    recent_orders: recentOrders,
                    is_new_customer: !customer,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ================================================
        // POST /netgsm - Netgsm VoIP Webhook
        // ================================================
        if (req.method === "POST" && path === "netgsm") {
            // Netgsm VoIP webhook format
            const callData = await req.json();

            console.log("Netgsm Webhook Data:", callData);

            const callerPhone = callData.caller || callData.from_number;
            const lineNumber = callData.to_number || callData.did;
            const callStatus = callData.status;

            if (!callerPhone) {
                return new Response(
                    JSON.stringify({ error: "No caller phone provided" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Auth via query params or header
            const username = url.searchParams.get("username") || req.headers.get("x-api-username");
            const password = url.searchParams.get("password") || req.headers.get("x-api-password");
            const webhookSecret = req.headers.get("x-webhook-secret") || url.searchParams.get("secret");

            let settings;
            if (webhookSecret) {
                settings = await getTenantByWebhookSecret(webhookSecret);
            } else if (username && password) {
                settings = await getTenantByCredentials(username, password);
            }

            if (!settings) {
                return new Response(
                    JSON.stringify({ error: "Authentication failed" }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const customer = await findCustomer(settings.tenant_id, callerPhone);
            const recentOrders = customer ?
                await getRecentOrders(settings.tenant_id, customer.id) : [];

            const callRecord = await recordIncomingCall(
                settings.tenant_id,
                { callerPhone, lineNumber, callStatus },
                customer
            );

            return new Response(
                JSON.stringify({
                    success: true,
                    call_id: callRecord?.id,
                    customer: customer,
                    recent_orders: recentOrders,
                    is_new_customer: !customer,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ================================================
        // POST /mobile - Mobile Caller ID App Push
        // ================================================
        if (req.method === "POST" && path === "mobile") {
            const { tenant_id, caller_phone, api_key } = await req.json();

            if (!tenant_id || !caller_phone) {
                return new Response(
                    JSON.stringify({ error: "tenant_id and caller_phone are required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Verify tenant has caller ID enabled
            const { data: settings } = await supabase
                .from("caller_id_settings")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("is_active", true)
                .single();

            if (!settings) {
                return new Response(
                    JSON.stringify({ error: "Caller ID not enabled for this tenant" }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Verify API key if provided
            if (settings.api_key && settings.api_key !== api_key) {
                return new Response(
                    JSON.stringify({ error: "Invalid API key" }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const customer = await findCustomer(tenant_id, caller_phone);
            const recentOrders = customer ?
                await getRecentOrders(tenant_id, customer.id) : [];

            const callRecord = await recordIncomingCall(
                tenant_id,
                { callerPhone: caller_phone, callStatus: "ringing" },
                customer
            );

            return new Response(
                JSON.stringify({
                    success: true,
                    call_id: callRecord?.id,
                    customer: customer,
                    recent_orders: recentOrders,
                    is_new_customer: !customer,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ================================================
        // POST /handle - Mark call as handled
        // ================================================
        if (req.method === "POST" && path === "handle") {
            const { call_id, handled_by, created_order_id, notes } = await req.json();

            if (!call_id) {
                return new Response(
                    JSON.stringify({ error: "call_id is required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const { data, error } = await supabase
                .from("incoming_calls")
                .update({
                    handled: true,
                    handled_by,
                    handled_at: new Date().toISOString(),
                    created_order_id,
                    notes,
                })
                .eq("id", call_id)
                .select()
                .single();

            if (error) {
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({ success: true, call: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ================================================
        // GET /recent - Get recent calls for tenant
        // ================================================
        if (req.method === "GET" && path === "recent") {
            const tenantId = url.searchParams.get("tenant_id");
            const limit = parseInt(url.searchParams.get("limit") || "20");

            if (!tenantId) {
                return new Response(
                    JSON.stringify({ error: "tenant_id is required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const { data, error } = await supabase
                .from("incoming_calls")
                .select("*")
                .eq("tenant_id", tenantId)
                .order("call_time", { ascending: false })
                .limit(limit);

            return new Response(
                JSON.stringify({ calls: data || [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: "Not found", endpoints: ["/telsam", "/netgsm", "/mobile", "/handle", "/recent"] }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Caller ID Webhook Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
