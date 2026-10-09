import type { User, Session } from '@supabase/supabase-js';
import { 
  getSupabaseClient, 
  setRememberDevicePreference, 
  clearRememberDevicePreference 
} from './supabase';
import { generateId } from './storage';
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
            display_name: ownerName.trim(),
            full_name: ownerName.trim(),
            owner_name: ownerName.trim(),
            business_name: businessName.trim(),
            pan_number: panNumber.trim(),
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
            display_name: ownerName.trim(),
            full_name: ownerName.trim(),
            owner_name: ownerName.trim(),
            business_name: businessName.trim(),
            pan_number: panNumber.trim(),
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

    const now = new Date().toISOString();
    const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const shopId = 'shop_' + generateId();

    const newShop: Shop = {
      id: shopId,
      user_id: authData.user.id,
      shop_name: businessName.trim(),
      pan_number: panNumber.trim(),
      owner_name: ownerName.trim(),
      email: isEmail ? cleanIdentifier : undefined,
      phone: !isEmail ? cleanIdentifier : undefined,
      starting_bill_number: 1,
      next_bill_number: 1,
      subscription_tier: 'free',
      subscription_status: 'trial',
      subscription_started_at: now,
      subscription_expires_at: null,
      trial_expires_at: trialExpiry,
      created_at: now,
      updated_at: now
    };

    let insertedShop: Shop | null = null;

    // Check if an existing shop was already created (e.g. by DB trigger) or if we need to insert
    if (authData.session) {
      const { data: existingShop } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (existingShop) {
        // Sync registration form details to the existing row created by the DB trigger
        const { data: updatedShop, error: updateError } = await supabase
          .from('shops')
          .update({
            shop_name: newShop.shop_name,
            pan_number: newShop.pan_number,
            owner_name: newShop.owner_name || null,
            email: newShop.email || null,
            phone: newShop.phone || null,
            trial_expires_at: existingShop.trial_expires_at || trialExpiry,
            updated_at: now
          })
          .eq('id', existingShop.id)
          .select()
          .single();

        if (updateError) {
          console.warn('Shop database update warning:', updateError);
          insertedShop = existingShop as Shop;
        } else if (updatedShop) {
          insertedShop = updatedShop as Shop;
        }
      } else {
        // No trigger-provisioned shop found; perform a single insert
        const { data: dbShop, error: dbError } = await supabase
          .from('shops')
          .insert({
            id: newShop.id,
            user_id: authData.user.id,
            shop_name: newShop.shop_name,
            pan_number: newShop.pan_number,
            owner_name: newShop.owner_name || null,
            email: newShop.email || null,
            phone: newShop.phone || null,
            starting_bill_number: newShop.starting_bill_number,
            next_bill_number: newShop.next_bill_number,
            subscription_tier: newShop.subscription_tier,
            subscription_status: newShop.subscription_status,
            subscription_started_at: newShop.subscription_started_at,
            subscription_expires_at: newShop.subscription_expires_at,
            trial_expires_at: newShop.trial_expires_at,
            created_at: newShop.created_at,
            updated_at: newShop.updated_at
          })
          .select()
          .single();

        if (dbError) {
          console.warn('Shop database insert warning:', dbError);
        } else if (dbShop) {
          insertedShop = dbShop as Shop;
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
      shop: insertedShop || newShop,
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
    let shop: Shop | null = null;
    const { data: shopRows, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!shopError && shopRows && shopRows.length > 0) {
      shop = shopRows[0] as Shop;
    } else {
      // Securely provision a default shop linked to this authenticated user_id if none exists
      try {
        const meta = authData.user.user_metadata || {};
        const newShopId = 'shop_' + generateId();
        const now = new Date().toISOString();
        const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const defaultShop: Shop = {
          id: newShopId,
          user_id: authData.user.id,
          shop_name: meta.business_name || meta.display_name || 'My Shop',
          pan_number: meta.pan_number || '123456789',
          owner_name: meta.owner_name || meta.full_name || '',
          email: authData.user.email || (isEmail ? cleanIdentifier : undefined),
          phone: authData.user.phone || (!isEmail ? cleanIdentifier : undefined),
          starting_bill_number: 1,
          next_bill_number: 1,
          subscription_tier: 'free',
          subscription_status: 'trial',
          subscription_started_at: now,
          subscription_expires_at: null,
          trial_expires_at: trialExpiry,
          created_at: now,
          updated_at: now
        };

        const { data: createdShop, error: createError } = await supabase
          .from('shops')
          .insert({
            id: defaultShop.id,
            user_id: defaultShop.user_id,
            shop_name: defaultShop.shop_name,
            pan_number: defaultShop.pan_number,
            owner_name: defaultShop.owner_name || null,
            email: defaultShop.email || null,
            phone: defaultShop.phone || null,
            starting_bill_number: 1,
            next_bill_number: 1,
            subscription_tier: defaultShop.subscription_tier,
            subscription_status: defaultShop.subscription_status,
            subscription_started_at: defaultShop.subscription_started_at,
            subscription_expires_at: defaultShop.subscription_expires_at,
            trial_expires_at: defaultShop.trial_expires_at,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();

        if (!createError && createdShop) {
          shop = createdShop as Shop;
        } else {
          shop = defaultShop;
        }
      } catch (e) {
        console.warn('Could not auto-provision fallback shop during login:', e);
      }
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
