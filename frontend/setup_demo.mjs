import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve('.env.local');
console.log('Reading env from:', envPath);

try {
    const envContent = fs.readFileSync(envPath, 'utf8');

    const parseEnv = (content) => {
        const env = {};
        content.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes
                if (key && value) env[key] = value;
            }
        });
        return env;
    };

    const env = parseEnv(envContent);

    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
        console.error('Missing keys in .env.local');
        process.exit(1);
    }

    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    async function main() {
        // 1. Try to find existing demo tenant
        let { data: tenant } = await supabase.from('tenants').select('id').eq('slug', 'demo-burger').single();

        if (!tenant) {
            console.log('Demo tenant not found, creating...');
            const { data: newTenant, error } = await supabase.from('tenants').insert({
                name: 'Demo Burger',
                slug: 'demo-burger',
                is_active: true,
                subscription_fee: 0
            }).select().single();

            if (error) {
                console.error('Error creating demo tenant:', error);
                // Fallback: get any tenant
                const { data: anyTenant } = await supabase.from('tenants').select('id').limit(1).single();
                if (anyTenant) {
                    console.log('FALLBACK_TENANT_ID:', anyTenant.id);
                } else {
                    console.error('No tenants found at all.');
                }
                return;
            }
            tenant = newTenant;
        }

        console.log('SUCCESS_TENANT_ID:', tenant.id);
    }

    main();

} catch (err) {
    console.error('Failed to read .env.local:', err.message);
}
