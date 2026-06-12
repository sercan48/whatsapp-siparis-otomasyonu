import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment Variables
const VERIFY_TOKEN = "resto123";
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://pcmlhgjphgquobcdpjpd.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET"); // Meta App Secret for webhook verification

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || "");

// ===================== SECURITY: WEBHOOK SIGNATURE VERIFICATION =====================
/**
 * Verify Meta/WhatsApp webhook signature using HMAC-SHA256
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
async function verifyWebhookSignature(signature: string | null, rawBody: string): Promise<boolean> {
    // Skip verification if APP_SECRET not configured (development mode)
    if (!WHATSAPP_APP_SECRET) {
        console.warn("⚠️ WHATSAPP_APP_SECRET not set - signature verification SKIPPED (development mode)");
        return true;
    }

    if (!signature) {
        console.error("❌ Missing x-hub-signature-256 header");
        return false;
    }

    // Signature format: sha256=abc123...
    const expectedPrefix = "sha256=";
    if (!signature.startsWith(expectedPrefix)) {
        console.error("❌ Invalid signature format");
        return false;
    }

    const providedHash = signature.slice(expectedPrefix.length);

    try {
        // HMAC-SHA256 computation
        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(WHATSAPP_APP_SECRET),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(rawBody)
        );

        const computedHash = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const isValid = providedHash.toLowerCase() === computedHash.toLowerCase();

        if (!isValid) {
            console.error("❌ Webhook signature mismatch - possible attack!");
        }

        return isValid;
    } catch (err) {
        console.error("❌ Signature verification error:", err);
        return false;
    }
}

// Database-backed session interface
interface DbSession {
    id: string;
    tenant_id: string | null;
    customer_phone: string;
    state: 'idle' | 'awaiting_address' | 'awaiting_payment' | 'awaiting_confirmation' | 'awaiting_otp';
    pending_order: PendingOrder | null;
    customer_address: string | null;
    customer_name: string | null;
    language: 'tr' | 'en' | 'ar' | 'de' | 'ru';
}

interface PendingOrder {
    items: OrderItem[];
    total: number;
    orderId?: string;
}

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
}

// ===================== TRANSLATIONS (5 Languages) =====================
type Language = 'tr' | 'en' | 'ar' | 'de' | 'ru';

const TRANSLATIONS: Record<Language, Record<string, string>> = {
    tr: {
        welcome: "Merhaba {name}! 👋 Ben restoran asistanınızım. Size nasıl yardımcı olabilirim?",
        menu_prompt: "📱 Dijital menümüz için: {url}\n\nVeya doğrudan sipariş vermek için ürün adı ve adet yazın.",
        order_confirmed: "✅ Siparişiniz alındı! Teşekkürler.",
        address_prompt: "📍 Lütfen teslimat adresinizi yazın:",
        payment_prompt: "💳 Ödeme yöntemini seçin:",
        order_cancelled: "❌ Siparişiniz iptal edildi.",
        preparing: "👨‍🍳 Siparişiniz hazırlanıyor!",
        ready: "✅ Siparişiniz hazır!",
        delivering: "🚀 Siparişiniz yola çıktı!",
        completed: "🎉 Afiyet olsun!",
        order_history: "📋 Son Siparişleriniz",
        no_orders: "Henüz siparişiniz bulunmuyor.",
        repeat_order: "🔁 Tekrarla",
        yes_this_address: "✅ Evet, bu adres",
        new_address: "📝 Yeni adres",
        pay_cash: "💵 Nakit",
        pay_card: "💳 Kapıda Kart",
        pay_online: "🌐 Online Ödeme"
    },
    en: {
        welcome: "Hello {name}! 👋 I'm the restaurant assistant. How can I help you?",
        menu_prompt: "📱 Our digital menu: {url}\n\nOr type product name and quantity to order directly.",
        order_confirmed: "✅ Your order has been received! Thank you.",
        address_prompt: "📍 Please enter your delivery address:",
        payment_prompt: "💳 Select payment method:",
        order_cancelled: "❌ Your order has been cancelled.",
        preparing: "👨‍🍳 Your order is being prepared!",
        ready: "✅ Your order is ready!",
        delivering: "🚀 Your order is on the way!",
        completed: "🎉 Enjoy your meal!",
        order_history: "📋 Your Recent Orders",
        no_orders: "You don't have any orders yet.",
        repeat_order: "🔁 Repeat",
        yes_this_address: "✅ Yes, this address",
        new_address: "📝 New address",
        pay_cash: "💵 Cash",
        pay_card: "💳 Card on Delivery",
        pay_online: "🌐 Online Payment"
    },
    ar: {
        welcome: "مرحباً {name}! 👋 أنا مساعد المطعم. كيف يمكنني مساعدتك؟",
        menu_prompt: "📱 قائمتنا الرقمية: {url}\n\nأو اكتب اسم المنتج والكمية للطلب مباشرة.",
        order_confirmed: "✅ تم استلام طلبك! شكراً لك.",
        address_prompt: "📍 يرجى إدخال عنوان التوصيل:",
        payment_prompt: "💳 اختر طريقة الدفع:",
        order_cancelled: "❌ تم إلغاء طلبك.",
        preparing: "👨‍🍳 يتم تحضير طلبك!",
        ready: "✅ طلبك جاهز!",
        delivering: "🚀 طلبك في الطريق!",
        completed: "🎉 بالعافية!",
        order_history: "📋 طلباتك الأخيرة",
        no_orders: "ليس لديك أي طلبات حتى الآن.",
        repeat_order: "🔁 كرر",
        yes_this_address: "✅ نعم، هذا العنوان",
        new_address: "📝 عنوان جديد",
        pay_cash: "💵 نقداً",
        pay_card: "💳 بطاقة عند التوصيل",
        pay_online: "🌐 دفع إلكتروني"
    },
    de: {
        welcome: "Hallo {name}! 👋 Ich bin der Restaurant-Assistent. Wie kann ich Ihnen helfen?",
        menu_prompt: "📱 Unser digitales Menü: {url}\n\nOder geben Sie Produktname und Menge ein.",
        order_confirmed: "✅ Ihre Bestellung wurde aufgenommen! Danke.",
        address_prompt: "📍 Bitte geben Sie Ihre Lieferadresse ein:",
        payment_prompt: "💳 Zahlungsmethode wählen:",
        order_cancelled: "❌ Ihre Bestellung wurde storniert.",
        preparing: "👨‍🍳 Ihre Bestellung wird zubereitet!",
        ready: "✅ Ihre Bestellung ist fertig!",
        delivering: "🚀 Ihre Bestellung ist unterwegs!",
        completed: "🎉 Guten Appetit!",
        order_history: "📋 Ihre letzten Bestellungen",
        no_orders: "Sie haben noch keine Bestellungen.",
        repeat_order: "🔁 Wiederholen",
        yes_this_address: "✅ Ja, diese Adresse",
        new_address: "📝 Neue Adresse",
        pay_cash: "💵 Bar",
        pay_card: "💳 Karte bei Lieferung",
        pay_online: "🌐 Online-Zahlung"
    },
    ru: {
        welcome: "Привет {name}! 👋 Я ассистент ресторана. Чем могу помочь?",
        menu_prompt: "📱 Наше цифровое меню: {url}\n\nИли напишите название и количество для заказа.",
        order_confirmed: "✅ Ваш заказ принят! Спасибо.",
        address_prompt: "📍 Пожалуйста, введите адрес доставки:",
        payment_prompt: "💳 Выберите способ оплаты:",
        order_cancelled: "❌ Ваш заказ отменён.",
        preparing: "👨‍🍳 Ваш заказ готовится!",
        ready: "✅ Ваш заказ готов!",
        delivering: "🚀 Ваш заказ в пути!",
        completed: "🎉 Приятного аппетита!",
        order_history: "📋 Ваши последние заказы",
        no_orders: "У вас пока нет заказов.",
        repeat_order: "🔁 Повторить",
        yes_this_address: "✅ Да, этот адрес",
        new_address: "📝 Новый адрес",
        pay_cash: "💵 Наличные",
        pay_card: "💳 Карта при доставке",
        pay_online: "🌐 Онлайн-оплата"
    }
};

// Get translated text
function t(key: string, lang: Language = 'tr', replacements: Record<string, string> = {}): string {
    let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS.tr[key] || key;
    Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
    });
    return text;
}

// Detect language from message
function detectLanguage(text: string): Language {
    const lowerText = text.toLowerCase();

    // Arabic detection
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';

    // Russian detection
    if (/[\u0400-\u04FF]/.test(text)) return 'ru';

    // German keywords
    if (/(hallo|guten|danke|bitte|bestellen|menü)/i.test(lowerText)) return 'de';

    // English keywords
    if (/^(hello|hi|hey|order|menu|help|thanks)/i.test(lowerText)) return 'en';

    // Default Turkish
    return 'tr';
}


// ===================== SESSION MANAGEMENT (DATABASE) =====================
async function getDbSession(tenantId: string, customerPhone: string): Promise<DbSession> {
    // Try to get existing session
    const { data: existing } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .gt("expires_at", new Date().toISOString())
        .single();

    if (existing) {
        return existing as DbSession;
    }

    // Create new session
    const { data: newSession } = await supabase
        .from("whatsapp_sessions")
        .upsert({
            tenant_id: tenantId,
            customer_phone: customerPhone,
            state: 'idle',
            pending_order: null,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        }, { onConflict: 'tenant_id,customer_phone' })
        .select()
        .single();

    return newSession as DbSession || {
        id: '',
        tenant_id: tenantId,
        customer_phone: customerPhone,
        state: 'idle',
        pending_order: null,
        customer_address: null,
        customer_name: null
    };
}

async function updateDbSession(sessionId: string, updates: Partial<DbSession>) {
    await supabase
        .from("whatsapp_sessions")
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .eq("id", sessionId);
}

// ===================== MAIN HANDLER =====================
serve(async (req) => {
    const url = new URL(req.url);

    // GET Request - Meta Verification
    if (req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
    }

    // POST Request - Abandoned Cart Recovery (triggered via cron or manually)
    if (req.method === "POST" && (url.pathname === "/recovery" || url.pathname === "/abandoned-cart-recovery")) {
        try {
            console.log("Triggering Abandoned Cart Recovery via Webhook endpoint...");
            const { data: abandonedCarts, error } = await supabase.rpc('get_abandoned_carts', {
                p_minutes_threshold: 30,
                p_hours_limit: 24
            });

            if (error) throw error;
            if (!abandonedCarts || abandonedCarts.length === 0) {
                return new Response(JSON.stringify({ message: "No abandoned carts found." }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            let notifiedCount = 0;
            for (const cart of abandonedCarts) {
                const pending = cart.pending_order as any;
                const itemsList = pending?.items as any[];
                if (!itemsList || itemsList.length === 0) continue;

                const itemsSummary = itemsList.map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n');
                const reminderText = `👋 Merhaba! Sepetinizde kalan ürünler olduğunu fark ettik:\n\n${itemsSummary}\n\n💰 Toplam: ${pending.total} TL\n\nSiparişinizi tamamlamak için *devam* yazabilirsiniz. Başka bir şey isterseniz *menü* yazarak yeni baştan başlayabilirsiniz.`;

                await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: cart.customer_phone,
                        type: "text",
                        text: { body: reminderText }
                    })
                });

                await supabase
                    .from("whatsapp_sessions")
                    .update({
                        state: 'idle',
                        pending_order: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", cart.session_id);

                notifiedCount++;
            }

            return new Response(JSON.stringify({ success: true, notified_count: notifiedCount }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } catch (e: any) {
            console.error("Abandoned Cart Recovery error:", e);
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    // POST Request - Handle Messages
    if (req.method === "POST") {
        try {
            // SECURITY: Read raw body for signature verification
            const rawBody = await req.text();
            const signature = req.headers.get("x-hub-signature-256");

            // Verify webhook signature (prevents spoofed webhooks)
            const isValidSignature = await verifyWebhookSignature(signature, rawBody);
            if (!isValidSignature) {
                console.error("🚫 BLOCKED: Invalid webhook signature from IP:", req.headers.get("x-forwarded-for"));
                return new Response("Forbidden", { status: 403 });
            }

            // Parse verified body
            const body = JSON.parse(rawBody);
            console.log("Incoming:", JSON.stringify(body, null, 2));

            const message = extractMessage(body);
            if (!message) {
                return new Response("OK", { status: 200 });
            }

            // Process message asynchronously
            processMessage(message);

            return new Response("OK", { status: 200 });
        } catch (err) {
            console.error("Error:", err);
            return new Response("Error", { status: 500 });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
});

// ===================== MESSAGE EXTRACTION =====================
interface MessageData {
    phoneNumberId: string;
    customerPhone: string;
    customerName: string;
    messageId: string;
    messageType: string;
    messageText: string;
    isButtonReply: boolean;
    buttonId?: string;
}

function extractMessage(body: any): MessageData | null {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    const contact = value.contacts?.[0];

    return {
        phoneNumberId: value.metadata?.phone_number_id || WHATSAPP_PHONE_ID,
        customerPhone: message.from,
        customerName: contact?.profile?.name || "Müşteri",
        messageId: message.id,
        messageType: message.type,
        messageText: message.text?.body || message.interactive?.button_reply?.title || "",
        isButtonReply: message.type === "interactive",
        buttonId: message.interactive?.button_reply?.id,
    };
}



// Check blacklist status
async function checkBlacklist(tenantId: string, customerPhone: string): Promise<boolean> {
    const { data } = await supabase
        .from('customers')
        .select('is_blacklisted')
        .eq('tenant_id', tenantId)
        .eq('phone', customerPhone)
        .single();

    return data?.is_blacklisted || false;
}

// ===================== MESSAGE PROCESSING =====================
async function processMessage(msg: MessageData) {
    console.log(`Processing message from ${msg.customerPhone}: ${msg.messageText}`);

    // Find tenant by phone number ID
    const tenant = await getTenantByPhoneId(msg.phoneNumberId);
    if (!tenant) {
        console.log("No tenant found for phone ID");
        await sendWhatsAppMessage(msg.customerPhone, "Üzgünüz, bu numara için yapılandırma bulunamadı.");
        return;
    }

    // == OPERATING HOURS CHECK ==
    const isOpen = await checkOperatingHours(tenant.opening_hours);
    if (!isOpen) {
        await sendWhatsAppMessage(msg.customerPhone, "🌙 Üzgünüz, şu anda kapalıyız. Çalışma saatlerimiz dışında hizmet veremiyoruz.");
        return;
    }

    // BLACKLIST CHECK
    const isBlacklisted = await checkBlacklist(tenant.id, msg.customerPhone);
    if (isBlacklisted) {
        console.log(`Blocked interaction for blacklisted user: ${msg.customerPhone}`);
        // Optionally send a blocked message or just ignore
        // await sendWhatsAppMessage(msg.customerPhone, "⛔ Erişiminiz engellenmiştir.");
        return;
    }

    // Get database-backed session
    const session = await getDbSession(tenant.id, msg.customerPhone);
    console.log(`Session state: ${session.state}`);

    // AUTO-DETECT LANGUAGE (only if not already set)
    if (!session.language && msg.messageText) {
        const detectedLang = detectLanguage(msg.messageText);
        await updateDbSession(session.id, { language: detectedLang });
        session.language = detectedLang;
        console.log(`Language detected: ${detectedLang}`);
    }

    // Handle button replies first
    if (msg.isButtonReply && msg.buttonId) {
        await handleButtonReply(msg, session);
        return;
    }

    // Handle based on session state from DATABASE
    switch (session.state) {
        case 'awaiting_address':
            await handleAddressInput(msg, session);
            break;
        case 'awaiting_confirmation':
            // User sent text instead of clicking button
            await sendWhatsAppMessage(msg.customerPhone, "Lütfen yukarıdaki butonlardan birini seçin.");
            break;
        default:
            // Normal message processing
            await processNormalMessage(msg, session);
    }
}

async function processNormalMessage(msg: MessageData, session: DbSession) {
    // STEP 1: Check sentiment first for angry customers
    const sentimentHandled = await handleSentiment(msg, session);
    if (sentimentHandled) {
        // High anger detected and handled, but continue with normal flow too
    }

    const intent = await detectIntentWithCatalog(session.tenant_id || "", msg.messageText);
    console.log(`Detected intent: ${intent}`);

    switch (intent) {
        case "greeting":
            await sendWelcomeMessage(msg);
            break;
        case "menu":
            await sendMenuLink(msg);
            break;
        case "help":
            await sendHelpMessage(msg);
            break;
        case "order_intent":
            await sendOrderIntentResponse(msg);
            break;
        case "order":
            await processOrder(msg, session);
            break;
        case "product_search":
            const keyword = extractCatalogKeyword(msg.messageText);
            if (keyword) {
                await handleProductSearch(msg, session, keyword);
            } else {
                await sendMenuLink(msg);
            }
            break;
        case "complaint":
            await handleComplaint(msg, session);
            break;
        case "cancel":
            await handleCancellation(msg, session);
            break;
        case "order_history":
            await sendOrderHistory(msg, session);
            break;
        case "status":
            await sendOrderStatus(msg);
            break;
        default:
            await handleWithAI(msg, session);
    }
}

// ===================== INTENT DETECTION =====================
async function detectIntentWithCatalog(tenantId: string, text: string): Promise<string> {
    const lowerText = text.toLowerCase().trim();

    // Greeters
    if (/^(merhaba|selam|hey|hi|hello|günaydın|iyi akşamlar|sa|s.a|mrb|merhabalar)/i.test(lowerText)) {
        return "greeting";
    }
    // Catalog / Menu requests
    if (/^(menü|menu|liste|katalog|ürünler|urunler|fiyatlar|ne var|ne var ne yok)/i.test(lowerText) || (/gönder|goster|göster/i.test(lowerText) && /menü|menu|katalog/i.test(lowerText))) {
        return "menu";
    }
    // Help & Info
    if (/^(yardım|help|destek|nasıl|neredesiniz|konum|iletisim|iletişim)/i.test(lowerText)) {
        return "help";
    }
    // Order Status
    if (/(sipariş durumu|siparişim|nerede|geldi mi|kurye nerede|siparisim nerede)/i.test(lowerText)) {
        return "status";
    }
    // Order history / repeat order
    if (/(geçmiş|gecmis|siparişlerim|siparislerim|son siparişim|tekrarla|aynısından|aynisindan|önceki|onceki)/i.test(lowerText)) {
        return "order_history";
    }
    // Complaint detection
    if (/(soğuk|soguk|bayat|kötü|kotu|yanlış|yanlis|eksik|gecikti|geç kaldı|gelmedi|beğenmedim|begenmedim|rezalet|berbat|şikayet|sikayet|sorun)/i.test(lowerText)) {
        return "complaint";
    }
    // Cancellation detection
    if (/(iptal|vazgeçtim|istemiyorum|siparişi durdur|siparis iptal)/i.test(lowerText)) {
        return "cancel";
    }

    // Dynamic catalog product detection using the new products table
    if (tenantId) {
        try {
            const { data: products } = await supabase
                .from('products')
                .select('name')
                .eq('tenant_id', tenantId)
                .eq('is_active', true);

            if (products && products.length > 0) {
                const productNames = products.map(p => p.name.toLowerCase());
                const hasNumber = /\d+/.test(lowerText);
                const hasQuantityWord = /(tane|adet|porsiyon|bir|iki|üç|dört|beş|paket)/i.test(lowerText);

                const mentionedProduct = productNames.find(name => lowerText.includes(name));

                if (mentionedProduct) {
                    if (hasNumber || hasQuantityWord) {
                        return "order"; // Direct order
                    }
                    return "product_search"; // Catalog product mentioned without quantity
                }
            }
        } catch (e) {
            console.error("Catalog intent detection error:", e);
        }
    }

    // Fallback order intent
    if (/(sipariş|siparis|order|ısmarlamak|ismarliyorum|yemek istiyorum|almak istiyorum|satın al)/i.test(lowerText)) {
        return "order_intent";
    }

    return "unknown";
}

// Extract keyword from catalog
function extractCatalogKeyword(text: string): string | null {
    return text.trim(); // Return whole text as search keyword for flexibility
}

// ===================== RESPONSE FUNCTIONS =====================

// Get digital menu URL for tenant (using new tenants slug structure)
async function getDigitalMenuUrl(tenantId: string): Promise<string> {
    try {
        const { data: tenant } = await supabase
            .from("tenants")
            .select("slug")
            .eq("id", tenantId)
            .single();

        if (tenant?.slug) {
            return `https://arasta.vercel.app/m/${tenant.slug}`;
        }
    } catch (e) {
        console.error("Error getting menu URL:", e);
    }
    return "https://arasta.vercel.app";
}

// Send welcome message with digital menu link
async function sendWelcomeMessage(msg: MessageData) {
    // Get tenant from session
    const { data: session } = await supabase
        .from("whatsapp_sessions")
        .select("tenant_id")
        .eq("customer_phone", msg.customerPhone)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

    const menuUrl = session?.tenant_id
        ? await getDigitalMenuUrl(session.tenant_id)
        : "https://arasta.vercel.app";

    await sendWhatsAppMessage(
        msg.customerPhone,
        `Merhaba! 👋\n\nSipariş vermek için dijital menümüzü kullanabilirsiniz:\n\n📱 ${menuUrl}\n\n✨ Menüden seçimlerinizi yapıp "WhatsApp'a Gönder" butonuna basmanız yeterli!`
    );
}

// Send digital menu link
async function sendMenuLink(msg: MessageData) {
    const { data: session } = await supabase
        .from("whatsapp_sessions")
        .select("tenant_id")
        .eq("customer_phone", msg.customerPhone)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

    const menuUrl = session?.tenant_id
        ? await getDigitalMenuUrl(session.tenant_id)
        : "https://arasta.vercel.app";

    await sendWhatsAppMessage(
        msg.customerPhone,
        `📱 *Dijital Menümüz*\n\n👉 ${menuUrl}\n\nMenüden ürünlerinizi seçip, malzeme ve boy tercihlerinizi yapabilirsiniz!\n\n✨ Seçimlerinizi tamamladıktan sonra "WhatsApp'a Gönder" butonuna basın.`
    );
}

// Send order intent response - redirect to digital menu
async function sendOrderIntentResponse(msg: MessageData) {
    const { data: session } = await supabase
        .from("whatsapp_sessions")
        .select("tenant_id")
        .eq("customer_phone", msg.customerPhone)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

    const menuUrl = session?.tenant_id
        ? await getDigitalMenuUrl(session.tenant_id)
        : "https://arasta.vercel.app";

    await sendWhatsAppMessage(
        msg.customerPhone,
        `🍽️ *Sipariş Vermek İstiyorsunuz!*\n\nEn kolay yol dijital menümüzü kullanmak:\n\n📱 ${menuUrl}\n\n✅ Malzeme seçimi yapabilirsiniz\n✅ Boy/porsiyon seçebilirsiniz\n✅ Not ekleyebilirsiniz\n✅ Fiyatları görebilirsiniz\n\nSeçimlerinizi yaptıktan sonra "WhatsApp'a Gönder" butonuna basın!`
    );
}

// Send help message
async function sendHelpMessage(msg: MessageData) {
    await sendWhatsAppMessage(
        msg.customerPhone,
        `ℹ️ *Yardım*\n\n📱 *Sipariş Vermek İçin:*\n"Menü" yazın veya dijital menümüzü kullanın\n\n📍 *Sipariş Durumu:*\n"Siparişim nerede?" yazın\n\n❌ *Sipariş İptali:*\n"İptal" yazın\n\n📞 *İletişim:*\nMüşteri hizmetlerimize ulaşmak için "Yardım" yazın\n\nBaşka nasıl yardımcı olabilirim?`
    );
}

// Extract food keyword from message
function extractFoodKeyword(text: string): string | null {
    const lowerText = text.toLowerCase();
    const foodItems = ['burger', 'pizza', 'döner', 'doner', 'lahmacun', 'pide', 'içecek', 'kola', 'ayran', 'su', 'patates', 'tavuk', 'et', 'köfte', 'kofte', 'salata', 'çorba', 'corba', 'makarna', 'tost', 'sandviç', 'sandvic'];

    for (const food of foodItems) {
        if (lowerText.includes(food)) {
            return food;
        }
    }
    return null;
}

// ===================== ORDER PROCESSING =====================
async function processOrder(msg: MessageData, session: DbSession) {
    const parsedOrder = await parseOrderWithAI(msg.messageText);

    if (!parsedOrder || parsedOrder.items.length === 0) {
        await sendWhatsAppMessage(
            msg.customerPhone,
            "Üzgünüm, siparişinizi anlayamadım. Lütfen şu formatta yazın:\n\nÖrnek: '2 burger, 1 kola'"
        );
        return;
    }

    // Save parsed order to session
    session.pending_order = parsedOrder;

    // Get menu URL for digital menu option
    let menuUrl = "https://example.com/menu";
    try {
        if (session.tenant_id) {
            const { data: table } = await supabase
                .from("restaurant_tables")
                .select("id")
                .eq("tenant_id", session.tenant_id)
                .limit(1)
                .single();
            if (table) {
                menuUrl = `https://arasta.vercel.app/menu/${table.id}?whatsapp=true`;
            }
        }
    } catch (e) {
        console.log("Could not get menu URL");
    }

    // 🖼️ RESIMLI TEYIT: Send product image if available
    if (session.tenant_id && parsedOrder.items.length > 0) {
        const mainProduct = parsedOrder.items[0];

        const { data: productItem } = await supabase
            .from('products')
            .select('name, meta_data')
            .eq('tenant_id', session.tenant_id)
            .ilike('name', `%${mainProduct.name}%`)
            .limit(1)
            .single();

        const image_url = productItem?.meta_data ? (productItem.meta_data as any).image_url : null;

        if (image_url) {
            const lang = session.language || 'tr';
            const caption = lang === 'tr'
                ? `📸 *${productItem.name}*\n\nBu ürünü mü istiyorsunuz? (${mainProduct.quantity} adet)`
                : lang === 'en'
                    ? `📸 *${productItem.name}*\n\nIs this what you want? (${mainProduct.quantity}x)`
                    : `📸 *${productItem.name}*`;

            await sendWhatsAppImage(msg.customerPhone, image_url, caption);

            // Small delay before buttons
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Always show choice: continue with this order OR use digital menu
    const orderSummary = parsedOrder.items.map(i => `• ${i.quantity}x ${i.name}`).join("\n");

    // Encode order data in button ID (WhatsApp limit: 256 chars)
    // Format: continue_ITEMS|TOTAL (e.g., "continue_2xPizza,1xKola|140")
    const itemsEncoded = parsedOrder.items.map(i => `${i.quantity}x${i.name.replace(/\s/g, '_')}@${i.price}`).join(',');
    const orderData = `${itemsEncoded}|${parsedOrder.total}`;
    // Truncate if too long
    const buttonId = `continue_${orderData.substring(0, 200)}`;

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: msg.customerPhone,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: `📦 *Sipariş Algılandı:*\n\n${orderSummary}\n\n💰 Toplam: ${parsedOrder.total} TL\n\n📱 Malzeme çıkarma, ekstra ekleme gibi özelleştirmeler için dijital menüyü kullanabilirsiniz.\n\nNasıl devam etmek istersiniz?`,
            },
            action: {
                buttons: [
                    { type: "reply", reply: { id: buttonId, title: "✅ Bu şekilde devam" } },
                    { type: "reply", reply: { id: `menu_link_${encodeURIComponent(menuUrl)}`, title: "📱 Dijital Menü" } },
                ],
            },
        },
    };

    await sendWhatsAppInteractive(payload);
    session.state = 'awaiting_confirmation';
}

async function handleAddressInput(msg: MessageData, session: DbSession) {
    const address = msg.messageText.trim();

    if (address.length < 10) {
        await sendWhatsAppMessage(msg.customerPhone, "Lütfen geçerli bir adres girin (mahalle, sokak, bina no).");
        return;
    }

    // Save customer to customers table
    if (session.tenant_id) {
        await upsertCustomer(session.tenant_id, msg.customerPhone, msg.customerName, address);
    }

    // Update session in database with address and new state
    await updateDbSession(session.id, {
        customer_address: address,
        customer_name: msg.customerName,
        state: 'awaiting_payment'
    });

    // Show payment options
    await sendPaymentOptions(msg, session);
}

async function sendAddressConfirmation(msg: MessageData, order: PendingOrder, address: string) {
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: msg.customerPhone,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: `📦 *Sipariş Özeti*\n\n${order.items.map(i => `• ${i.quantity}x ${i.name}`).join("\n")}\n\n💰 Toplam: ${order.total} TL\n\n📍 *Kayıtlı Adres:*\n${address}\n\nBu adrese mi gönderelim?`,
            },
            action: {
                buttons: [
                    { type: "reply", reply: { id: "confirm_address", title: "✅ Evet, bu adres" } },
                    { type: "reply", reply: { id: "new_address", title: "📝 Yeni adres" } },
                ],
            },
        },
    };
    await sendWhatsAppInteractive(payload);
}

async function sendPaymentOptions(msg: MessageData, session: DbSession) {
    const order = session.pending_order!;
    const orderSummary = order.items.map(i => `• ${i.quantity}x ${i.name}`).join("\n");

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: msg.customerPhone,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: `✅ *Adres Kaydedildi!*\n\n📍 ${session.customer_address}\n\n� *Sipariş:*\n${orderSummary}\n\n💰 Toplam: ${order.total} TL\n\n�💳 *Ödeme Yöntemi Seçin:*`,
            },
            action: {
                buttons: [
                    { type: "reply", reply: { id: "pay_cash", title: "🚪 Kapıda Nakit" } },
                    { type: "reply", reply: { id: "pay_card", title: "💳 Kapıda Kart" } },
                    { type: "reply", reply: { id: "pay_online", title: "🌐 Online Ödeme" } },
                ],
            },
        },
    };
    await sendWhatsAppInteractive(payload);
}

// ===================== BUTTON HANDLERS =====================
async function handleButtonReply(msg: MessageData, session: DbSession) {
    const buttonId = msg.buttonId!;
    console.log(`Button clicked: ${buttonId}`);

    // Address confirmation
    if (buttonId === "confirm_address") {
        await updateDbSession(session.id, { state: 'awaiting_payment' });
        await sendPaymentOptions(msg, session);
        return;
    }

    if (buttonId === "new_address") {
        await updateDbSession(session.id, { state: 'awaiting_address', customer_address: null });
        await sendWhatsAppMessage(msg.customerPhone, "📍 Lütfen yeni teslimat adresinizi yazın:");
        return;
    }

    // Payment selection
    if (buttonId === "pay_cash" || buttonId === "pay_card" || buttonId === "pay_online") {
        const paymentMethod = buttonId === "pay_cash" ? "cash" : buttonId === "pay_card" ? "credit_card" : "online";

        if (paymentMethod === "online") {
            // For online payment, send payment link (iyzico/stripe integration)
            const order = session.pending_order;
            if (order) {
                // TODO: Generate actual payment link with payment provider
                const paymentLink = `https://arasta.vercel.app/pay/${session.id}`;
                await sendWhatsAppMessage(
                    msg.customerPhone,
                    `🌐 *Online Ödeme*\n\n💰 Tutar: ${order.total} TL\n\n🔗 Ödeme yapmak için:\n${paymentLink}\n\nÖdeme tamamlandığında siparişiniz otomatik onaylanacak!`
                );
                // Save order with pending payment status
                await confirmOrder(msg, session, "online");
            }
            return;
        }

        await confirmOrder(msg, session, paymentMethod);
        return;
    }

    // Legacy order confirmation (for backwards compatibility)
    if (buttonId.startsWith("confirm_order")) {
        await confirmOrder(msg, session, "cash");
        return;
    }


    if (buttonId === "cancel_order") {
        await updateDbSession(session.id, { state: 'idle', pending_order: null });
        await sendWhatsAppMessage(msg.customerPhone, "❌ Siparişiniz iptal edildi. Başka bir şey ister misiniz?");
        return;
    }

    // Quick order button - prompt user to type their order
    if (buttonId === "quick_order") {
        await updateDbSession(session.id, { state: 'idle' });
        await sendWhatsAppMessage(
            msg.customerPhone,
            "📝 *Hızlı Sipariş*\n\nSiparişinizi şu formatta yazın:\n\nÖrnek: \"2 burger, 1 kola, 1 pizza\"\n\n💡 Adet + ürün adı şeklinde yazmanız yeterli!"
        );
        return;
    }

    // Repeat order from history
    if (buttonId.startsWith("repeat_")) {
        const orderId = buttonId.replace("repeat_", "");
        await handleRepeatOrder(msg, session, orderId);
        return;
    }

    // Continue with quick order - parse order data from button ID
    if (buttonId.startsWith("continue_")) {
        // Parse order data from button ID
        // Format: continue_2xPizza@120,1xKola@20|140
        const orderDataStr = buttonId.replace("continue_", "");

        let parsedOrder: PendingOrder | null = null;
        try {
            const [itemsStr, totalStr] = orderDataStr.split("|");
            const total = parseFloat(totalStr) || 0;
            const items: OrderItem[] = itemsStr.split(",").map(itemStr => {
                // Format: 2xPizza@120
                const match = itemStr.match(/(\d+)x(.+)@(\d+)/);
                if (match) {
                    return {
                        quantity: parseInt(match[1]),
                        name: match[2].replace(/_/g, ' '),
                        price: parseFloat(match[3])
                    };
                }
                return null;
            }).filter(Boolean) as OrderItem[];

            if (items.length > 0) {
                parsedOrder = { items, total };
            }
        } catch (e) {
            console.error("Parse order from button ID error:", e);
        }

        if (!parsedOrder) {
            await sendWhatsAppMessage(msg.customerPhone, "Sipariş bilgisi okunamadı. Lütfen tekrar sipariş verin.");
            await updateDbSession(session.id, { state: 'idle', pending_order: null });
            return;
        }

        // Store order in database session
        await updateDbSession(session.id, { pending_order: parsedOrder });

        // Check if customer has saved address
        if (session.tenant_id) {
            const existingAddress = await getCustomerAddress(session.tenant_id, msg.customerPhone);
            if (existingAddress) {
                await updateDbSession(session.id, {
                    customer_address: existingAddress,
                    state: 'awaiting_confirmation'
                });
                await sendAddressConfirmation(msg, parsedOrder, existingAddress);
                return;
            }
        }

        // No saved address, ask for address
        await updateDbSession(session.id, { state: 'awaiting_address' });
        await sendWhatsAppMessage(
            msg.customerPhone,
            `✅ *Sipariş Onaylandı!*\n\n${parsedOrder.items.map(i => `• ${i.quantity}x ${i.name}`).join("\n")}\n\n💰 Toplam: ${parsedOrder.total} TL\n\n📍 Lütfen teslimat adresinizi yazın:`
        );
        return;
    }

    // Digital menu button - send menu link
    if (buttonId.startsWith("menu_link_")) {
        const encodedUrl = buttonId.replace("menu_link_", "");
        const menuUrl = decodeURIComponent(encodedUrl);
        await sendWhatsAppMessage(
            msg.customerPhone,
            `📱 *Dijital Menü*\n\nMalzeme seçimi, boy seçimi ve özelleştirmeler için:\n\n👉 ${menuUrl}\n\n✨ Seçimlerinizi yaptıktan sonra "WhatsApp'a Gönder" butonuna basın!`
        );
        return;
    }
}

async function confirmOrder(msg: MessageData, session: DbSession, paymentMethod: string) {
    if (!session.pending_order) {
        await sendWhatsAppMessage(msg.customerPhone, "Bekleyen sipariş bulunamadı. Lütfen tekrar sipariş verin.");
        return;
    }

    const order = session.pending_order;

    // SECURITY CHECK: Verify order before confirming
    if (session.tenant_id) {
        const security = await checkOrderSecurity(
            session.tenant_id,
            msg.customerPhone,
            order.total,
            paymentMethod
        );

        // Blocked order (e.g., blacklisted, foreign number with block setting)
        if (security.block_order) {
            await handleBlockedOrder(msg, security.reasons);
            await logSuspiciousOrder(session.tenant_id, msg.customerPhone, null, security.reasons, security.risk_level);
            return;
        }

        // Requires phone callback (high risk)
        if (security.require_callback) {
            await handleCallbackRequired(msg, session, security.reasons);
            return;
        }

        // Requires OTP verification (first-time customer)
        if (security.require_otp) {
            await sendOTP(session.tenant_id, msg.customerPhone, 'first_order');
            await updateDbSession(session.id, { state: 'awaiting_otp' as any });
            await sendWhatsAppMessage(
                msg.customerPhone,
                `✅ Siparişiniz neredeyse tamam!\n\nGüvenliğiniz için bir doğrulama kodu gönderdik. Lütfen kodu girin.`
            );
            return;
        }

        // Log suspicious but allowed orders
        if (security.risk_level !== 'none' && security.reasons.length > 0) {
            await logSuspiciousOrder(session.tenant_id, msg.customerPhone, null, security.reasons, security.risk_level);
        }
    }

    // Save customer to database FIRST
    let customerId: string | null = null;
    if (session.tenant_id && session.customer_address) {
        customerId = await upsertCustomer(
            session.tenant_id,
            msg.customerPhone,
            msg.customerName,
            session.customer_address
        );
        console.log(`Customer saved/updated: ${customerId}`);
    }

    // Save order to database (pos_orders + pos_order_items)
    try {
        const orderId = await saveOrder({
            tenantId: session.tenant_id || undefined,
            customerId: customerId,
            customerPhone: msg.customerPhone,
            customerName: msg.customerName,
            items: order.items,
            total: order.total,
            deliveryAddress: session.customer_address || undefined,
            paymentMethod: paymentMethod,
            orderSource: 'whatsapp'
        });

        // Reset session in database
        await updateDbSession(session.id, {
            state: 'idle',
            pending_order: null,
            customer_address: null
        });

        // Send confirmation to customer
        const paymentTexts: Record<string, string> = {
            "cash": "Kapıda Nakit",
            "credit_card": "Kapıda Kredi Kartı",
            "online": "Online Ödeme (Bekliyor)"
        };
        const paymentText = paymentTexts[paymentMethod] || paymentMethod;

        await sendWhatsAppMessage(
            msg.customerPhone,
            `✅ *Siparişiniz Onaylandı!*\n\n📦 Sipariş No: #${orderId?.slice(-6).toUpperCase() || 'N/A'}\n💰 Tutar: ${order.total} TL\n💳 Ödeme: ${paymentText}\n📍 Adres: ${session.customer_address}\n\n🕐 Tahmini teslimat: 30-45 dakika\n\nAfiyet olsun! 🍔`
        );

        // Notify admin
        await notifyAdmin(msg, order, session.customer_address || undefined, paymentMethod, orderId);

    } catch (e: unknown) {
        const err = e as Error;
        console.error("Order process error:", err);
        await sendWhatsAppMessage(
            msg.customerPhone,
            `❌ SİSTEM HATASI OLUŞTU:\n\n${err.message || JSON.stringify(e)}\n\nLütfen bu hatayı yetkiliye bildirin.`
        );
    }
}

// ===================== DATABASE FUNCTIONS =====================
async function getTenantByPhoneId(phoneId: string) {
    try {
        const { data } = await supabase
            .from("tenant_configs")
            .select("tenant_id, commerce_config")
            .eq("api_keys->>whatsapp_phone_number_id", phoneId)
            .single();

        if (data) {
            const commerce_config = (data.commerce_config as any) || {};
            return { id: data.tenant_id, opening_hours: commerce_config.opening_hours };
        }
    } catch (e) {
        console.log("Could not find tenant by phone ID:", e);
    }
    return null;
}

async function getCustomerAddress(tenantId: string, phone: string): Promise<string | null> {
    try {
        const { data } = await supabase
            .from("customers")
            .select("meta_data")
            .eq("tenant_id", tenantId)
            .eq("phone", phone)
            .single();

        return (data?.meta_data as any)?.address || null;
    } catch (e) {
        return null;
    }
}

async function upsertCustomer(tenantId: string, phone: string, name: string, address: string): Promise<string | null> {
    try {
        // Check if exists
        const { data: existing } = await supabase
            .from("customers")
            .select("id, meta_data")
            .eq("tenant_id", tenantId)
            .eq("phone", phone)
            .single();

        if (existing) {
            // Update
            const meta_data = { ...((existing.meta_data as any) || {}), address };
            await supabase
                .from("customers")
                .update({ name, meta_data, updated_at: new Date().toISOString() })
                .eq("id", existing.id);
            return existing.id;
        } else {
            // Insert
            const meta_data = { address };
            const { data: newCustomer } = await supabase
                .from("customers")
                .insert({ tenant_id: tenantId, phone, name, meta_data })
                .select("id")
                .single();
            return newCustomer?.id || null;
        }
    } catch (e) {
        console.error("Upsert customer error:", e);
        return null;
    }
}

interface SaveOrderParams {
    tenantId?: string;
    customerId?: string | null;
    customerPhone: string;
    customerName: string;
    items: OrderItem[];
    total: number;
    deliveryAddress?: string;
    paymentMethod: string;
    orderSource: string;
}

async function saveOrder(params: SaveOrderParams): Promise<string | null> {
    try {
        if (!params.tenantId) {
            console.error("No tenant ID provided for order");
            return null;
        }

        let customerId = params.customerId;
        if (!customerId) {
            customerId = await upsertCustomer(params.tenantId, params.customerPhone, params.customerName, params.deliveryAddress || "");
        }

        if (!customerId) {
            throw new Error("Müşteri kaydı oluşturulamadı.");
        }

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                tenant_id: params.tenantId,
                customer_id: customerId,
                status: "received",
                items: params.items,
                subtotal_amount: params.total,
                discount_amount: 0.00,
                final_amount: params.total,
                payment_method: params.paymentMethod,
                payment_status: "pending",
                meta_data: {
                    customer_phone: params.customerPhone,
                    customer_name: params.customerName,
                    delivery_address: params.deliveryAddress,
                    order_source: params.orderSource,
                    note: `WhatsApp sipariş - ${params.customerPhone}`
                }
            })
            .select("id")
            .single();

        if (orderError) throw new Error(`Sipariş kayıt hatası: ${orderError.message}`);
        if (!order) throw new Error("Sipariş oluşturulamadı");

        console.log(`Order saved: ${order.id} with ${params.items.length} items`);
        return order.id;

    } catch (e: unknown) {
        console.error("Save order error:", e);
        throw e;
    }
}

async function notifyAdmin(msg: MessageData, order: PendingOrder, address: string | undefined, paymentMethod: string, orderId: string | null) {
    const adminPhone = Deno.env.get("ADMIN_PHONE_NUMBER");
    if (!adminPhone) return;

    const paymentText = paymentMethod === "cash" ? "💵 Kapıda Nakit" : "💳 Kapıda Kart";
    const orderItems = order.items.map(i => `• ${i.quantity}x ${i.name}`).join("\n");

    await sendWhatsAppMessage(
        adminPhone,
        `🔔 *YENİ SİPARİŞ!*\n\n📱 ${msg.customerName}\n📞 ${msg.customerPhone}\n📍 ${address || "Adres belirtilmedi"}\n\n📦 *Ürünler:*\n${orderItems}\n\n💰 Toplam: ${order.total} TL\n${paymentText}\n\n🆔 #${orderId?.slice(-6).toUpperCase() || "N/A"}`
    );
}

// ===================== MESSAGE HANDLERS =====================
// NOTE: sendWelcomeMessage moved to line ~602 with digital menu support
/*
async function sendWelcomeMessage(msg: MessageData) {
    const text = `Merhaba ${msg.customerName}! 👋

🍔 *Lezzet Dünyası*'na hoş geldiniz!

📋 *Menü* için "menü" yazın
🛒 *Sipariş* için direkt ürün adı yazın (örn: "2 burger")
❓ *Yardım* için "yardım" yazın

Size nasıl yardımcı olabilirim?`;

    await sendWhatsAppMessage(msg.customerPhone, text);
}
*/

