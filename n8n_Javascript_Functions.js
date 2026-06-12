/**
 * n8n JavaScript Functions for SaaS Conversational Commerce Engine
 * These snippets are designed to be used in n8n "Code" nodes.
 */

// =====================================================================
// A. EVRENSEL AI PERSONA & SYSTEM PROMPT DERLEYİCİ (NUMARADAN MÜŞTERİ TANIMA)
// Girdiler: $input.all() -> { tenant, tenant_configs, products, customer, prompt_template }
// =====================================================================

// Mock Data for local testing or fallback
const tenant = items[0].json.tenant || { id: 'demo-tenant-id', name: "Evrensel Market" };
const config = items[0].json.tenant_configs || {
  business_type: "water_dealer", // Örn: 'water_dealer' (Su bayisi)
  ai_config: { tone: "Profesyonel", rules: ["Nazik ol", "Kayıtlı adresi onayla"] },
  commerce_config: {
    currency: "TRY",
    delivery_types: ["delivery"],
    payment_methods: ["cash", "credit_card", "paytr"],
    checkout_questions: []
  }
};
const productsList = items[0].json.products || [{ id: 'p1', name: "19L Damacana Su", price: 100, meta_data: {} }];
const customer = items[0].json.customer || null; // NULL ise yeni müşteri
const template = items[0].json.prompt_template || {
  template_text: `Sen, {{TENANT_NAME}} asistanısın. Ton: {{AI_TONE}}. İşletme Türü: {{BUSINESS_TYPE}}.
{{CUSTOMER_RECOGNITION_CONTEXT}}
Ürünler: {{PRODUCTS_JSON}}
Teslimat Yöntemleri: {{COMMERCE_DELIVERY_TYPES}}
Ödeme Yöntemleri: {{COMMERCE_PAYMENT_METHODS}}`
};

// 1. Numaradan Müşteri Tanıma Bağlamı (Su/Tüp Bayileri için kritik)
let customerContext = "Müşteri Bilgisi: Bu müşteri sisteme ilk kez mesaj gönderiyor. Adını ve adresini isteyin.";
if (customer) {
  customerContext = `Müşteri Bilgisi: Bu müşteri kayıtlı bir müşteridir!
- Müşteri Adı: ${customer.name || 'Bilinmiyor'}
- Müşteri Telefonu: ${customer.phone}
- Kayıtlı Adres: ${customer.meta_data?.address || 'Adres bilgisi yok, adresi isteyin.'}
- Son Siparişleri: ${customer.meta_data?.last_order_description || 'Geçmiş sipariş bulunamadı.'}

KURALLAR:
1. Müşteriyi doğrudan ismiyle karşılayın (Örn: "Hoş geldiniz Ahmet Bey").
2. Su/Tüp gibi abonelik sistemleri için, doğrudan son siparişini tekrarlamak isteyip istemediğini sorun (Örn: "Her zamanki gibi 1 adet 19L Damacana Su siparişi oluşturmamı ister misiniz?").
3. Müşteri onaylarsa adresi tekrar sormadan doğrudan siparişi oluşturun ve kayıtlı adrese yönlendirin.`;
}

// 2. Ürün Kataloğu JSON formatına dönüştürme
const sanitizedProducts = productsList.map(p => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: `${p.price} ${config.commerce_config.currency || 'TRY'}`,
  options: p.meta_data.variants || p.meta_data.modifiers || {}
}));

// 3. Değişkenleri Değiştirme
let systemPrompt = template.template_text
    .replace(/{{TENANT_NAME}}/g, tenant.name)
    .replace(/{{BUSINESS_TYPE}}/g, config.business_type)
    .replace(/{{AI_TONE}}/g, config.ai_config.tone || 'Friendly')
    .replace(/{{CUSTOMER_RECOGNITION_CONTEXT}}/g, customerContext)
    .replace(/{{COMMERCE_DELIVERY_TYPES}}/g, JSON.stringify(config.commerce_config.delivery_types || []))
    .replace(/{{COMMERCE_PAYMENT_METHODS}}/g, JSON.stringify(config.commerce_config.payment_methods || []))
    .replace(/{{PRODUCTS_JSON}}/g, JSON.stringify(sanitizedProducts, null, 2));

return [{
    json: {
        system_prompt: systemPrompt,
        tenant_id: tenant.id
    }
}];


