// SMS Sender Edge Function - Netgsm Integration
// Supports: Single SMS, Bulk SMS, Template-based SMS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Netgsm API Configuration
const NETGSM_API_URL = "https://api.netgsm.com.tr/sms/send/get";
const NETGSM_BALANCE_URL = "https://api.netgsm.com.tr/balance/list/get";

interface SMSRequest {
    tenant_id: string;
    phone: string;
    message?: string;
    template_id?: string;
    trigger_type?: string;
    variables?: Record<string, string>;
    order_id?: string;
    customer_id?: string;
}

interface BulkSMSRequest {
    tenant_id: string;
    phones: string[];
    message: string;
}

// Format phone number for Netgsm (must be 10 digits starting with 5)
function formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, "");

    // Remove country code if present
    if (cleaned.startsWith("90")) {
        cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith("+90")) {
        cleaned = cleaned.substring(3);
    }

    // Remove leading 0 if present
    if (cleaned.startsWith("0")) {
        cleaned = cleaned.substring(1);
    }

    return cleaned;
}

// Replace template variables
function processTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    return result;
}

// Get SMS settings for tenant
async function getSMSSettings(tenantId: string) {
    const { data, error } = await supabase
        .from("sms_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

    if (error || !data) {
        throw new Error("SMS settings not found for this tenant");
    }

    if (!data.is_active) {
        throw new Error("SMS service is disabled for this tenant");
    }

    return data;
}

// Get template by trigger type
async function getTemplate(tenantId: string, triggerType: string) {
    const { data, error } = await supabase
        .from("sms_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("trigger_type", triggerType)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .single();

    return data;
}

// Send SMS via Netgsm API
async function sendNetgsmSMS(
    settings: any,
    phone: string,
    message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const formattedPhone = formatPhoneNumber(phone);

    if (formattedPhone.length !== 10 || !formattedPhone.startsWith("5")) {
        return { success: false, error: "Invalid phone number format" };
    }

    const params = new URLSearchParams({
        usercode: settings.api_username,
        password: settings.api_password,
        gsmno: formattedPhone,
        message: message,
        msgheader: settings.sender_title || "BILGILENDIRME",
        filter: "0",
        startdate: "",
        stopdate: "",
    });

    try {
        const response = await fetch(`${NETGSM_API_URL}?${params.toString()}`);
        const result = await response.text();

        console.log("Netgsm Response:", result);

        // Netgsm returns codes like "00 123456789" for success
        // or error codes like "30" for invalid credentials
        const parts = result.split(" ");
        const code = parts[0];

        if (code === "00" || code === "01" || code === "02") {
            return { success: true, messageId: parts[1] || result };
        } else {
            const errorMessages: Record<string, string> = {
                "20": "Mesaj metni boş",
                "30": "Geçersiz kullanıcı adı/şifre",
                "40": "Mesaj başlığı tanımlı değil",
                "50": "Abone hesabı yok",
                "51": "Yetersiz bakiye",
                "70": "Parametre hatası",
                "80": "Sorgu limitine ulaşıldı",
                "85": "Mükerrer gönderim",
            };
            return { success: false, error: errorMessages[code] || `Netgsm Error: ${code}` };
        }
    } catch (error) {
        console.error("Netgsm API Error:", error);
        return { success: false, error: error.message };
    }
}

// Check SMS balance
async function checkBalance(settings: any): Promise<number> {
    const params = new URLSearchParams({
        usercode: settings.api_username,
        password: settings.api_password,
        stession: "1", // 1 = only SMS balance
    });

    try {
        const response = await fetch(`${NETGSM_BALANCE_URL}?${params.toString()}`);
        const result = await response.text();

        // Returns like "100" for balance or error code
        const balance = parseInt(result);
        return isNaN(balance) ? 0 : balance;
    } catch (error) {
        console.error("Balance check error:", error);
        return 0;
    }
}

// Log SMS to database
async function logSMS(
    tenantId: string,
    phone: string,
    message: string,
    result: { success: boolean; messageId?: string; error?: string },
    options: { templateId?: string; triggerType?: string; orderId?: string; customerId?: string }
) {
    await supabase.from("sms_logs").insert({
        tenant_id: tenantId,
        phone: phone,
        message: message,
        template_id: options.templateId,
        trigger_type: options.triggerType,
        order_id: options.orderId,
        customer_id: options.customerId,
        status: result.success ? "sent" : "failed",
        provider_message_id: result.messageId,
        error_message: result.error,
        sent_at: result.success ? new Date().toISOString() : null,
        sms_count: Math.ceil(message.length / 160), // SMS'ler 160 karakterlik parçalar
    });
}

serve(async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    try {
        // POST /send - Send single SMS
        if (req.method === "POST" && path === "send") {
            const body: SMSRequest = await req.json();

            if (!body.tenant_id || !body.phone) {
                return new Response(
                    JSON.stringify({ error: "tenant_id and phone are required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Get settings
            const settings = await getSMSSettings(body.tenant_id);

            // Get message
            let message = body.message;
            let templateId: string | undefined;

            // If trigger_type is provided, use template
            if (body.trigger_type && !message) {
                const template = await getTemplate(body.tenant_id, body.trigger_type);
                if (template) {
                    message = processTemplate(template.template_text, body.variables || {});
                    templateId = template.id;
                }
            }

            if (!message) {
                return new Response(
                    JSON.stringify({ error: "Message or valid trigger_type is required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Send SMS
            const result = await sendNetgsmSMS(settings, body.phone, message);

            // Log
            await logSMS(body.tenant_id, body.phone, message, result, {
                templateId,
                triggerType: body.trigger_type,
                orderId: body.order_id,
                customerId: body.customer_id,
            });

            return new Response(
                JSON.stringify(result),
                {
                    status: result.success ? 200 : 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        // POST /bulk - Send bulk SMS
        if (req.method === "POST" && path === "bulk") {
            const body: BulkSMSRequest = await req.json();

            if (!body.tenant_id || !body.phones || !body.message) {
                return new Response(
                    JSON.stringify({ error: "tenant_id, phones array, and message are required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const settings = await getSMSSettings(body.tenant_id);

            const results = await Promise.all(
                body.phones.map(async (phone) => {
                    const result = await sendNetgsmSMS(settings, phone, body.message);
                    await logSMS(body.tenant_id, phone, body.message, result, {
                        triggerType: "campaign",
                    });
                    return { phone, ...result };
                })
            );

            const successCount = results.filter(r => r.success).length;

            return new Response(
                JSON.stringify({
                    total: results.length,
                    success: successCount,
                    failed: results.length - successCount,
                    results
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // GET /balance - Check SMS balance
        if (req.method === "GET" && path === "balance") {
            const tenantId = url.searchParams.get("tenant_id");

            if (!tenantId) {
                return new Response(
                    JSON.stringify({ error: "tenant_id is required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const settings = await getSMSSettings(tenantId);
            const balance = await checkBalance(settings);

            // Update balance in settings
            await supabase
                .from("sms_settings")
                .update({
                    sms_balance: balance,
                    last_balance_check: new Date().toISOString()
                })
                .eq("tenant_id", tenantId);

            return new Response(
                JSON.stringify({ balance }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // POST /order-status - Triggered by order status change
        if (req.method === "POST" && path === "order-status") {
            const { tenant_id, order_id, new_status, customer_phone, customer_name, order_total, eta } = await req.json();

            if (!tenant_id || !order_id || !new_status || !customer_phone) {
                return new Response(
                    JSON.stringify({ error: "Missing required fields" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Get settings and check if auto SMS is enabled for this status
            const settings = await getSMSSettings(tenant_id);

            const statusToSetting: Record<string, string> = {
                "pending": "auto_order_received",
                "preparing": "auto_order_preparing",
                "on_way": "auto_order_on_way",
                "delivered": "auto_order_delivered",
                "cancelled": "auto_order_cancelled",
            };

            const settingKey = statusToSetting[new_status];
            if (!settingKey || !settings[settingKey]) {
                return new Response(
                    JSON.stringify({ skipped: true, reason: "Auto SMS disabled for this status" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Map status to trigger type
            const triggerType = `order_${new_status}`;
            const template = await getTemplate(tenant_id, triggerType);

            if (!template) {
                return new Response(
                    JSON.stringify({ skipped: true, reason: "No template found" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Process template
            const message = processTemplate(template.template_text, {
                name: customer_name || "Değerli Müşterimiz",
                order_no: order_id.slice(-8).toUpperCase(),
                total: order_total?.toString() || "",
                eta: eta?.toString() || "15-20",
            });

            // Send SMS
            const result = await sendNetgsmSMS(settings, customer_phone, message);

            // Log
            await logSMS(tenant_id, customer_phone, message, result, {
                templateId: template.id,
                triggerType,
                orderId: order_id,
            });

            return new Response(
                JSON.stringify(result),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: "Not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("SMS Sender Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