// NOTE: sendMenuLink moved to line ~623 with digital menu support
/*
async function sendMenuLink_OLD(msg: MessageData) {
    let menuUrl = "https://example.com/menu";
    let tenantName = "Restoran";

    try {
        const { data: tenant } = await supabase
            .from("tenant_configs")
            .select("tenant_id, business_name")
            .eq("whatsapp_phone_number_id", msg.phoneNumberId)
            .single();

        if (tenant) {
            tenantName = tenant.business_name || "Restoran";
            // Get default table for menu URL
            const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", tenant.tenant_id)
                .single();

            if (profile) {
                const { data: table } = await supabase
                    .from("restaurant_tables")
                    .select("id")
                    .eq("tenant_id", profile.id)
                    .limit(1)
                    .single();

                if (table) {
                    menuUrl = `https://arasta.vercel.app/menu/${table.id}`;
                }
            }
        }
    } catch (e) {
        console.log("Could not fetch tenant menu URL, using default");
    }

    const text = `📋 *${tenantName} Menüsü*

Lezzetli yemeklerimize göz atın:
👉 ${menuUrl}

Veya direkt yazarak sipariş verin:
Örnek: "2 burger, 1 kola"`;

    await sendWhatsAppMessage(msg.customerPhone, text);
}
*/