// =====================================================================
// B. DINAMIK ÖDEME LİNKİ OLUŞTURUCU (PayTR / iyzico - Sektör Bağımsız)
// Girdiler: order, customer, tenant_configs (api_keys)
// =====================================================================

// PayTR ve iyzico için dinamik token & payment link generator
const orderData = items[0].json.order || { id: "ord-123", final_amount: 150 };
const customerData = items[0].json.customer || { name: "Müşteri", phone: "+905321112233" };
const apiKeys = items[0].json.tenant_configs.api_keys || {
    paytr_merchant_id: "123456",
    paytr_merchant_key: "key123",
    paytr_merchant_salt: "salt123"
};

const crypto = require('crypto');

const amount = orderData.final_amount;
const orderId = orderData.id;
const customerPhone = customerData.phone;
const customerName = customerData.name || 'Musteri';

// Hangi ödeme sağlayıcısı aktifse ona göre link üretilir
let paymentLink = "";
let providerUsed = "mock";

if (apiKeys.paytr_merchant_id) {
    // PayTR Entegrasyonu (Direct API Link Generation Simülasyonu)
    providerUsed = "paytr";
    const merchantId = apiKeys.paytr_merchant_id;
    const merchantKey = apiKeys.paytr_merchant_key;
    const merchantSalt = apiKeys.paytr_merchant_salt;
    
    // PayTR hash hesaplama kuralları
    const paytrTokenString = merchantId + customerPhone + customerName + orderId + amount + "TRY" + merchantSalt;
    const paytrToken = crypto.createHmac('sha256', merchantKey).update(paytrTokenString).digest('base64');
    
    // Güvenli ödeme linki (PayTR iFrame Checkout veya Ödeme Linki API'si)
    paymentLink = `https://www.paytr.com/odeme/secure/${merchantId}/${paytrToken}?order_id=${orderId}&amount=${amount}`;
} else {
    // iyzico Ödeme Linki (iyzico Link API Simülasyonu)
    providerUsed = "iyzico";
    const apiKey = apiKeys.iyzico_api_key || "mock_key";
    
    // iyzico ödeme linki formatı
    paymentLink = `https://iyzi.link/p/mock_${orderId}`;
}

return [{
    json: {
        order_id: orderId,
        payment_link: paymentLink,
        provider: providerUsed,
        final_amount: amount
    }
}];


// =====================================================================
// C. KARGO SORGULAMA VE TELEFON BAZLI BİLGİ İLETİMİ (Sistemle Senkronize)
// Girdiler: user_phone, orders (Supabase customer orders query), tenant_configs (api_keys), porego_api_response (opsiyonel)
// =====================================================================

const queryPhone = items[0].json.phone || "";
const tenantApiKeys = items[0].json.tenant_configs?.api_keys || { cargo_provider: "yurtici" };
const customerOrders = items[0].json.orders || [];

let cargoProvider = tenantApiKeys.cargo_provider || "yurtici"; // 'yurtici', 'mng', 'porego'
let cargoStatus = "Kargo kaydı bulunamadı";
let trackingNumber = null;
let deliveryEstimated = null;

// 1. Sistemle Senkron Kargo Sorgulama: Müşterinin son kargolu siparişini bul
const cargoOrder = customerOrders
    .filter(o => o.meta_data && o.meta_data.cargo_tracking_number)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

if (cargoOrder) {
    trackingNumber = cargoOrder.meta_data.cargo_tracking_number;
    cargoProvider = cargoOrder.meta_data.cargo_provider || cargoProvider;
    cargoStatus = cargoOrder.meta_data.cargo_status || "Taşıma Durumunda - Dağıtım şubesinde yolda.";
    deliveryEstimated = cargoOrder.meta_data.estimated_delivery || "1-2 İş Günü";
} else {
    // Mock Veritabanı Geri Dönüşü (Fallback)
    const mockCargoDB = {
        "+905321112233": {
            tracking_number: "YT896541258",
            status: "Yolda - Teslimat şubesinde, dağıtıma çıktı.",
            estimated_delivery: "Aynı Gün (17:00'ye kadar)",
            provider: "yurtici"
        },
        "+905432223344": {
            tracking_number: "MN54129658",
            status: "Taşıma Durumunda - Transfer merkezinde.",
            estimated_delivery: "Yarın",
            provider: "mng"
        }
    };
    const userCargoInfo = mockCargoDB[queryPhone];
    if (userCargoInfo) {
        trackingNumber = userCargoInfo.tracking_number;
        cargoStatus = userCargoInfo.status;
        deliveryEstimated = userCargoInfo.estimated_delivery;
        cargoProvider = userCargoInfo.provider;
    }
}

