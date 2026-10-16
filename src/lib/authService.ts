import type { User, Session } from '@supabase/supabase-js';
import { 
  getSupabaseClient, 
  setRememberDevicePreference, 
  clearRememberDevicePreference 
} from './supabase';
import { completeShopProfile } from './dbService';
import type { Shop, Item, Bill } from '../types';

export interface RegisterParams {
  businessName: string;
  panNumber: string;
  ownerName: string;
  identifier: string; // Email or Phone
  password: string;
}

export interface LoginParams {
  identifier: string; // Email or Phone
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User | null;
  session?: Session | null;
  shop?: Shop;
  items?: Item[];
  bills?: Bill[];
}

/**
 * Admin emails array retained for backward compatibility.
 * Admin authorization is strictly managed via server-side app_metadata or public.admin_users.
 */
export const getAdminEmails = (): string[] => [];
export const ADMIN_EMAILS: string[] = [];

export interface AdminCheckable {
  email?: string;
  is_admin?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * Verify admin status against server-signed JWT claims or verified database records.
 * Never performs client-side email string matching against environment bundles.
 */
export const isUserAdmin = (
  userOrShopOrEmail?: string | AdminCheckable | null
): boolean => {
  if (!userOrShopOrEmail) return false;

  // Server-controlled app_metadata claim (signed by Supabase Auth service role)
  if (typeof userOrShopOrEmail === 'object') {
    if (userOrShopOrEmail.app_metadata?.is_admin === true || userOrShopOrEmail.app_metadata?.role === 'admin') {
      return true;
    }
  }

  return false;
};

/**
 * Verify administrative privileges directly against Supabase PostgreSQL server.
 * Uses public.is_admin() RPC to prevent any client-side manipulation.
 */
export const checkIsAdminServerSide = async (): Promise<boolean> => {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.warn('is_admin RPC query notice:', error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn('Error checking server-side admin status:', err);
    return false;
  }
};

/**
 * Register a new business with Supabase Auth & save to the shops table directly in Supabase
 */
export const registerBusiness = async (params: RegisterParams): Promise<AuthResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase client is not configured. Check your connection or .env.' };
  }

  const { businessName, panNumber, ownerName, identifier, password } = params;
  if (!password || password.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters long.' };
  }

  const cleanName = (businessName || '').trim();
  const cleanPan = (panNumber || '').trim();
  const cleanOwner = (ownerName || '').trim();

  if (!cleanName) {
    return { success: false, message: 'Business name is required.' };
  }

  if (!/^\d{9}$/.test(cleanPan) || cleanPan === '123456789') {
    return { success: false, message: 'Please enter a valid 9-digit PAN number (cannot be placeholder 123456789).' };
  }

  const isEmail = identifier.includes('@');
  const cleanIdentifier = identifier.trim();

  try {
    let signUpResponse;

    if (isEmail) {
      signUpResponse = await supabase.auth.signUp({
        email: cleanIdentifier,
        password: password,
        options: {
          data: {
            display_name: cleanOwner,
            full_name: cleanOwner,
            owner_name: cleanOwner,
            business_name: cleanName,
            pan_number: cleanPan,
            email: cleanIdentifier,
          }
        }
      });
    } else {
      const phoneDigits = cleanIdentifier.replace(/\D/g, '');
      const formattedPhone = cleanIdentifier.startsWith('+') ? cleanIdentifier : `+977${phoneDigits}`;

      signUpResponse = await supabase.auth.signUp({
        phone: formattedPhone,
        password: password,
        options: {
          data: {
            display_name: cleanOwner,
            full_name: cleanOwner,
            owner_name: cleanOwner,
            business_name: cleanName,
            pan_number: cleanPan,
            phone: formattedPhone,
          }
        }
      });
    }

    const { data: authData, error: authError } = signUpResponse;
    if (authError) {
      return { success: false, message: authError.message };
    }

    if (!authData.user) {
      return { success: false, message: 'Registration failed. No user was returned from Supabase.' };
    }

    let insertedShop: Shop | null = null;

    // Single Creator Rule: The DB trigger on auth.users is the sole creator of the shop record.
    // The client completes the profile in one atomic RPC call.
    if (authData.session) {
      try {
        insertedShop = await completeShopProfile({
          shopName: cleanName,
          panNumber: cleanPan,
          ownerName: cleanOwner,
          email: isEmail ? cleanIdentifier : undefined,
          phone: !isEmail ? cleanIdentifier : undefined,
        });
      } catch (rpcErr: any) {
        console.warn('Profile completion RPC notice:', rpcErr);
        // Fallback: load the trigger-provisioned shop
        const { data: existingShop } = await supabase
          .from('shops')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle();
        if (existingShop) {
          insertedShop = existingShop as Shop;
        }
      }
    }

    return {
      success: true,
      message: authData.session 
        ? 'Business registered successfully in Supabase cloud!' 
        : 'Registration submitted! Please confirm your account if email confirmation is required.',
      user: authData.user,
      session: authData.session,
      shop: insertedShop || undefined,
      items: [],
      bills: []
    };
  } catch (err: any) {
    console.error('Registration exception:', err);
    return { success: false, message: err.message || 'An unexpected error occurred during registration.' };
  }
};