// NOTE: sendHelpMessage moved to line ~663 with digital menu support
/*
async function sendHelpMessage_OLD(msg: MessageData) {
    const text = `❓ *Yardım Menüsü*

🔹 "menü" - Dijital menümüzü görüntüle
🔹 "2 burger" - Direkt sipariş ver
🔹 "sipariş durumu" - Siparişini takip et

📞 Canlı destek için: 0532 XXX XX XX`;

    await sendWhatsAppMessage(msg.customerPhone, text);
}
*/

async function sendOrderStatus(msg: MessageData) {
    try {
        const { data: orders, error } = await supabase
            .from("orders")
            .select(`
                id,
                status,
                final_amount,
                payment_method,
                meta_data,
                created_at,
                items,
                tenant_id
            `)
            .eq("meta_data->>customer_phone", msg.customerPhone)
            .order("created_at", { ascending: false })
            .limit(3);

        if (error || !orders || orders.length === 0) {
            await sendWhatsAppMessage(
                msg.customerPhone,
                "📭 Aktif siparişiniz bulunmuyor.\n\nSipariş vermek için \"menü\" yazın veya direkt ürün adı yazın!"
            );
            return;
        }

        const tenantId = orders[0].tenant_id;
        const { data: config } = await supabase
            .from("tenant_configs")
            .select("order_states")
            .eq("tenant_id", tenantId)
            .single();

        const customStates = (config?.order_states as any)?.states || {};

        const statusEmojis: Record<string, string> = {
            "received": "⏳ Alındı",
            "preparing": "👨‍🍳 Hazırlanıyor",
            "ready": "✅ Hazır",
            "delivering": "🚗 Yolda",
            "completed": "✅ Tamamlandı",
            "delivered": "✅ Teslim Edildi",
            "cancelled": "❌ İptal",
            "paid": "💳 Ödendi",
            "pending": "⏳ Beklemede"
        };

        let statusText = "📦 *Son Siparişleriniz:*\n\n";

        for (const order of orders) {
            const itemsList = order.items as any[];
            const items = itemsList?.map((item: any) => `${item.quantity}x ${item.name}`).join(", ");
            
            const statusLabel = customStates[order.status] || order.status;
            const statusEmoji = statusEmojis[order.status] || "📦";
            const status = `${statusEmoji} ${statusLabel}`;

            const meta = (order.meta_data as any) || {};
            const date = new Date(order.created_at).toLocaleDateString("tr-TR");
            const orderNo = order.id.slice(-6).toUpperCase();

            statusText += `#${orderNo} (${date})\n`;
            statusText += `📍 ${meta.delivery_address || 'Adres yok'}\n`;
            statusText += `📦 ${items || 'Ürünler'}\n`;
            statusText += `💰 ${order.final_amount} TL - ${status}\n\n`;
        }

        await sendWhatsAppMessage(msg.customerPhone, statusText);

    } catch (e) {
        console.error("Order status error:", e);
        await sendWhatsAppMessage(
            msg.customerPhone,
            "Sipariş durumu sorgulanırken bir hata oluştu. Lütfen tekrar deneyin."
        );
    }
}

