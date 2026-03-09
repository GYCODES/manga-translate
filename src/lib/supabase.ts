import { createClient } from '@supabase/supabase-js';

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ENV?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_ANON_KEY?: string;
    };
  }
}

// Fallback logic: check injected runtime ENV first, then Vite build-time ENV
const supabaseUrl = window.ENV?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = window.ENV?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Debug identification for Render logs
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase credentials missing! App features will be broken. Check Render ENV settings.");
} else {
    console.log("Supabase initialized with URL:", supabaseUrl.substring(0, 10) + "...");
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);
