// order-status-notifier Edge Function
// Sends WhatsApp notifications when order status changes

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

// Status message templates
const STATUS_MESSAGES: Record<string, { emoji: string; message: string }> = {
    "confirmed": {
        emoji: "✅",
        message: "Ödemeniz alındı! Siparişiniz onaylandı ve hazırlanmaya başlıyor."
    },
    "preparing": {
        emoji: "👨‍🍳",
        message: "Siparişiniz hazırlanmaya başladı! Tahmini süre: 15-20 dk."
    },
    "ready": {
        emoji: "✅",
        message: "Siparişiniz hazır! Kurye yola çıkmak üzere."
    },
    "delivering": {
        emoji: "🚀",
        message: "Siparişiniz yola çıktı!"
    },
    "completed": {
        emoji: "🎉",
        message: "Siparişiniz teslim edildi! Afiyet olsun! 🍔\n\nBizi değerlendirir misiniz?"
    },
    "delivered": {
        emoji: "🎉",
        message: "Siparişiniz teslim edildi! Afiyet olsun! 🍔\n\nBizi değerlendirir misiniz?"
    }
};

async function sendWhatsAppMessage(to: string, text: string) {
    await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: text }
        })
    });
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { order_id, new_status, tracking_url } = await req.json();

        if (!order_id || !new_status) {
            return new Response(JSON.stringify({ error: "Missing order_id or new_status" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Get order details - try 'orders' first, then 'pos_orders'
        let order;
        let error;

        // Try digital menu orders table first
        const { data: digitalOrder, error: digitalError } = await supabase
            .from('orders')
            .select('id, customer_phone, customer_name, total')
            .eq('id', order_id)
            .single();

        if (digitalOrder) {
            order = digitalOrder;
        } else {
            // Try POS orders table
            const { data: posOrder, error: posError } = await supabase
                .from('pos_orders')
                .select('id, customer_phone, customer_name, total')
                .eq('id', order_id)
                .single();

            order = posOrder;
            error = posError;
        }

        if (!order) {
            return new Response(JSON.stringify({ error: "Order not found in either table" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Skip if no customer phone (POS orders without WhatsApp)
        if (!order.customer_phone) {
            return new Response(JSON.stringify({ message: "No customer phone, skipping" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Get status message template
        const template = STATUS_MESSAGES[new_status];
        if (!template) {
            return new Response(JSON.stringify({ message: "No notification for this status" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Build message
        let message = `${template.emoji} *Sipariş Güncellendi*\n\n${template.message}`;

        // Add tracking URL for delivering status
        if (new_status === "delivering" && tracking_url) {
            message += `\n\n📍 *Takip Linki:*\n${tracking_url}`;
        }

        // Add order summary
        message += `\n\n💰 Sipariş Tutarı: ${order.total} TL`;

        // Send notification
        await sendWhatsAppMessage(order.customer_phone, message);

        return new Response(JSON.stringify({
            success: true,
            message: `Notification sent for status: ${new_status}`
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