// NOTE: sendOrderIntentResponse moved to line ~643 with digital menu support
/*
async function sendOrderIntentResponse_OLD(msg: MessageData) {
    // User wants to order but didn't specify items
    // Give them a choice: quick text order or digital menu
    let menuUrl = "https://example.com/menu";

    try {
        const { data: tenant } = await supabase
            .from("tenant_configs")
            .select("tenant_id, business_name")
            .eq("whatsapp_phone_number_id", msg.phoneNumberId)
            .single();

        if (tenant) {
            const { data: table } = await supabase
                .from("restaurant_tables")
                .select("id")
                .eq("tenant_id", tenant.tenant_id)
                .limit(1)
                .single();

            if (table) {
                menuUrl = `https://arasta.vercel.app/menu/${table.id}?whatsapp=true`;
            }
        }
    } catch (e) {
        console.log("Could not fetch tenant for order intent");
    }

    // Send interactive buttons for choice
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: msg.customerPhone,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: `🍔 *Sipariş Vermek İstiyorsunuz!*\n\nNasıl devam etmek istersiniz?\n\n📝 *Hızlı Sipariş:* Buradan devam edin\n(Örn: "2 burger, 1 kola" yazın)\n\n📱 *Dijital Menü:* Malzeme seçimi, boy seçimi ve özelleştirmeler için`,
            },
            action: {
                buttons: [
                    { type: "reply", reply: { id: "quick_order", title: "📝 Hızlı Sipariş" } },
                    { type: "reply", reply: { id: `menu_link_${encodeURIComponent(menuUrl)}`, title: "📱 Dijital Menü" } },
                ],
            },
        },
    };

    await sendWhatsAppInteractive(payload);
}
*/