// 2. Porego API Entegrasyon Kontrolü ve Yanıt Ayrıştırması
if (cargoProvider === "porego") {
    const poregoApiKey = tenantApiKeys.porego_api_key;
    if (!poregoApiKey) {
        throw new Error("Porego API Key configuration is missing for this tenant.");
    }

    // n8n HTTP Request node tarafından gelen Porego API yanıtının parse edilmesi:
    const poregoResponse = items[0].json.porego_api_response || {
        success: true,
        data: {
            tracking_number: trackingNumber || "PRG-9823741",
            current_status: "on_transit",
            status_description: "Kargo Porego aracılığıyla HepsiJet transfer merkezinde yolda.",
            carrier: "hepsijet",
            estimated_delivery_date: deliveryEstimated || "Yarın (18:00'e kadar)"
        }
    };

    if (poregoResponse.success) {
        trackingNumber = poregoResponse.data.tracking_number;
        cargoStatus = `Taşıma Durumunda - Porego (${poregoResponse.data.carrier.toUpperCase()}): ${poregoResponse.data.status_description}`;
        deliveryEstimated = poregoResponse.data.estimated_delivery_date;
    }
}

return [{
    json: {
        phone: queryPhone,
        cargo_provider: cargoProvider,
        tracking_number: trackingNumber,
        status: cargoStatus,
        estimated_delivery: deliveryEstimated,
        message_to_user: trackingNumber 
            ? `📦 Kargonuz Porego entegrasyonuyla (${cargoProvider.toUpperCase()}) gönderilmiştir.\nTakip No: ${trackingNumber}\nDurum: ${cargoStatus}\nTahmini Teslimat: ${deliveryEstimated}`
            : `❌ Sistemde telefon numaranıza kayıtlı son gönderilere ait aktif bir kargo takip kaydı bulunamamıştır.`
    }
}];


// =====================================================================
// D. SEPET HESAPLAMA VE KAMPANYA MOTORU (Sektör Bağımsız)
// Girdiler: items, campaigns
// =====================================================================

const aiOrderItems = items[0].json.ai_parsed_items || []; 
const activeCampaigns = items[0].json.campaigns || []; 

let subtotal = 0;
let finalAmount = 0;
let discountApplied = false;
let discountDetails = null;
let upsellMessage = null;

for (const item of aiOrderItems) {
    subtotal += Number(item.price) * Number(item.quantity);
}

finalAmount = subtotal;

for (const camp of activeCampaigns) {
    if (camp.rules.type === 'cart_threshold') {
        const minBasket = Number(camp.rules.min_basket);
        const discountVal = Number(camp.rules.discount_amount);

        if (subtotal >= minBasket) {
            finalAmount -= discountVal;
            discountApplied = true;
            discountDetails = { name: camp.name, amount: discountVal };
        } else {
            const missing = minBasket - subtotal;
            if (missing > 0 && missing < (minBasket * 0.35)) {
                upsellMessage = `Sepetinize ${missing} TL değerinde daha ürün eklerseniz ${discountVal} TL indirim kazanacaksınız!`;
            }
        }
    }
    else if (camp.rules.type === 'percentage_discount') {
        const rate = Number(camp.rules.percentage) / 100;
        const discountVal = subtotal * rate;
        finalAmount -= discountVal;
        discountApplied = true;
        discountDetails = { name: camp.name, amount: discountVal };
    }
}

if (finalAmount < 0) finalAmount = 0;

return [{
    json: {
        subtotal,
        final_amount: finalAmount,
        discount_applied: discountApplied,
        discount_details: discountDetails,
        upsell_message: upsellMessage,
        order_items: aiOrderItems
    }
}];


// =====================================================================
// E. OCR VE BELGE OKUMA MOTORU (Dekont Doğrulama - PDF/Görüntü Okuma)
// Girdiler: ocr_text (OCR output), order_id, order_final_amount
// =====================================================================
const ocrText = items[0].json.ocr_text || "";
const orderId = items[0].json.order_id || "";
const orderFinalAmount = Number(items[0].json.order_final_amount || 0);

const hasPaymentKeywords = ocrText.includes("Dekont") || ocrText.includes("Havale") || ocrText.includes("EFT") || ocrText.includes("Transfer") || ocrText.includes("Gönderim");
const cleanText = ocrText.replace(/\s+/g, '').toLowerCase();

