import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const REMEMBER_DEVICE_STORAGE_KEY = 'sb_remember_device';

/**
 * Configure whether credentials should persist across browser restarts (localStorage)
 * or only last for the active browsing session (sessionStorage).
 */
export const setRememberDevicePreference = (remember: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_DEVICE_STORAGE_KEY, 'true');
      sessionStorage.removeItem(REMEMBER_DEVICE_STORAGE_KEY);
    } else {
      sessionStorage.setItem(REMEMBER_DEVICE_STORAGE_KEY, 'false');
      localStorage.removeItem(REMEMBER_DEVICE_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Storage preference warning:', e);
  }
};

/**
 * Clear session persistence preferences on sign out.
 */
export const clearRememberDevicePreference = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REMEMBER_DEVICE_STORAGE_KEY);
    sessionStorage.removeItem(REMEMBER_DEVICE_STORAGE_KEY);
  } catch (e) {
    console.warn('Clear storage preference warning:', e);
  }
};

/**
 * Custom hybrid storage adapter for Supabase Auth that routes session tokens
 * based on the user's "Remember this device" preference.
 */
export const authStorageAdapter = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const isSessionOnly = sessionStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY) === 'false';
      if (isSessionOnly) {
        return sessionStorage.getItem(key);
      }
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      const isSessionOnly = sessionStorage.getItem(REMEMBER_DEVICE_STORAGE_KEY) === 'false';
      if (isSessionOnly) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('authStorageAdapter setItem warning:', e);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('authStorageAdapter removeItem warning:', e);
    }
  }
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  // Retrieve configuration strictly from verified environment variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    supabaseInstance = createClient(envUrl, envKey, {
      auth: {
        storage: authStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseInstance;
  }

  return null;
};

export const resetSupabaseClient = () => {
  supabaseInstance = null;
};