async function handleWithAI(msg: MessageData, session: DbSession) {
    const response = await getAIResponse(msg.messageText, msg.customerName, session.tenant_id || undefined, session.language || 'tr');

    // Log the conversation with customer phone for history
    if (session.tenant_id) {
        logConversation(session.tenant_id, msg.customerPhone, 'user', msg.messageText);
        logConversation(session.tenant_id, msg.customerPhone, 'assistant', response);
    }

    await sendWhatsAppMessage(msg.customerPhone, response);
}

// ===================== AI FUNCTIONS =====================
async function parseOrderWithAI(text: string): Promise<PendingOrder | null> {
    console.log("Parsing order:", text);

    const fallbackParse = (): PendingOrder | null => {
        const items: OrderItem[] = [];
        const prices: Record<string, number> = {
            burger: 80, pizza: 120, döner: 60, doner: 60, lahmacun: 40,
            pide: 70, kola: 20, ayran: 15, su: 10, patates: 30, köfte: 90, kofte: 90
        };

        const numWords: Record<string, number> = { bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4, beş: 5, bes: 5 };
        const lowerText = text.toLowerCase();

        for (const [item, price] of Object.entries(prices)) {
            const numMatch = lowerText.match(new RegExp(`(\\d+)\\s*${item}`, 'i'));
            if (numMatch) {
                items.push({ name: item.charAt(0).toUpperCase() + item.slice(1), quantity: parseInt(numMatch[1]), price });
                continue;
            }
            for (const [word, num] of Object.entries(numWords)) {
                if (lowerText.includes(`${word} ${item}`) || lowerText.includes(`${word}${item}`)) {
                    items.push({ name: item.charAt(0).toUpperCase() + item.slice(1), quantity: num, price });
                }
            }
            if (lowerText.includes(item) && !items.some(i => i.name.toLowerCase() === item)) {
                items.push({ name: item.charAt(0).toUpperCase() + item.slice(1), quantity: 1, price });
            }
        }

        if (items.length > 0) {
            const total = items.reduce((sum, i) => sum + (i.quantity * i.price), 0);
            return { items, total };
        }
        return null;
    };

    if (!OPENAI_API_KEY) {
        return fallbackParse();
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an order parser for a Turkish restaurant. Extract order items from the message.
Return JSON format ONLY: {"items": [{"name": "item name", "quantity": number, "price": price_in_TL}], "total": total_amount}
Prices: Burger=80, Pizza=120, Döner=60, Lahmacun=40, Pide=70, Kola=20, Ayran=15, Su=10, Patates=30, Köfte=90
If message is like "2 burger" parse it as 2 burgers at 80 TL each = 160 TL total.
Always return valid JSON, never null.`,
                    },
                    { role: "user", content: text },
                ],
                response_format: { type: "json_object" },
            }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            if (parsed.items && parsed.items.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error("AI parsing error:", e);
    }

    return fallbackParse();
}

// ===================== AI PERSONALITY SYSTEM =====================

interface AIPersonality {
    bot_name: string;           // "Arasta Asistan", "XLarge Bot"
    tone: 'formal' | 'friendly' | 'casual' | 'professional';
    use_emojis: boolean;
    greeting_style: string;     // Custom greeting template
    special_phrases: string[];  // Brand-specific phrases
    menu_highlights: string[];  // Products to recommend
    response_length: 'short' | 'medium' | 'detailed';
}

// Get restaurant's AI personality config
async function getAIPersonality(tenantId: string): Promise<AIPersonality> {
    const { data } = await supabase
        .from('tenants')
        .select('ai_personality, business_name')
        .eq('id', tenantId)
        .single();

    const defaultPersonality: AIPersonality = {
        bot_name: data?.business_name || 'Restoran Asistanı',
        tone: 'friendly',
        use_emojis: true,
        greeting_style: 'Merhaba {name}! Ben {bot_name}. Size nasıl yardımcı olabilirim?',
        special_phrases: ['Afiyet olsun!', 'Sizi bekliyoruz!'],
        menu_highlights: [],
        response_length: 'short'
    };

    return { ...defaultPersonality, ...data?.ai_personality };
}

// Get prompt template from database
async function getPromptTemplate(tenantId: string): Promise<string | null> {
    try {
        // 1. Get tenant config
        const { data: config } = await supabase
            .from('tenant_configs')
            .select('business_type, ai_config')
            .eq('tenant_id', tenantId)
            .single();

        if (!config) return null;

        // 2. Get prompt template of type 'universal_agent'
        const { data: template } = await supabase
            .from('prompt_templates')
            .select('template_text')
            .eq('type', 'universal_agent')
            .single();

        if (!template?.template_text) return null;

        // 3. Get menu context (active products list)
        const menuContext = await getMenuContext(tenantId);

        // 4. Extract parameters from ai_config
        const aiConfig = (config.ai_config as any) || {};
        const storeName = aiConfig.store_name || "İşletme";
        const tone = aiConfig.tone || "samimi ve sıcak";
        const emojis = aiConfig.use_emojis ? "Bol bol ilgili emoji kullan." : "Emoji kullanma, sadece metin yaz.";
        const sector = config.business_type === 'restaurant' ? 'Restoran' 
                     : config.business_type === 'florist' ? 'Çiçekçi' 
                     : config.business_type === 'hookah_lounge' ? 'Nargile Salonu' 
                     : config.business_type === 'dry_cleaning' ? 'Kuru Temizleme' 
                     : 'Ticaret';

        // 5. Replace placeholders
        let prompt = template.template_text
            .replace(/\{\{MAGAZA_ADI\}\}/g, storeName)
            .replace(/\{\{TON\}\}/g, tone)
            .replace(/\{\{SEKTOR\}\}/g, sector)
            .replace(/\{\{MENU_CONTEXT\}\}/g, menuContext || 'Katalog bilgisi bulunamadı.')
            .replace(/\{\{EMOJI_RULES\}\}/g, emojis);

        return prompt;
    } catch (e) {
        console.error("Error loading prompt template:", e);
        return null;
    }
}

// Get recent conversation history for context
async function getConversationHistory(tenantId: string, customerPhone: string, limit: number = 5): Promise<Array<{ role: string, content: string }>> {
    const { data } = await supabase
        .from('conversation_logs')
        .select('role, content')
        .eq('tenant_id', tenantId)
        .eq('customer_phone', customerPhone)
        .order('created_at', { ascending: false })
        .limit(limit);

    return (data || []).reverse().map(m => ({
        role: m.role as string,
        content: m.content as string
    }));
}

// Log conversation for learning
async function logConversation(tenantId: string, customerPhone: string, role: 'user' | 'assistant', content: string) {
    await supabase.from('conversation_logs').insert({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        role: role,
        content: content.substring(0, 1000)
    });
}

// Get menu items for context (using products)
async function getMenuContext(tenantId: string): Promise<string> {
    const { data } = await supabase
        .from('products')
        .select('name, price, meta_data')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(20);

    if (!data || data.length === 0) return '';

    const grouped = data.reduce((acc: Record<string, string[]>, item) => {
        const cat = (item.meta_data as any)?.category || 'Diğer';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(`${item.name} (${item.price} TL)`);
        return acc;
    }, {});

    return Object.entries(grouped)
        .map(([cat, items]) => `${cat}: ${items.join(', ')}`)
        .join('\n');
}

// Enhanced AI response with personality and context
async function getAIResponse(text: string, customerName: string, tenantId?: string, language: Language = 'tr'): Promise<string> {
    if (!OPENAI_API_KEY) {
        return t('menu_prompt', language, { url: 'menu' });
    }

    const personality = tenantId ? await getAIPersonality(tenantId) : {
        bot_name: 'Restoran Asistanı',
        tone: 'friendly',
        use_emojis: true,
        response_length: 'short',
        special_phrases: [],
        menu_highlights: []
    } as AIPersonality;

    // Get conversation history for context
    const history = tenantId
        ? await getConversationHistory(tenantId, '', 5)
        : [];

    // Get menu context
    const menuContext = tenantId ? await getMenuContext(tenantId) : '';

    // Try to get custom template first
    const customTemplate = tenantId ? await getPromptTemplate(tenantId) : null;

    // Language instruction map
    const langInstruction: Record<Language, string> = {
        tr: 'Türkçe yanıt ver.',
        en: 'Respond in English.',
        ar: 'الرد باللغة العربية.',
        de: 'Antworte auf Deutsch.',
        ru: 'Отвечай на русском языке.'
    };

    let systemPrompt = "";

    if (customTemplate) {
        // Use the custom template from database (already has placeholders replaced)
        systemPrompt = customTemplate;

        // Add dynamic rules including language
        systemPrompt += `\n\nDİL: ${langInstruction[language]}\nMüşteri Adı: ${customerName || 'Değerli Müşteri'}\n`;
    } else {
        // Fallback to default personality builder
        const toneGuide = {
            formal: 'Resmi ve kibar bir dil kullan. "Siz" hitabı kullan.',
            friendly: 'Samimi ve sıcak bir dil kullan. Müşteriyle arkadaş gibi konuş.',
            casual: 'Rahat ve günlük bir dil kullan. Genç ve dinamik bir üslup.',
            professional: 'Profesyonel ama sıcak bir dil kullan. Bilgilendirici ol.'
        };

        const lengthGuide = {
            short: 'Cevapların 1-2 cümle olsun. Kısa ve öz.',
            medium: 'Cevapların 2-4 cümle olsun. Yeterince açıklayıcı.',
            detailed: 'Detaylı ve kapsamlı cevaplar ver. Bilgilendirici ol.'
        };

        systemPrompt = `Sen "${personality.bot_name}" adında bir restoran asistanısın.

KONUŞMA STİLİ:
${toneGuide[personality.tone || 'friendly']}
${lengthGuide[personality.response_length || 'short']}
${personality.use_emojis ? 'Uygun yerlerde emoji kullan. 🍔🍕🎉' : 'Emoji kullanma.'}

ÖZEL İFADELER (uygun yerlerde kullan):
${personality.special_phrases?.join(', ') || 'Afiyet olsun!'}

${menuContext ? `MENÜ BİLGİSİ:\n${menuContext}` : ''}

${personality.menu_highlights?.length ? `ÖNERİLECEK ÜRÜNLER: ${personality.menu_highlights.join(', ')}` : ''}

KURALLAR:
1. Her zaman Türkçe cevap ver
2. Müşterinin adı: ${customerName || 'Değerli Müşteri'}
3. Sipariş almak istiyorsan dijital menüyü öner
4. Fiyat soran müşteriye menüden bilgi ver
5. Robot gibi değil, gerçek bir insan gibi konuş
6. Konuşma akışını koru, önceki mesajları hatırla
7. Şikayet varsa önce empati kur

ÖNEMLİ: Doğal ve samimi ol. Kalıp cevaplar verme.`;
    }

    const messages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: text }
    ];

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
                max_tokens: personality.response_length === 'detailed' ? 400 : 200,
                temperature: 0.8, // Slightly more creative
            }),
        });

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || "Anlayamadım, lütfen tekrar dener misiniz?";

        // Log conversation for learning (async, don't wait)
        if (tenantId) {
            logConversation(tenantId, '', 'user', text);
            logConversation(tenantId, '', 'assistant', aiResponse);
        }

        return aiResponse;
    } catch (e) {
        console.error("AI response error:", e);
        return "Bir hata oluştu. Lütfen tekrar deneyin.";
    }
}

// ===================== WHATSAPP API =====================
async function sendWhatsAppMessage(to: string, text: string) {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) return;

    try {
        await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: text },
            }),
        });
    } catch (e) {
        console.error("Error sending WhatsApp message:", e);
    }
}

// === NEW: TEMPLATE MESSAGE SUPPORT ===
async function sendWhatsAppTemplate(
    to: string,
    templateName: string,
    languageCode: string = "tr",
    components: any[] = []
) {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) return;

    try {
        const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    components
                }
            }),
        });
        return await response.json();
    } catch (e) {
        console.error("Error sending template:", e);
    }
}

// Send WhatsApp Image with caption
async function sendWhatsAppImage(to: string, imageUrl: string, caption: string) {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
        console.error("WhatsApp credentials missing");
        return;
    }

    const response = await fetch(
        `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "image",
                image: {
                    link: imageUrl,
                    caption: caption
                },
            }),
        }
    );

    const data = await response.json();
    console.log("Image sent:", data);
    return response.ok;
}