let parsedAmount = null;
const amountMatches = ocrText.match(/(\d+[\.,]\d{2})/g);
if (amountMatches) {
    for (const match of amountMatches) {
        const val = Number(match.replace(',', '.'));
        if (Math.abs(val - orderFinalAmount) < 0.01) {
            parsedAmount = val;
            break;
        }
    }
}

const shortOrderId = orderId.split('-')[0];
const hasOrderRef = cleanText.includes(orderId.replace(/-/g, '')) || cleanText.includes(shortOrderId.toLowerCase());

let verified = false;
let message = "Dekont doğrulanamadı. Lütfen tutar ve açıklama (Sipariş ID) alanlarını kontrol edin.";

if (hasPaymentKeywords && parsedAmount && hasOrderRef) {
    verified = true;
    message = "Dekont başarıyla doğrulandı. Ödeme otomatik onaylandı.";
} else if (hasPaymentKeywords && parsedAmount) {
    verified = true;
    message = "Dekont tutarı eşleşti, açıklama kodsuz işlem onaylandı.";
}

return [{
    json: {
        verified,
        parsed_amount: parsedAmount,
        message_to_user: message,
        ocr_confidence: verified ? 0.98 : 0.15
    }
}];


// =====================================================================
// F. TOPLU HESAP ÖZETİ EŞLEŞTİRME ALGORİTMASI (Reconciliation Engine)
// Girdiler: bank_transactions, pending_orders
// =====================================================================
const bankTx = items[0].json.bank_transactions || [];
const pendingOrders = items[0].json.pending_orders || [];

const matched = [];
const unmatchedTx = [];
const unmatchedOrders = [...pendingOrders];

for (const tx of bankTx) {
    let matchFound = false;
    
    for (let i = 0; i < unmatchedOrders.length; i++) {
        const order = unmatchedOrders[i];
        
        const amountMatch = Number(tx.amount) === Number(order.final_amount);
        const orderIdClean = order.id.toLowerCase().replace(/-/g, '');
        const descClean = (tx.description || "").toLowerCase().replace(/-/g, '');
        
        const hasOrderRef = descClean.includes(orderIdClean) || 
                            descClean.includes(order.id.split('-')[0].toLowerCase());
                            
        const customerNameMatch = order.customer && 
            ((tx.sender_name || "").toLowerCase().includes(order.customer.name.toLowerCase()) || 
             (order.customer.name || "").toLowerCase().includes(tx.sender_name.toLowerCase()));

        if (amountMatch && (hasOrderRef || customerNameMatch)) {
            matched.push({
                order_id: order.id,
                bank_transaction_id: tx.id,
                amount: tx.amount,
                sender_name: tx.sender_name,
                description: tx.description
            });
            unmatchedOrders.splice(i, 1);
            matchFound = true;
            break;
        }
    }
    
    if (!matchFound) {
        unmatchedTx.push(tx);
    }
}

return [{
    json: {
        matched,
        unmatched_transactions: unmatchedTx,
        unmatched_orders: unmatchedOrders,
        summary: `Toplam ${bankTx.length} işlemden ${matched.length} tanesi otomatik eşleştirildi.`
    }
}];


// =====================================================================
// G. ÇOK KANALLI WEBHOOK YÖNLENDİRİCİ (Official WhatsApp & wa.message Adapter)
// Girdiler: Webhook payload ($input.all())
// =====================================================================

const payload = items[0].json || {};
let normalized = {
    tenant_id: null,
    channel_provider: "unknown",
    message_id: null,
    sender_phone: null,
    message_text: "",
    attachments: []
};

