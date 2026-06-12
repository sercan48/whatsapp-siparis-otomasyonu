import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseInstance = null;

if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
} else {
    console.error('Supabase keys are missing! Check .env.local')
}

export const supabase = supabaseInstance || {
    from: () => ({
        select: () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' } }),
        channel: () => ({ on: () => ({ subscribe: () => { } }), unsubscribe: () => { } }),
        removeChannel: () => { }
    })
}