/**
 * Log in an existing user with Supabase Auth & load shop details directly from Supabase
 */
export const loginBusiness = async (params: LoginParams): Promise<AuthResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase client is not configured. Check your connection or .env.' };
  }

  const { identifier, password, rememberMe = true } = params;
  if (!password) {
    return { success: false, message: 'Please enter your password.' };
  }

  // Set persistence preference before making the Supabase Auth call
  setRememberDevicePreference(rememberMe);

  const isEmail = identifier.includes('@');
  const cleanIdentifier = identifier.trim();

  try {
    let signInResponse;

    if (isEmail) {
      signInResponse = await supabase.auth.signInWithPassword({
        email: cleanIdentifier,
        password: password,
      });
    } else {
      const phoneDigits = cleanIdentifier.replace(/\D/g, '');
      const formattedPhone = cleanIdentifier.startsWith('+') ? cleanIdentifier : `+977${phoneDigits}`;
      signInResponse = await supabase.auth.signInWithPassword({
        phone: formattedPhone,
        password: password,
      });
    }

    const { data: authData, error: authError } = signInResponse;
    if (authError) {
      return { success: false, message: authError.message };
    }

    if (!authData.user) {
      return { success: false, message: 'Login failed. No user found in Supabase Auth.' };
    }

    // Fetch the linked shop from Supabase 'shops' table strictly isolated by user_id = auth.uid()
    // The DB trigger is the single creator of shop records.
    let shop: Shop | null = null;
    const { data: shopRows, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!shopError && shopRows && shopRows.length > 0) {
      shop = shopRows[0] as Shop;
    }

    let items: Item[] = [];

    if (shop) {
      // Load items directly from Supabase (protected by shop ownership RLS)
      const { data: itemsRows } = await supabase
        .from('items')
        .select('*')
        .eq('shop_id', shop.id)
        .order('name', { ascending: true });

      if (itemsRows) {
        items = itemsRows as Item[];
      }
    }

    return {
      success: true,
      message: 'Logged in successfully from Supabase!',
      user: authData.user,
      session: authData.session,
      shop: shop || undefined,
      items,
      bills: []
    };
  } catch (err: any) {
    console.error('Login exception:', err);
    return { success: false, message: err.message || 'An unexpected error occurred during login.' };
  }
};

/**
 * Sign out the current user and purge persistent/session credentials
 */
export const signOutBusiness = async (): Promise<void> => {
  clearRememberDevicePreference();
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
};

/**
 * Get active session user with cryptographic server-side validation.
 * Verifies JWT authenticity with Supabase Auth to prevent stale or spoofed sessions.
 */
export const getActiveUser = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
};

/**
 * Subscribe to Supabase Auth lifecycle events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED)
 */
export const subscribeToAuthState = (
  callback: (event: string, session: Session | null) => void | Promise<void>
) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { unsubscribe: () => {} };
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    void callback(event, session);
  });
  return subscription;
};
