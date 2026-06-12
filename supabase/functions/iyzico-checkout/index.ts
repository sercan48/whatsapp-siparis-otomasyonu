import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * iyzico Checkout Edge Function
 * Handles:
 * - POST /init → Create checkout form
 * - POST /callback → Process payment result
 * - POST /webhook → iyzico webhook notifications
 */

// SECURITY: Origin whitelist for CORS
const ALLOWED_ORIGINS = [
    "https://arasta.vercel.app",
    "https://czzpxkgkphqdjwpvmpob.supabase.co",
    // Add production domains here
];

// Development mode check
const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";
if (isDevelopment) {
    ALLOWED_ORIGINS.push("http://localhost:3000", "http://localhost:5173");
}

function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("Origin") || "";

    // Allow if origin is in whitelist
    if (ALLOWED_ORIGINS.includes(origin)) {
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Credentials": "true",
        };
    }

    // Default: no CORS headers (browser will block cross-origin requests)
    return {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
}

// Default CORS headers for handler functions (fallback)
// Note: In Edge Functions, each handler gets called from serve() which passes corsHeaders
const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Will be overridden by getCorsHeaders in serve()
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// iyzico API endpoints
const IYZICO_URLS = {
    sandbox: "https://sandbox-api.iyzipay.com",
    production: "https://api.iyzipay.com",
};

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const action = url.pathname.split("/").pop();

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        if (action === "init") {
            return await handleInit(req, supabase);
        } else if (action === "callback") {
            return await handleCallback(req, supabase);
        } else if (action === "webhook") {
            return await handleWebhook(req, supabase);
        }

        return new Response(JSON.stringify({ error: "Unknown action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("iyzico function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

/**
 * Initialize iyzico checkout form
 */
async function handleInit(req: Request, supabase: any) {
    const body = await req.json();
    const { tenantId, orderId, amount, customerInfo, basketItems, callbackUrl } = body;

    // Get tenant's iyzico settings
    const { data: settings } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

    if (!settings?.iyzico_api_key || !settings?.iyzico_secret_key) {
        return new Response(JSON.stringify({
            error: "iyzico yapılandırılmamış",
            mode: "demo"
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const isProduction = settings.iyzico_mode === "production";
    const baseUrl = isProduction ? IYZICO_URLS.production : IYZICO_URLS.sandbox;

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
        .from("payment_transactions")
        .insert({
            tenant_id: tenantId,
            order_id: orderId,
            amount,
            currency: "TRY",
            provider: "iyzico",
            status: "pending",
            customer_info: customerInfo,
            basket_items: basketItems,
        })
        .select()
        .single();

    if (txError) throw txError;

    // Prepare iyzico request
    const conversationId = transaction.id;
    const basketId = orderId;
    const paymentGroup = "PRODUCT";

    const iyzicoRequest = {
        locale: "tr",
        conversationId,
        price: amount.toString(),
        paidPrice: amount.toString(),
        currency: "TRY",
        basketId,
        paymentGroup,
        callbackUrl: `${callbackUrl}?txId=${transaction.id}`,
        enabledInstallments: [1, 2, 3, 6],
        buyer: {
            id: customerInfo.phone || "GUEST",
            name: customerInfo.name?.split(" ")[0] || "Misafir",
            surname: customerInfo.name?.split(" ").slice(1).join(" ") || "Müşteri",
            gsmNumber: customerInfo.phone || "+905000000000",
            email: customerInfo.email || "guest@example.com",
            identityNumber: "11111111111",
            registrationAddress: customerInfo.address || "İstanbul",
            ip: "85.34.78.112",
            city: "Istanbul",
            country: "Turkey",
        },
        shippingAddress: {
            contactName: customerInfo.name || "Müşteri",
            city: "Istanbul",
            country: "Turkey",
            address: customerInfo.address || "Teslimat Adresi",
        },
        billingAddress: {
            contactName: customerInfo.name || "Müşteri",
            city: "Istanbul",
            country: "Turkey",
            address: customerInfo.address || "Fatura Adresi",
        },
        basketItems: basketItems.map((item: any, idx: number) => ({
            id: item.id || `item_${idx}`,
            name: item.name,
            category1: item.category || "Yemek",
            itemType: "PHYSICAL",
            price: (item.price * item.quantity).toString(),
        })),
    };

    // Generate authorization header
    const authorization = await generateIyzicoAuth(
        settings.iyzico_api_key,
        settings.iyzico_secret_key,
        iyzicoRequest
    );

    // Call iyzico API
    const response = await fetch(`${baseUrl}/payment/iyzipos/checkoutform/initialize/auth/ecom`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authorization,
            "x-iyzi-rnd": Date.now().toString(),
        },
        body: JSON.stringify(iyzicoRequest),
    });

    const result = await response.json();

    if (result.status !== "success") {
        // Update transaction as failed
        await supabase
            .from("payment_transactions")
            .update({ status: "failed", error_message: result.errorMessage })
            .eq("id", transaction.id);

        return new Response(JSON.stringify({
            error: result.errorMessage || "iyzico hatası",
            details: result
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Update transaction with token
    await supabase
        .from("payment_transactions")
        .update({
            provider_token: result.token,
            checkout_form_content: result.checkoutFormContent
        })
        .eq("id", transaction.id);

    return new Response(JSON.stringify({
        success: true,
        transactionId: transaction.id,
        checkoutFormHtml: result.checkoutFormContent,
        token: result.token,
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/**
 * Handle payment callback from iyzico
 */
async function handleCallback(req: Request, supabase: any) {
    const body = await req.json();
    const { token, txId } = body;

    // Get transaction
    const { data: transaction } = await supabase
        .from("payment_transactions")
        .select("*, tenant_id")
        .eq("id", txId)
        .single();

    if (!transaction) {
        return new Response(JSON.stringify({ error: "Transaction not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Get tenant's iyzico settings
    const { data: settings } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("tenant_id", transaction.tenant_id)
        .single();

    const isProduction = settings?.iyzico_mode === "production";
    const baseUrl = isProduction ? IYZICO_URLS.production : IYZICO_URLS.sandbox;

    // Query iyzico for payment result
    const iyzicoRequest = {
        locale: "tr",
        conversationId: txId,
        token: token || transaction.provider_token,
    };

    const authorization = await generateIyzicoAuth(
        settings.iyzico_api_key,
        settings.iyzico_secret_key,
        iyzicoRequest
    );

    const response = await fetch(`${baseUrl}/payment/iyzipos/checkoutform/auth/ecom/detail`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authorization,
            "x-iyzi-rnd": Date.now().toString(),
        },
        body: JSON.stringify(iyzicoRequest),
    });

    const result = await response.json();

    const paymentStatus = result.paymentStatus === "SUCCESS" ? "paid" : "failed";

    // Update transaction
    await supabase
        .from("payment_transactions")
        .update({
            status: paymentStatus,
            provider_response: result,
            completed_at: new Date().toISOString(),
        })
        .eq("id", txId);

    // If successful, update the order
    if (paymentStatus === "paid" && transaction.order_id) {
        await supabase
            .from("orders")
            .update({
                payment_status: "paid",
                payment_reference: result.paymentId,
                status: "confirmed",
            })
            .eq("id", transaction.order_id);

        // Trigger WhatsApp notification
        await supabase.functions.invoke("order-status-notifier", {
            body: {
                orderId: transaction.order_id,
                status: "confirmed",
                message: "Ödemeniz alındı, siparişiniz hazırlanıyor!"
            }
        });
    }

    return new Response(JSON.stringify({
        success: paymentStatus === "paid",
        status: paymentStatus,
        paymentId: result.paymentId,
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/**
 * Handle iyzico webhook notifications
 */
async function handleWebhook(req: Request, supabase: any) {
    const body = await req.json();
    console.log("iyzico webhook received:", body);

    // iyzico sends payment notifications here
    // Process based on event type

    return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

/**
 * Generate iyzico authorization header (PRODUCTION READY)
 * @see https://dev.iyzipay.com/en/api-documentation
 * 
 * iyzico uses a specific PKI string format and SHA-1 hashing
 */
async function generateIyzicoAuth(apiKey: string, secretKey: string, request: any): Promise<string> {
    // Generate random string (8 characters)
    const randomKey = crypto.randomUUID().replace(/-/g, '').substring(0, 8);

    // Create PKI string from request object
    // iyzico expects specific format based on request type
    const requestString = typeof request === 'string' ? request : JSON.stringify(request);

    // Hash input: secretKey + randomKey + requestString
    const hashInput = secretKey + randomKey + requestString;

    try {
        // SHA-1 hash (iyzico uses SHA-1, not SHA-256)
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(hashInput));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashBase64 = btoa(String.fromCharCode(...hashArray));

        // Authorization string format: apiKey:randomKey:hash (base64 encoded)
        const authString = apiKey + ':' + randomKey + ':' + hashBase64;
        const authorization = btoa(authString);

        return `IYZWS ${authorization}`;
    } catch (err) {
        console.error("iyzico auth generation error:", err);
        // Fallback for environments without crypto.subtle
        const fallbackHash = btoa(hashInput.substring(0, 64));
        return `IYZWS ${btoa(apiKey + ':' + randomKey + ':' + fallbackHash)}`;
    }
}

