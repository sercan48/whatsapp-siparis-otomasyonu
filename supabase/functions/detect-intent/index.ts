import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { message } = await req.json();

        if (!message) {
            throw new Error("Message is required");
        }

        // 1. Basic Normalization
        const text = message.toLowerCase().trim();

        // 2. Intent Detection Logic (Regex Patterns)
        const intents = {
            order: /(siparis|istiyorum|alabilir miyim|gonder|yolla|menu)/i,
            cancel: /(iptal|vazgec|sil|bosalt)/i,
            address: /(mahalle|sokak|cadde|no:|daire:|blok|kat)/i,
            support: /(yardim|destek|sorun|problem|canli)/i,
        };

        let detectedIntent = "unknown";
        let confident = false;

        // Check intents
        if (intents.cancel.test(text)) {
            detectedIntent = "cancel_order";
            confident = true;
        } else if (intents.address.test(text)) {
            detectedIntent = "provide_address";
            confident = true;
        } else if (intents.order.test(text)) {
            detectedIntent = "new_order";
            confident = true;
        } else if (intents.support.test(text)) {
            detectedIntent = "request_support";
            confident = true;
        }

        // 3. Entity Extraction (Basic)
        const entities = {
            quantity: text.match(/\d+/) ? parseInt(text.match(/\d+/)[0]) : null,
            product_mentions: [], // Requires a product list to match against
        };

        // 4. Return Structured Data
        return new Response(
            JSON.stringify({
                original_text: message,
                intent: detectedIntent,
                confidence: confident ? 0.9 : 0.3,
                entities: entities,
                is_chat: true, // Marker for Phase 3
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