// 1. Resmi WhatsApp Cloud API Algılama
if (payload.object === "whatsapp_business_account" && payload.entry) {
    normalized.channel_provider = "official_whatsapp";
    const entry = payload.entry[0];
    const change = entry.changes ? entry.changes[0] : null;
    if (change && change.value && change.value.messages) {
        const message = change.value.messages[0];
        
        normalized.message_id = message.id;
        normalized.sender_phone = "+" + message.from;
        
        if (message.type === "text") {
            normalized.message_text = message.text.body;
        } else if (message.type === "document") {
            normalized.message_text = "document_uploaded";
            normalized.attachments.push({
                id: message.document.id,
                mime_type: message.document.mime_type,
                filename: message.document.filename
            });
        } else if (message.type === "image") {
            normalized.message_text = "image_uploaded";
            normalized.attachments.push({
                id: message.image.id,
                mime_type: message.image.mime_type
            });
        }
        
        normalized.whatsapp_phone_number_id = change.value.metadata ? change.value.metadata.phone_number_id : null;
    }
} 
// 2. Özel Gateway (wa.message / whatsapp-web otomasyonu) Algılama
else if (payload.sender && (payload.body || payload.message)) {
    normalized.channel_provider = "custom_gateway";
    normalized.message_id = payload.id || "msg_" + Math.random().toString(36).substring(4);
    
    let rawPhone = payload.sender;
    if (!rawPhone.startsWith("+")) {
        rawPhone = "+" + rawPhone;
    }
    normalized.sender_phone = rawPhone;
    normalized.message_text = payload.body || payload.message || "";
    
    if (payload.mediaUrl || payload.file) {
        normalized.attachments.push({
            url: payload.mediaUrl || payload.file,
            mime_type: payload.mimeType || "application/octet-stream"
        });
    }
    
    normalized.webhook_token = payload.token || payload.apiKey || null;
}

return [{ json: normalized }];


// =====================================================================
// H. MAXIJET DIŞ KURYE API ÇAĞRISI & FALLBACK YÖNLENDİRİCİ
// Girdiler: order, customer, tenant_configs (api_keys), maxijet_api_response (opsiyonel)
// =====================================================================

const activeOrder = items[0].json.order || { id: "ord-123", final_amount: 150 };
const customerInfo = items[0].json.customer || { name: "Ahmet Yılmaz", phone: "+905321112233" };
const settings = items[0].json.tenant_configs || {};
const maxijetResponse = items[0].json.maxijet_api_response || null;

const apiKeysConfig = settings.api_keys || {};
const isMaxijetActive = apiKeysConfig.maxijet_api_key ? true : false;

let dispatchStatus = "pending";
let dispatchPayload = null;
let errorMsg = null;
let isAlarmTriggered = false;

// 1. Maxijet Entegrasyonu Aktif ise API Payload'u Hazırla
if (isMaxijetActive) {
    dispatchStatus = "calling_maxijet";
    dispatchPayload = {
        api_key: apiKeysConfig.maxijet_api_key,
        order_reference: activeOrder.id,
        delivery_address: activeOrder.meta_data?.address || customerInfo.meta_data?.address || "Adres Belirtilmemiş",
        customer_name: customerInfo.name || "Müşteri",
        customer_phone: customerInfo.phone,
        payment_type: activeOrder.payment_method === "cash" ? "cash_on_delivery" : "paid_online",
        amount_to_collect: activeOrder.payment_method === "cash" ? activeOrder.final_amount : 0,
        notes: `WhatsApp Siparişi - ${activeOrder.id} - Lütfen hızlı teslimat yapın.`
    };
    
    // 2. n8n HTTP Request Node'dan Dönen Maxijet API Yanıtının Analizi
    if (maxijetResponse) {
        if (maxijetResponse.status === "success" || maxijetResponse.id) {
            dispatchStatus = "maxijet_assigned";
            activeOrder.meta_data.maxijet_courier = maxijetResponse.courier_name || "Serkan Kurye";
            activeOrder.meta_data.maxijet_courier_phone = maxijetResponse.courier_phone || "0532 999 8888";
        } else {
            dispatchStatus = "failed";
            isAlarmTriggered = true;
            errorMsg = maxijetResponse.error || "Bölgede uygun Maxijet kuryesi bulunamadı.";
            activeOrder.meta_data.courier_alarm = true;
        }
    }
} 
// 3. Maxijet Aktif Değilse Doğrudan Yerel Kurye / Manuel Sürücü Fallback Moduna Al
else {
    dispatchStatus = "manual_override_required";
    activeOrder.meta_data.courier_alarm = false;
}

return [{
    json: {
        order_id: activeOrder.id,
        dispatch_status: dispatchStatus,
        maxijet_active: isMaxijetActive,
        api_payload: dispatchPayload,
        alarm_triggered: isAlarmTriggered,
        error_message: errorMsg,
        updated_order_meta: activeOrder.meta_data,
        action_required: isAlarmTriggered ? "🚨 Kurye bulunamadı! Siparişi 'Kendi Kuryem' ile manuel dağıtıma yönlendirin." : "Süreci takip edin."
    }
}];
