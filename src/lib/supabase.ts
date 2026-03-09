import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase credentials missing! App features will be broken. Ensure you added VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.");
} else {
    console.log("Supabase initialized with URL:", supabaseUrl.substring(0, 10) + "...");
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);

// Debug identification for Vercel logs
(window as any).supabaseDebug = {
    client: supabase,
    url: supabaseUrl,
    keyPresent: !!supabaseAnonKey
};