async function sendWhatsAppInteractive(payload: any) {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
        console.error("WhatsApp credentials missing");
        return;
    }

    const response = await fetch(
        `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }
    );

    const data = await response.json();
    console.log("Interactive sent:", data);
}

// ===================== SENTIMENT ANALYSIS SYSTEM =====================

interface SentimentResult {
    score: number;      // 1-10 (1=happy, 10=very angry)
    reason: string;
    category: 'normal' | 'mild' | 'moderate' | 'high' | 'critical';
}

interface CouponConfig {
    mild_coupon_amount: number;      // 4-5 score
    moderate_coupon_amount: number;  // 6-7 score
    high_coupon_amount: number;      // 8-9 score
    critical_coupon_amount: number;  // 10 score
    monthly_limit: number;           // Total monthly coupon budget
    enabled: boolean;
}

// Analyze customer sentiment using GPT
async function analyzeSentiment(text: string): Promise<SentimentResult> {
    // Fallback for no API key
    if (!OPENAI_API_KEY) {
        return { score: 1, reason: 'No AI available', category: 'normal' };
    }

    // Quick keyword check for obvious anger
    const angryKeywords = [
        'rezalet', 'berbat', 'çöp', 'iğrenç', 'allah', 'lanet',
        'sikeyim', 'siktir', 'amk', 'bok', 'pislik', 'saçmalık',
        'şikayet', 'şikayette', 'tüketici', 'mahkeme', 'avukat',
        'para iade', 'geri iste', 'bir daha almam', 'asla'
    ];

    const moderateKeywords = [
        'bekliyorum', 'geç', 'hala gelmedi', 'nerede', 'çok bekledim',
        'sinir', 'kızgın', 'memnun değil', 'hayal kırıklığı'
    ];

    const lowerText = text.toLowerCase();

    // Quick check for critical anger (profanity)
    if (angryKeywords.some(k => lowerText.includes(k))) {
        return {
            score: 9,
            reason: 'Angry keywords detected',
            category: 'high'
        };
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a customer sentiment analyzer for a Turkish restaurant.
Analyze the customer message and return a JSON with:
- score: 1-10 (1=very happy, 5=neutral, 10=extremely angry)
- reason: brief explanation in Turkish
- category: 'normal'(1-3), 'mild'(4-5), 'moderate'(6-7), 'high'(8-9), 'critical'(10)

Be sensitive to Turkish expressions of frustration. Look for:
- Complaints about delays ("çok beklettiniz", "hala gelmedi")
- Quality issues ("soğuk geldi", "yanlış geldi")  
- Threats to leave ("bir daha almam", "şikayet edeceğim")
- Profanity or insults

Return ONLY valid JSON.`,
                    },
                    { role: "user", content: text },
                ],
                response_format: { type: "json_object" },
                max_tokens: 100,
            }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
            const parsed = JSON.parse(content);
            return {
                score: parsed.score || 1,
                reason: parsed.reason || 'Unknown',
                category: parsed.category || 'normal'
            };
        }
    } catch (e) {
        console.error("Sentiment analysis error:", e);
    }

    // Fallback: check for moderate keywords
    if (moderateKeywords.some(k => lowerText.includes(k))) {
        return { score: 5, reason: 'Possible frustration detected', category: 'mild' };
    }

    return { score: 1, reason: 'Normal message', category: 'normal' };
}

// Get tenant's coupon configuration
async function getTenantCouponConfig(tenantId: string): Promise<CouponConfig> {
    const { data } = await supabase
        .from('tenants')
        .select('sentiment_config')
        .eq('id', tenantId)
        .single();

    // Default config if not set
    const defaultConfig: CouponConfig = {
        mild_coupon_amount: 0,       // No coupon for mild
        moderate_coupon_amount: 25,  // 25 TL for moderate
        high_coupon_amount: 50,      // 50 TL for high
        critical_coupon_amount: 100, // 100 TL for critical
        monthly_limit: 500,          // 500 TL monthly limit
        enabled: true
    };

    return data?.sentiment_config || defaultConfig;
}

// Check if monthly coupon limit is exceeded
async function getMonthlyTotal(tenantId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data } = await supabase
        .from('coupons')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('type', 'anger_recovery')
        .gte('created_at', startOfMonth.toISOString());

    return (data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
}

// Generate coupon for angry customer
async function generateAngryCustomerCoupon(
    tenantId: string,
    customerPhone: string,
    customerName: string,
    score: number,
    reason: string
): Promise<{ code: string; amount: number } | null> {
    const config = await getTenantCouponConfig(tenantId);

    if (!config.enabled) {
        console.log("Coupon system disabled for tenant");
        return null;
    }

    // Determine coupon amount based on score
    let amount = 0;
    if (score >= 10) amount = config.critical_coupon_amount;
    else if (score >= 8) amount = config.high_coupon_amount;
    else if (score >= 6) amount = config.moderate_coupon_amount;
    else if (score >= 4) amount = config.mild_coupon_amount;

    if (amount === 0) {
        console.log("No coupon for this anger level");
        return null;
    }

    // Check monthly limit
    const monthlyTotal = await getMonthlyTotal(tenantId);
    if (monthlyTotal + amount > config.monthly_limit) {
        console.log(`Monthly limit exceeded: ${monthlyTotal}/${config.monthly_limit}`);
        return null;
    }

    // Generate unique coupon code
    const code = `OZUR${Date.now().toString(36).toUpperCase()}`;

    // Save coupon to database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    await supabase.from('coupons').insert({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        code: code,
        amount: amount,
        type: 'anger_recovery',
        reason: reason,
        anger_score: score,
        expires_at: expiresAt.toISOString()
    });

    console.log(`Generated coupon ${code} for ${amount} TL (score: ${score})`);
    return { code, amount };
}

// Log sentiment event
async function logSentiment(
    tenantId: string,
    customerPhone: string,
    message: string,
    score: number,
    actionTaken: string
) {
    await supabase.from('sentiment_logs').insert({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        message: message.substring(0, 500), // Limit message length
        anger_score: score,
        action_taken: actionTaken
    });
}

// Notify manager about angry customer
async function notifyManager(
    tenantId: string,
    customerPhone: string,
    customerName: string,
    message: string,
    score: number
) {
    // Get manager phone from tenant
    const { data: tenant } = await supabase
        .from('tenants')
        .select('manager_phone, business_name')
        .eq('id', tenantId)
        .single();

    if (!tenant?.manager_phone) {
        console.log("No manager phone configured");
        return;
    }

    const urgency = score >= 10 ? '🚨 KRİTİK' : '⚠️ ACİL';
    const notification = `${urgency} MÜŞTERİ ŞİKAYETİ

📍 ${tenant.business_name}
👤 Müşteri: ${customerName || 'Bilinmiyor'}
📱 Tel: ${customerPhone}
😠 Sinir Seviyesi: ${score}/10

💬 Mesaj:
"${message.substring(0, 200)}${message.length > 200 ? '...' : ''}"

⏰ Hemen müdahale önerilir.`;

    await sendWhatsAppMessage(tenant.manager_phone, notification);
    console.log(`Manager notified: ${tenant.manager_phone}`);
}

// Main function to handle sentiment in messages
async function handleSentiment(msg: MessageData, session: DbSession): Promise<boolean> {
    if (!session.tenant_id) return false;

    const sentiment = await analyzeSentiment(msg.messageText);
    console.log(`Sentiment: score=${sentiment.score}, category=${sentiment.category}`);

    // Only act on score >= 4
    if (sentiment.score < 4) {
        return false;
    }

    // Log all concerning messages
    let actionTaken = 'logged';

    // Score 6+: Send empathetic response
    if (sentiment.score >= 6) {
        const empathy = sentiment.score >= 8
            ? `Gerçekten çok üzgünüz ${msg.customerName || ''}. Bu durumu hemen düzelteceğiz.`
            : `Sizi anlıyoruz ${msg.customerName || ''}. Yaşadığınız için özür dileriz.`;

        await sendWhatsAppMessage(msg.customerPhone, empathy);
        actionTaken = 'empathy_sent';
    }

    // Score 8+: Generate coupon + notify manager
    if (sentiment.score >= 8) {
        const coupon = await generateAngryCustomerCoupon(
            session.tenant_id,
            msg.customerPhone,
            msg.customerName || '',
            sentiment.score,
            sentiment.reason
        );

        if (coupon) {
            await sendWhatsAppMessage(
                msg.customerPhone,
                `🎁 Özür hediyemiz:\n\nKod: ${coupon.code}\nDeğer: ${coupon.amount} TL\n\nBir sonraki siparişinizde kullanabilirsiniz. 30 gün geçerlidir.\n\nTeşekkür ederiz. 🙏`
            );
            actionTaken = 'coupon_sent';
        }

        // Notify manager for high anger
        await notifyManager(
            session.tenant_id,
            msg.customerPhone,
            msg.customerName || '',
            msg.messageText,
            sentiment.score
        );
        actionTaken += '_manager_notified';
    }

    // Log the event
    await logSentiment(
        session.tenant_id,
        msg.customerPhone,
        msg.messageText,
        sentiment.score,
        actionTaken
    );

    // Return true if we handled it (score >= 6 means we sent a response)
    return sentiment.score >= 6;
}

