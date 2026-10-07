import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  // Retrieve configuration strictly from verified environment variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    supabaseInstance = createClient(envUrl, envKey);
    return supabaseInstance;
  }

  return null;
};

export const resetSupabaseClient = () => {
  supabaseInstance = null;
};
