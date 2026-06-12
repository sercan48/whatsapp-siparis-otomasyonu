// Supabase Edge Function: New Reseller Alert
// Replaces n8n 5_New_Reseller_Alert workflow
// Notifies super admin when new reseller application is submitted

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')
const ADMIN_PHONE = Deno.env.get('ADMIN_PHONE_NUMBER')

serve(async (req) => {
    try {
        const {
            application_id,
            first_name,
            last_name,
            phone,
            email,
            company_name,
            created_at
        } = await req.json()

        if (!ADMIN_PHONE) {
            console.error('ADMIN_PHONE_NUMBER not configured')
            return new Response(
                JSON.stringify({ success: false, error: 'Admin phone not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Build notification message
        const message = `🛡️ YENİ BAYİ BAŞVURUSU!\n\n` +
            `👤 Ad Soyad: ${first_name} ${last_name}\n` +
            `📞 Telefon: ${phone}\n` +
            `📧 Email: ${email || 'Belirtilmedi'}\n` +
            `🏢 Firma: ${company_name || 'Belirtilmedi'}\n` +
            `📅 Tarih: ${new Date(created_at).toLocaleString('tr-TR')}\n\n` +
            `Admin panelinden onaylayabilirsiniz.`

        // Send WhatsApp message to admin
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
                    to: ADMIN_PHONE.replace(/\D/g, ''),
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
        console.error('Reseller alert error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