// ===================== SMART PRODUCT SEARCH =====================

interface ProductMatch {
    id: string;
    name: string;
    price: number;
    category: string;
    is_combo: boolean;
}

// Search products in menu by keyword
async function searchProductsInMenu(tenantId: string, keyword: string): Promise<ProductMatch[]> {
    const normalizedKeyword = keyword.toLowerCase()
        .replace(/hamburger/g, 'burger')
        .replace(/humberger/g, 'burger')
        .replace(/patetes/g, 'patates')
        .replace(/koka/g, 'kola');

    const { data } = await supabase
        .from('products')
        .select('id, name, price, meta_data')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .ilike('name', `%${normalizedKeyword}%`);

    if (!data || data.length === 0) return [];

    return data.map(item => {
        const category = (item.meta_data as any)?.category || 'Diğer';
        return {
            id: item.id,
            name: item.name,
            price: item.price,
            category,
            is_combo: /menü|menu|combo|set/i.test(item.name) || /menü|menu|combo|set/i.test(category)
        };
    });
}

// Send product choices to customer
async function sendProductChoiceMessage(msg: MessageData, tenantId: string, products: ProductMatch[], keyword: string) {
    const singles = products.filter(p => !p.is_combo);
    const combos = products.filter(p => p.is_combo);

    let message = `🍔 *"${keyword}" için ${products.length} seçenek bulundu:*\n\n`;

    if (singles.length > 0) {
        message += `📍 *TEK ÜRÜN:*\n`;
        singles.forEach((p, i) => {
            message += `${i + 1}. ${p.name} - ${p.price} TL\n`;
        });
        message += '\n';
    }

    if (combos.length > 0) {
        message += `🍟 *MENÜLER:*\n`;
        combos.forEach((p, i) => {
            message += `${singles.length + i + 1}. ${p.name} - ${p.price} TL\n`;
        });
        message += '\n';
    }

    message += `📱 *Dijital menüden malzeme seçimi yapabilirsiniz!*\n\nNumara yazın veya "menü" yazarak dijital menüye gidin.`;

    await sendWhatsAppMessage(msg.customerPhone, message);
}

// Handle product search intent
async function handleProductSearch(msg: MessageData, session: DbSession, keyword: string) {
    if (!session.tenant_id) return false;

    const products = await searchProductsInMenu(session.tenant_id, keyword);

    if (products.length === 0) {
        await sendWhatsAppMessage(
            msg.customerPhone,
            `"${keyword}" ile eşleşen ürün bulunamadı. 📱 Dijital menüye göz atabilirsiniz!\n\n"menü" yazarak menüye ulaşabilirsiniz.`
        );
        return true;
    }

    await sendProductChoiceMessage(msg, session.tenant_id, products, keyword);
    return true;
}

// ===================== SECURITY SYSTEM =====================

interface SecurityResult {
    allowed: boolean;
    risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
    require_otp: boolean;
    require_callback: boolean;
    block_order: boolean;
}

interface SecurityConfig {
    enabled: boolean;
    require_otp_first_order: boolean;
    otp_expiry_minutes: number;
    max_orders_per_hour: number;
    high_value_threshold: number;
    cash_on_delivery_verification: boolean;
    block_foreign_numbers: boolean;
    foreign_number_require_callback: boolean;
}

// Check if phone number is Turkish
function isTurkishNumber(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    // Standard TR format: 905XXXXXXXXX or 05XXXXXXXXX
    return cleaned.startsWith('90') || (cleaned.startsWith('0') && cleaned.length === 11) || (cleaned.length === 10 && cleaned.startsWith('5'));
}

// === NEW: OPERATING HOURS LOGIC ===
async function checkOperatingHours(openingHours: any): Promise<boolean> {
    if (!openingHours) return true; // Default to open if no config

    try {
        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = days[now.getDay()];

        // Find today's config
        const todayConfig = openingHours[currentDay];
        if (!todayConfig) return true;
        if (todayConfig.closed) return false;

        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startH, startM] = todayConfig.open.split(':').map(Number);
        const [endH, endM] = todayConfig.close.split(':').map(Number);

        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        return currentTime >= startTime && currentTime <= endTime;
    } catch (e) {
        console.error("Error checking hours:", e);
        return true;
    }
}

// Get tenant's security configuration
async function getSecurityConfig(tenantId: string): Promise<SecurityConfig> {
    const { data } = await supabase
        .from('tenants')
        .select('security_config')
        .eq('id', tenantId)
        .single();

    const defaultConfig: SecurityConfig = {
        enabled: true,
        require_otp_first_order: true,
        otp_expiry_minutes: 5,
        max_orders_per_hour: 3,
        high_value_threshold: 500,
        cash_on_delivery_verification: true,
        block_foreign_numbers: false,
        foreign_number_require_callback: true
    };

    return { ...defaultConfig, ...data?.security_config };
}

async function getRecentOrderCount(tenantId: string, customerPhone: string, hours: number = 1): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { count, error } = await supabase
        .from('orders')
        .select('id, customers!inner(phone)', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('customers.phone', customerPhone)
        .gte('created_at', since);

    if (error) {
        console.error("Error fetching recent order count:", error);
        return 0;
    }
    return count || 0;
}

// Check if customer is first-time
async function isFirstTimeCustomer(tenantId: string, customerPhone: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('orders')
        .select('id, customers!inner(phone)', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('customers.phone', customerPhone);

    if (error) {
        console.error("Error checking first time customer:", error);
        return false;
    }
    return (count || 0) === 0;
}

// Comprehensive order security check
async function checkOrderSecurity(
    tenantId: string,
    customerPhone: string,
    orderTotal: number,
    paymentMethod: string
): Promise<SecurityResult> {
    const config = await getSecurityConfig(tenantId);

    if (!config.enabled) {
        return { allowed: true, risk_level: 'none', reasons: [], require_otp: false, require_callback: false, block_order: false };
    }

    const result: SecurityResult = {
        allowed: true,
        risk_level: 'none',
        reasons: [],
        require_otp: false,
        require_callback: false,
        block_order: false
    };

    // Only apply cash-on-delivery checks for cash/card payments
    const isCashOnDelivery = paymentMethod === 'cash' || paymentMethod === 'credit_card';
    if (!isCashOnDelivery) {
        return result; // Online payment = no security concerns
    }

    // CHECK 0: Low Trust Score (< 30)
    const { data: customerData } = await supabase
        .from('customers')
        .select('trust_score')
        .eq('tenant_id', tenantId)
        .eq('phone', customerPhone)
        .single();

    // If customer exists and has low trust score
    if (customerData && (customerData.trust_score || 50) < 30) {
        result.risk_level = 'critical';
        result.block_order = true;
        result.reasons.push(`⛔ Düşük Güven Skoru(${customerData.trust_score})`);
        result.allowed = false;
        return result;
    }

    // CHECK 1: Foreign number detection
    if (!isTurkishNumber(customerPhone)) {
        result.risk_level = 'critical';
        result.reasons.push('🌍 Yurtdışı numarası tespit edildi');

        if (config.block_foreign_numbers) {
            result.block_order = true;
            result.allowed = false;
        } else if (config.foreign_number_require_callback) {
            result.require_callback = true;
        }
    }

    // CHECK 2: First-time customer
    const isFirstTime = await isFirstTimeCustomer(tenantId, customerPhone);
    if (isFirstTime && config.require_otp_first_order) {
        result.require_otp = true;
        result.reasons.push('🆕 İlk sipariş - doğrulama gerekli');
        if (result.risk_level === 'none') result.risk_level = 'low';
    }

    // CHECK 3: Too many orders in short time
    const recentOrders = await getRecentOrderCount(tenantId, customerPhone, 1);
    if (recentOrders >= config.max_orders_per_hour) {
        result.risk_level = 'high';
        result.reasons.push(`⚠️ Son 1 saatte ${recentOrders} sipariş - şüpheli`);
        result.require_callback = true;
    }

    // CHECK 4: High value order from new customer
    if (isFirstTime && orderTotal >= config.high_value_threshold) {
        if (result.risk_level !== 'critical') result.risk_level = 'high';
        result.reasons.push(`💰 Yüksek tutarlı ilk sipariş: ${orderTotal} TL`);
        result.require_callback = true;
    }

    // CHECK 5: Very high order value (anyone)
    if (orderTotal >= config.high_value_threshold * 2) {
        if (result.risk_level === 'none' || result.risk_level === 'low') {
            result.risk_level = 'medium';
        }
        result.reasons.push(`💰 Çok yüksek tutar: ${orderTotal} TL`);
    }

    // Set allowed based on checks
    if (result.require_otp || result.require_callback) {
        result.allowed = false; // Needs verification first
    }

    return result;
}

// Generate and send OTP
async function sendOTP(tenantId: string, customerPhone: string, purpose: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in database
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await supabase.from('otp_codes').insert({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        code: code,
        purpose: purpose,
        expires_at: expiresAt.toISOString()
    });

    // Send via WhatsApp
    await sendWhatsAppMessage(
        customerPhone,
        `🔐 * Doğrulama Kodu *\n\nSiparişinizi onaylamak için aşağıdaki kodu girin: \n\n * ${code}*\n\n⏰ Bu kod 5 dakika geçerlidir.`
    );

    return code;
}

// Verify OTP code
async function verifyOTP(tenantId: string, customerPhone: string, inputCode: string): Promise<boolean> {
    const { data } = await supabase
        .from('otp_codes')
        .select('id, code')
        .eq('tenant_id', tenantId)
        .eq('customer_phone', customerPhone)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!data || data.code !== inputCode) {
        return false;
    }

    // Mark as verified
    await supabase
        .from('otp_codes')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', data.id);

    return true;
}

// Log suspicious order
async function logSuspiciousOrder(
    tenantId: string,
    customerPhone: string,
    orderId: string | null,
    reasons: string[],
    riskLevel: string
) {
    await supabase.from('suspicious_orders').insert({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        order_id: orderId,
        reason: reasons.join('; '),
        risk_level: riskLevel
    });

    // Notify manager for high/critical
    if (riskLevel === 'high' || riskLevel === 'critical') {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('manager_phone, business_name')
            .eq('id', tenantId)
            .single();

        if (tenant?.manager_phone) {
            const urgency = riskLevel === 'critical' ? '🚨 KRİTİK' : '⚠️ DİKKAT';
            await sendWhatsAppMessage(
                tenant.manager_phone,
                `${urgency} ŞÜPHELİ SİPARİŞ\n\n📍 ${tenant.business_name} \n📱 Tel: ${customerPhone} \n⚠️ Risk: ${riskLevel.toUpperCase()} \n\n📋 Sebepler: \n${reasons.join('\n')} \n\n🔔 Müşteriyi arayıp teyit almanız önerilir.`
            );
        }
    }
}

// Handle blocked order
async function handleBlockedOrder(msg: MessageData, reasons: string[]) {
    await sendWhatsAppMessage(
        msg.customerPhone,
        `❌ * Sipariş İşleme Alınamadı *\n\nGüvenlik kontrolümüz siparişinizi onaylamadı.\n\n📞 Lütfen mağazamızı arayarak sipariş verebilirsiniz.\n\nAnlayışınız için teşekkür ederiz.`
    );
}

