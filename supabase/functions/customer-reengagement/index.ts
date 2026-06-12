// customer-reengagement Edge Function
// Runs daily to find inactive customers and send re-engagement messages

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Configuration
const INACTIVE_DAYS_MIN = 20;  // Start checking after 20 days
const INACTIVE_DAYS_MAX = 25;  // Stop before 25 days (to stay within window)

interface InactiveCustomer {
    id: string;
    phone: string;
    name: string;
    tenant_id: string;
    last_order_date: string;
    days_inactive: number;
}

// Send WhatsApp Template Message
async function sendTemplateMessage(to: string, templateName: string, params: string[]) {
    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
            name: templateName,
            language: { code: "tr" },
            components: [
                {
                    type: "body",
                    parameters: params.map((p: string) => ({ type: "text", text: p }))
                }
            ]
        }
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    return response.ok;
}

// Database record type from Supabase
interface CustomerRecord {
    id: string;
    phone: string;
    name: string;
    tenant_id: string;
    last_order_date: string;
}

// Check if already sent re-engagement message recently
async function wasRecentlySent(customerId: string, tenantId: string): Promise<boolean> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
        .from('reengagement_logs')
        .select('id')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .gte('sent_at', thirtyDaysAgo)
        .limit(1);

    return (data?.length || 0) > 0;
}

// Log the sent message
async function logReengagement(customerId: string, tenantId: string, messageType: string) {
    await supabase
        .from('reengagement_logs')
        .insert({
            customer_id: customerId,
            tenant_id: tenantId,
            message_type: messageType,
            sent_at: new Date().toISOString()
        });
}

// Get inactive customers
async function getInactiveCustomers(): Promise<InactiveCustomer[]> {
    const minDate = new Date(Date.now() - INACTIVE_DAYS_MAX * 24 * 60 * 60 * 1000).toISOString();
    const maxDate = new Date(Date.now() - INACTIVE_DAYS_MIN * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('customers')
        .select('id, phone, name, tenant_id, last_order_date')
        .gte('last_order_date', minDate)
        .lte('last_order_date', maxDate)
        .eq('is_blacklisted', false)
        .not('phone', 'is', null);

    if (error || !data) {
        console.error("Error fetching customers:", error);
        return [];
    }

    return data.map((c: CustomerRecord) => ({
        ...c,
        days_inactive: Math.floor((Date.now() - new Date(c.last_order_date).getTime()) / (24 * 60 * 60 * 1000))
    }));
}

// Get tenant campaign settings
async function getTenantCampaign(tenantId: string) {
    const { data } = await supabase
        .from('tenants')
        .select('business_name, reengagement_template, reengagement_discount')
        .eq('id', tenantId)
        .single();

    return {
        businessName: data?.business_name || 'Restoran',
        template: data?.reengagement_template || 'customer_reengagement', // Meta template name
        discount: data?.reengagement_discount || 'OZLEDIK10'
    };
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("Starting customer re-engagement check...");

        // Get inactive customers (20-25 days)
        const inactiveCustomers = await getInactiveCustomers();
        console.log(`Found ${inactiveCustomers.length} inactive customers`);

        let sentCount = 0;
        let skippedCount = 0;

        for (const customer of inactiveCustomers) {
            // Check if already sent recently
            const alreadySent = await wasRecentlySent(customer.id, customer.tenant_id);
            if (alreadySent) {
                skippedCount++;
                continue;
            }

            // Get tenant campaign settings
            const campaign = await getTenantCampaign(customer.tenant_id);

            // Send template message
            // Template parameters: {{1}}=header, {{2}}=days, {{3}}=discount
            const success = await sendTemplateMessage(
                customer.phone,
                campaign.template,
                [
                    '🔥 Size Özel Fırsat',           // {{1}} Header
                    customer.days_inactive.toString(), // {{2}} Days
                    campaign.discount                  // {{3}} Discount code
                ]
            );

            if (success) {
                await logReengagement(customer.id, customer.tenant_id, 'reengagement_25day');
                sentCount++;
                console.log(`Sent to ${customer.phone}`);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total_inactive: inactiveCustomers.length,
            sent: sentCount,
            skipped: skippedCount,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: unknown) {
        const err = error as Error;
        console.error("Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
