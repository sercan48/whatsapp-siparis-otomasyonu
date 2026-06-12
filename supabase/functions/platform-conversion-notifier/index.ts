import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Platform Conversion Notifier
 * Sends WhatsApp message to customers after their platform order is delivered
 * Invites them to order directly for discount next time
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversionSettings {
    is_enabled: boolean;
    discount_percentage: number;
    message_template: string;
    resend_after_days: number;
    daily_message_limit: number;
    messages_sent_today: number;
}

interface PlatformOrder {
    id: string;
    tenant_id: string;
    customer_phone: string;
    customer_name: string;
    platform_code: string;
    status: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
        const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

        const { orderId, tenantId, action } = await req.json();

        // Handle different actions
        if (action === "process_delivered") {
            return await processDeliveredOrder(supabase, orderId, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID);
        } else if (action === "check_pending") {
            return await checkPendingOrders(supabase, tenantId, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID);
        }

        return new Response(
            JSON.stringify({ error: "Invalid action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        console.error("Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function processDeliveredOrder(
    supabase: ReturnType<typeof createClient>,
    orderId: string,
    whatsappToken: string | undefined,
    phoneId: string | undefined
) {
    // 1. Get order details
    const { data: order, error: orderError } = await supabase
        .from("external_platform_orders")
        .select("id, tenant_id, customer_phone, customer_name, platform_code, status")
        .eq("id", orderId)
        .single();

    if (orderError || !order) {
        return new Response(
            JSON.stringify({ error: "Order not found" }),
            { status: 404, headers: corsHeaders }
        );
    }

    // 2. Check if conversion is enabled for this tenant
    const { data: settings } = await supabase
        .from("conversion_settings")
        .select("*")
        .eq("tenant_id", order.tenant_id)
        .single();

    if (!settings?.is_enabled) {
        return new Response(
            JSON.stringify({ skipped: true, reason: "Conversion not enabled" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // 3. Check daily limit
    if (settings.messages_sent_today >= settings.daily_message_limit) {
        return new Response(
            JSON.stringify({ skipped: true, reason: "Daily limit reached" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // 4. Check if we already messaged this customer
    const { data: existing } = await supabase
        .from("platform_customer_conversions")
        .select("id, message_sent_at")
        .eq("tenant_id", order.tenant_id)
        .eq("customer_phone", order.customer_phone)
        .single();

    if (existing?.message_sent_at) {
        // Check resend policy
        if (settings.resend_after_days === 0) {
            return new Response(
                JSON.stringify({ skipped: true, reason: "Already messaged, no resend" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const lastSent = new Date(existing.message_sent_at);
        const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince < settings.resend_after_days) {
            return new Response(
                JSON.stringify({ skipped: true, reason: `Resend after ${settings.resend_after_days} days` }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
    }

    // 5. Get tenant info for message
    const { data: tenant } = await supabase
        .from("profiles")
        .select("company_name, slug, whatsapp_number")
        .eq("id", order.tenant_id)
        .single();

    if (!tenant?.slug) {
        return new Response(
            JSON.stringify({ error: "Tenant slug not configured" }),
            { status: 400, headers: corsHeaders }
        );
    }

    // 6. Build message
    const menuUrl = `https://yourdomain.com/m/${tenant.slug}`; // Replace with actual domain
    const message = settings.message_template
        .replace("{discount}", settings.discount_percentage.toString())
        .replace("{menu_url}", menuUrl)
        .replace("{restaurant_name}", tenant.company_name || "");

    // 7. Send WhatsApp message
    const sent = await sendWhatsAppMessage(
        order.customer_phone,
        message,
        whatsappToken,
        phoneId
    );

    if (sent) {
        // 8. Record the conversion attempt
        await supabase
            .from("platform_customer_conversions")
            .upsert({
                tenant_id: order.tenant_id,
                customer_phone: order.customer_phone,
                customer_name: order.customer_name,
                platform_code: order.platform_code,
                first_order_id: existing ? undefined : order.id,
                total_platform_orders: existing ?
                    (await incrementOrderCount(supabase, existing.id)) : 1,
                message_sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: "tenant_id,customer_phone" });

        // 9. Increment daily counter
        await supabase
            .from("conversion_settings")
            .update({
                messages_sent_today: settings.messages_sent_today + 1,
                updated_at: new Date().toISOString()
            })
            .eq("tenant_id", order.tenant_id);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Conversion message sent",
                phone: order.customer_phone
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message" }),
        { status: 500, headers: corsHeaders }
    );
}

async function checkPendingOrders(
    supabase: ReturnType<typeof createClient>,
    tenantId: string,
    whatsappToken: string | undefined,
    phoneId: string | undefined
) {
    // Find delivered orders not yet processed
    const { data: orders } = await supabase
        .from("external_platform_orders")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "delivered")
        .is("conversion_processed", null)
        .limit(10);

    if (!orders?.length) {
        return new Response(
            JSON.stringify({ processed: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    let processed = 0;
    for (const order of orders) {
        const result = await processDeliveredOrder(supabase, order.id, whatsappToken, phoneId);
        if (result.ok) processed++;

        // Mark as processed
        await supabase
            .from("external_platform_orders")
            .update({ conversion_processed: true })
            .eq("id", order.id);
    }

    return new Response(
        JSON.stringify({ processed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}

async function sendWhatsAppMessage(
    phone: string,
    message: string,
    token: string | undefined,
    phoneId: string | undefined
): Promise<boolean> {
    if (!token || !phoneId) {
        console.error("WhatsApp credentials not configured");
        return false;
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "90" + normalizedPhone.substring(1);
    }
    if (!normalizedPhone.startsWith("90")) {
        normalizedPhone = "90" + normalizedPhone;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${phoneId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: normalizedPhone,
                    type: "text",
                    text: { body: message }
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("WhatsApp API error:", errorData);
            return false;
        }

        console.log(`Message sent to ${normalizedPhone}`);
        return true;
    } catch (error) {
        console.error("WhatsApp send error:", error);
        return false;
    }
}

async function incrementOrderCount(
    supabase: ReturnType<typeof createClient>,
    conversionId: string
): Promise<number> {
    const { data } = await supabase
        .from("platform_customer_conversions")
        .select("total_platform_orders")
        .eq("id", conversionId)
        .single();

    return (data?.total_platform_orders || 0) + 1;
}