// Handle order requiring callback
async function handleCallbackRequired(msg: MessageData, session: DbSession, reasons: string[]) {
    await sendWhatsAppMessage(
        msg.customerPhone,
        `📞 * Teyit Gerekli *\n\nSiparişiniz güvenlik kontrolünden geçti.Onay için mağazamız sizi kısa süre içinde arayacaktır.\n\n⏰ Lütfen telefonunuzu açık tutun.\n\nTeşekkürler!`
    );

    // Notify manager immediately
    if (session.tenant_id) {
        await logSuspiciousOrder(session.tenant_id, msg.customerPhone, null, reasons, 'medium');
    }
}

// ===================== COMPLAINT MANAGEMENT =====================

// Update customer trust score
async function updateTrustScore(tenantId: string, customerPhone: string, change: number) {
    // Determine customer ID first
    const { data: customers } = await supabase
        .from('customers')
        .select('id, trust_score, complaint_count')
        .eq('tenant_id', tenantId)
        .eq('phone', customerPhone)
        .limit(1);

    const customer = customers?.[0];

    if (!customer) return; // Customer not found

    const newScore = Math.max(0, Math.min(100, (customer.trust_score || 50) + change));
    const newCount = (customer.complaint_count || 0) + (change < 0 ? 1 : 0);

    await supabase
        .from('customers')
        .update({
            trust_score: newScore,
            complaint_count: newCount,
            last_complaint_date: change < 0 ? new Date().toISOString() : undefined
        })
        .eq('id', customer.id);

    console.log(`Trust score updated: ${customer.trust_score} -> ${newScore} `);
}

// Create support ticket
async function createSupportTicket(
    tenantId: string,
    customerPhone: string,
    issueType: string,
    message: string,
    aiScore: number
): Promise<string | null> {
    // Get customer ID
    const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', customerPhone)
        .single();

    if (!customers) return null;

    const { data } = await supabase
        .from('support_tickets')
        .insert({
            tenant_id: tenantId,
            customer_id: customers.id,
            status: 'open',
            issue_type: issueType,
            ai_confidence_score: aiScore,
            resolution_action: 'pending',
            created_at: new Date().toISOString()
        })
        .select('id')
        .single();

    return data?.id || null;
}

// Handle complaint logic
async function handleComplaint(msg: MessageData, session: DbSession) {
    if (!session.tenant_id) return;

    // 1. Analyze sentiment specifically for complaint type
    // Simple keyword analysis for now (can be GPT enhanced)
    let issueType = 'other';
    const text = msg.messageText.toLowerCase();

    if (text.includes('soğuk') || text.includes('soguk')) issueType = 'cold_food';
    else if (text.includes('geç') || text.includes('gecikti')) issueType = 'late_delivery';
    else if (text.includes('yanlış') || text.includes('eksik')) issueType = 'wrong_item';
    else if (text.includes('kötü') || text.includes('beğenmedim')) issueType = 'taste_issue';

    // 2. Reduce trust score (-5 points)
    await updateTrustScore(session.tenant_id, msg.customerPhone, -5);

    // 3. Create support ticket
    await createSupportTicket(
        session.tenant_id,
        msg.customerPhone,
        issueType,
        msg.messageText,
        80 // AI confidence placeholder
    );

    // 4. Generate AI Apology & Resolution
    let prompt = `Müşteri bir şikayette bulundu.Sorun tipi: ${issueType}.
Müşteri mesajı: "${msg.messageText}"

Nazikçe özür dile, sorunu anladığını belirt ve çözüm için yöneticiye ilettiğini söyle.
Eğer sorun "soğuk" veya "geç" ise, bir dahaki sefere daha dikkatli olacağımızı samimiyetle belirt.
Kısa ve yapıcı ol.`;

    const response = await getAIResponse(msg.messageText, msg.customerName, session.tenant_id, session.language || 'tr');

    // Override AI response for complaints if needed, or append manager notice
    const finalResponse = `${response} \n\n(Destek talebiniz oluşturuldu, yöneticimiz en kısa sürede inceleyecektir.)`;

    await sendWhatsAppMessage(msg.customerPhone, finalResponse);

    // 5. Notify Manager
    const { data: tenant } = await supabase
        .from('tenants')
        .select('manager_phone, business_name')
        .eq('id', session.tenant_id)
        .single();

    if (tenant?.manager_phone) {
        await sendWhatsAppMessage(
            tenant.manager_phone,
            `🚨 YENİ ŞİKAYET\n\n📍 ${tenant.business_name} \n👤 ${msg.customerName} (${msg.customerPhone}) \n⚠️ Tip: ${issueType} \n📝 Mesaj: "${msg.messageText}"\n\nTrust Score güncellendi(-5).`
        );
    }
}

// ===================== ORDER CANCELLATION =====================

// Get last active order for customer
async function getLastActiveOrder(customerPhone: string, tenantId: string) {
    try {
        const { data } = await supabase
            .from('orders')
            .select('id, status, created_at, final_amount')
            .eq('tenant_id', tenantId)
            .eq('meta_data->>customer_phone', customerPhone)
            .in('status', ['received', 'preparing', 'ready', 'paid'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data) {
            return {
                id: data.id,
                status: data.status,
                created_at: data.created_at,
                total: data.final_amount
            };
        }
    } catch (e) {
        console.log("Could not find active order for cancellation check:", e);
    }
    return null;
}

// Cancel order in DB
async function cancelOrderInDB(orderId: string, reason: string) {
    const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: orderId,
        p_cancel_reason: reason
    });

    if (error) {
        console.error("Cancel RPC error, attempting fallback update:", error);
        // Fallback update
        await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId);
    }
    console.log(`Order ${orderId} cancelled: ${reason}`);
}

// Handle cancellation logic
async function handleCancellation(msg: MessageData, session: DbSession) {
    // 1. Check if there is a pending session order (in cart, not yet confirmed)
    if (session.state !== 'idle' || session.pending_order) {
        // Clear session
        await updateDbSession(session.id, {
            state: 'idle',
            pending_order: null,
            customer_address: null
        });
        await sendWhatsAppMessage(msg.customerPhone, "🛒 Sepetiniz ve işleminiz iptal edildi. Yeni bir sipariş vermek isterseniz 'menü' yazabilirsiniz.");
        return;
    }

    if (!session.tenant_id) return;

    // 2. Check for active confirmed order in database
    const lastOrder = await getLastActiveOrder(msg.customerPhone, session.tenant_id);

    if (!lastOrder) {
        await sendWhatsAppMessage(msg.customerPhone, "Aktif bir siparişiniz bulunamadı.");
        return;
    }

    // 3. Status Check
    if (lastOrder.status === 'preparing' || lastOrder.status === 'ready') {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('phone') // Restaurant phone
            .eq('id', session.tenant_id)
            .single();

        await sendWhatsAppMessage(
            msg.customerPhone,
            `⚠️ Üzgünüz, siparişiniz "${lastOrder.status === 'preparing' ? 'Hazırlanıyor' : 'Hazır'}" durumunda olduğu için buradan iptal edemiyoruz.\n\nLütfen restoranı arayın: ${tenant?.phone || 'Restoranla iletişime geçin'} `
        );
        return;
    }

    // 4. Time Window Check (5 minutes)
    const orderTime = new Date(lastOrder.created_at).getTime();
    const currentTime = new Date().getTime();
    const diffMinutes = (currentTime - orderTime) / (1000 * 60);

    if (diffMinutes > 5) {
        await sendWhatsAppMessage(
            msg.customerPhone,
            `⚠️ Siparişinizin üzerinden 5 dakikadan fazla geçtiği için otomatik iptal edemiyoruz.\n\nLütfen restoran ile iletişime geçin.`
        );
        return;
    }

    // 5. Execute Cancellation (Pending & < 5 mins)
    await cancelOrderInDB(lastOrder.id, "Customer requested via WhatsApp");
    await sendWhatsAppMessage(msg.customerPhone, "✅ Siparişiniz başarıyla iptal edildi. Ücret talep edilmeyecektir.");

    // Notify Manager about cancellation
    const { data: tenant } = await supabase
        .from('tenants')
        .select('manager_phone, business_name')
        .eq('id', session.tenant_id)
        .single();

    if (tenant?.manager_phone) {
        await sendWhatsAppMessage(
            tenant.manager_phone,
            `ℹ️ SİPARİŞ İPTALİ\n\n📍 ${tenant.business_name} \n👤 ${msg.customerName} \n💰 Tutar: ${lastOrder.total} TL\n\nMüşteri ilk 5 dk içinde iptal etti.`
        );
    }
}

// ===================== ORDER HISTORY =====================

// Send order history with repeat buttons
async function sendOrderHistory(msg: MessageData, session: DbSession) {
    if (!session.tenant_id) return;

    // Get last 5 completed orders
    const { data: orders } = await supabase
        .from('orders')
        .select(`
            id, final_amount, created_at, status, items,
            customers!inner(phone)
        `)
        .eq('tenant_id', session.tenant_id)
        .eq('customers.phone', msg.customerPhone)
        .in('status', ['completed', 'delivering', 'ready', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(5);

    if (!orders || orders.length === 0) {
        await sendWhatsAppMessage(msg.customerPhone, "📋 Henüz tamamlanmış siparişiniz bulunmuyor.");
        return;
    }

    // Build order history message
    let historyText = "📋 *Son Siparişleriniz*\n\n";

    orders.forEach((order, index) => {
        const date = new Date(order.created_at).toLocaleDateString('tr-TR');
        const itemsList = (order.items as any[]) || [];
        const items = itemsList.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') || 'Ürünler';
        historyText += `${index + 1}. *${date}* - ${order.final_amount} TL\n   📦 ${items}\n\n`;
    });

    historyText += "Tekrar sipariş vermek için numara yazın (örn: 1)";

    // Send as interactive message with buttons if only 1-3 orders
    if (orders.length <= 3) {
        const buttons = orders.slice(0, 3).map((order, i) => ({
            type: "reply",
            reply: {
                id: `repeat_${order.id}`,
                title: `🔁 #${i + 1} Tekrarla`
            }
        }));

        await sendInteractiveButtons(msg.customerPhone, historyText, buttons);
    } else {
        await sendWhatsAppMessage(msg.customerPhone, historyText);
    }
}

// Handle repeat order from history
async function handleRepeatOrder(msg: MessageData, session: DbSession, orderId: string) {
    // Get original order with items
    const { data: originalOrder } = await supabase
        .from('orders')
        .select('id, final_amount, items, meta_data')
        .eq('id', orderId)
        .single();

    if (!originalOrder) {
        await sendWhatsAppMessage(msg.customerPhone, "❌ Sipariş bulunamadı.");
        return;
    }

    const items = (originalOrder.items as any[]) || [];
    const total = originalOrder.final_amount;
    const deliveryAddress = (originalOrder.meta_data as any)?.delivery_address || null;

    // Save to session as pending order
    await updateDbSession(session.id, {
        state: 'awaiting_address',
        pending_order: { items, total },
        customer_address: deliveryAddress
    });

    // Build items text
    const itemsText = items.map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n');

    // If we have saved address, ask to confirm
    if (deliveryAddress) {
        await sendWhatsAppMessage(
            msg.customerPhone,
            `🔁 *Sipariş Tekrarı*\n\n${itemsText}\n\n💰 *Toplam: ${total} TL*\n\n📍 *Son Adres:*\n${deliveryAddress}\n\nAynı adrese mi gönderelim?`
        );

        // Send address confirmation buttons
        await sendInteractiveButtons(msg.customerPhone, "Adres seçin:", [
            { type: "reply", reply: { id: "confirm_address", title: "✅ Evet, bu adres" } },
            { type: "reply", reply: { id: "new_address", title: "📝 Yeni adres" } }
        ]);
    } else {
        await sendWhatsAppMessage(
            msg.customerPhone,
            `🔁 *Sipariş Tekrarı*\n\n${itemsText}\n\n💰 *Toplam: ${total} TL*\n\nLütfen teslimat adresinizi yazın:`
        );
    }
}

// Send interactive buttons helper
async function sendInteractiveButtons(to: string, bodyText: string, buttons: any[]) {
    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: bodyText },
            action: { buttons }
        }
    };

    await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
}

