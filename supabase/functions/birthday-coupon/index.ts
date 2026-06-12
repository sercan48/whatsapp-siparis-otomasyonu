// Supabase Edge Function: Birthday Coupon Sender
// Replaces n8n 6_Customer_Retention workflow
// Called daily by pg_cron to send birthday coupons

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
    try {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

        // Find customers with birthday today
        const today = new Date()
        const month = today.getMonth() + 1
        const day = today.getDate()

        const { data: birthdayCustomers, error } = await supabase
            .from('customers')
            .select('id, name, phone, tenant_id, birth_date')
            .not('phone', 'is', null)
            .not('birth_date', 'is', null)

        if (error) {
            throw error
        }

        // Filter customers with birthday today
        const todaysBirthdays = birthdayCustomers?.filter(customer => {
            if (!customer.birth_date) return false
            const birthDate = new Date(customer.birth_date)
            return birthDate.getMonth() + 1 === month && birthDate.getDate() === day
        }) || []

        console.log(`Found ${todaysBirthdays.length} customers with birthday today`)

        // Send birthday messages
        const results = []
        for (const customer of todaysBirthdays) {
            const message = `🎂 Doğum Gününüz Kutlu Olsun ${customer.name}!\n\n` +
                `Bugüne özel %20 İNDİRİM Kuponunuz: DOGUMGUNU\n\n` +
                `Bu mesajı kasada göstererek indirimi kullanabilirsiniz.\n\n` +
                `🎁 Nice mutlu yıllara! 🎈`

            try {
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
                            to: customer.phone.replace(/\D/g, ''),
                            type: 'text',
                            text: { body: message }
                        }),
                    }
                )

                const result = await response.json()
                results.push({ customer_id: customer.id, success: true, result })

                // Log the coupon usage
                await supabase.from('coupon_logs').insert({
                    customer_id: customer.id,
                    tenant_id: customer.tenant_id,
                    coupon_code: 'DOGUMGUNU',
                    type: 'birthday',
                    discount_percent: 20,
                    sent_at: new Date().toISOString()
                })

            } catch (sendError) {
                results.push({ customer_id: customer.id, success: false, error: sendError.message })
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                total_birthdays: todaysBirthdays.length,
                results
            }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Birthday coupon error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
