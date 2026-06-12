
const { createClient } = require('@supabase/supabase-js');
const result = require('dotenv').config({ path: './frontend/.env.local' });
if (result.error) {
    console.log('Error loading .env.local:', result.error);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Try multiple common names for service key
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

console.log('Loaded Keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY in .env.local');
    console.log('Please ensure you have a .env.local file in ./frontend/ with these keys.');
    console.log('If you only have ANON key, you cannot update passwords via script. You must use the dashboard.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const email = 'sercanacar48@gmail.com';
const newPassword = process.argv[2] || '3521517';

async function updatePassword() {
    console.log(`Updating password for ${email}...`);

    // First, find the user to get ID (optional, update user by email works efficiently usually by getting user first)
    // Actually admin.updateUserById is safer if we know ID, but logic typically is listUsers or similar.
    // BUT supabase.auth.admin.updateUserById requires ID.

    // Let's try to find user by email first
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('List users error:', listError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error(`User ${email} not found!`);
        // Try creating it if not exists? User requested update, but if not found, maybe create?
        // User said "eklmişiz" (we added it), so it should be there.
        return;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    );

    if (error) {
        console.error('Error updating password:', error.message);
    } else {
        console.log(`✅ Password updated successfully into: ${newPassword}`);
        console.log(`User ID: ${data.user.id}`);
        console.log(`Login Link: ${supabaseUrl}/auth/v1/verify?token=${data.user.confirmation_token}&type=signup&redirect_to=${encodeURIComponent(supabaseUrl)} (If confirmation needed)`);
        console.log('Or just login at /admin or /login page with new password.');
    }
}

updatePassword();
