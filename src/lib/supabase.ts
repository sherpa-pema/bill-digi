import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SyncConfig } from '../types';
import { getItem, STORAGE_KEYS } from './storage';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  // Try to get config from environment variables first
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    supabaseInstance = createClient(envUrl, envKey);
    return supabaseInstance;
  }

  // Fallback to local storage config
  const config = getItem<SyncConfig>(STORAGE_KEYS.SYNC_CONFIG);
  if (config && config.supabaseUrl && config.supabaseAnonKey) {
    supabaseInstance = createClient(config.supabaseUrl, config.supabaseAnonKey);
    return supabaseInstance;
  }

  return null;
};

export const resetSupabaseClient = () => {
  supabaseInstance = null;
};
