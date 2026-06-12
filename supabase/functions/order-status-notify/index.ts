// Supabase Edge Function: Order Status Notifier
// Replaces n8n 4_Status_Updater workflow
// Sends WhatsApp notification when order status changes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')

const STATUS_MESSAGES: Record<string, string> = {
    'pending': '📋 Siparişiniz alındı, onay bekleniyor...',
    'confirmed': '✅ Siparişiniz onaylandı! Hazırlanmaya başlandı.',
    'preparing': '👨‍🍳 Siparişiniz hazırlanıyor...',
    'ready': '🍽️ Siparişiniz hazır! Servis edilecek.',
    'out_for_delivery': '🛵 Siparişiniz yola çıktı!',
    'delivered': '🎉 Siparişiniz teslim edildi. Afiyet olsun!',
    'cancelled': '❌ Siparişiniz iptal edildi.',
}

serve(async (req) => {
    try {
        const {
            order_id,
            old_status,
            new_status,
            customer_phone,
            customer_name,
            total
        } = await req.json()

        // Skip if no phone or same status
        if (!customer_phone || old_status === new_status) {
            return new Response(JSON.stringify({ success: true, skipped: true }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Get status message
        const statusMessage = STATUS_MESSAGES[new_status] || `Sipariş durumu: ${new_status}`

        // Build WhatsApp message
        const message = `Merhaba ${customer_name || 'Değerli Müşterimiz'}! 🍔\n\n${statusMessage}\n\n📦 Sipariş No: #${order_id}\n💰 Tutar: ₺${total}\n\nTeşekkürler! 🙏`

        // Send WhatsApp message
        const response = await fetch(
            `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: customer_phone.replace(/\D/g, ''), // Clean phone number
                    type: 'text',
                    text: { body: message }
                }),
            }
        )

        const result = await response.json()

        return new Response(
            JSON.stringify({ success: true, whatsapp_response: result }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Order status notify error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
