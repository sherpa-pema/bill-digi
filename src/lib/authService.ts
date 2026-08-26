import { getSupabaseClient } from './supabase';
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
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: any;
  session?: any;
  shop?: Shop;
  items?: Item[];
  bills?: Bill[];
}

/**
 * Register a new business with Supabase Auth & save to the shops table directly in Supabase
 */
export const registerBusiness = async (params: RegisterParams): Promise<AuthResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase client is not configured. Check your connection or .env.' };
  }

  const { businessName, panNumber, ownerName, identifier, password } = params;
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
      created_at: now,
      updated_at: now
    };

    let insertedShop: Shop | null = null;

    // If an authenticated session is active, upsert into shops under user_id = auth.uid()
    if (authData.session) {
      const { data: dbShop, error: dbError } = await supabase
        .from('shops')
        .upsert({
          id: newShop.id,
          user_id: authData.user.id,
          shop_name: newShop.shop_name,
          pan_number: newShop.pan_number,
          owner_name: newShop.owner_name || null,
          email: newShop.email || null,
          phone: newShop.phone || null,
          starting_bill_number: newShop.starting_bill_number,
          next_bill_number: newShop.next_bill_number,
          created_at: newShop.created_at,
          updated_at: newShop.updated_at
        })
        .select()
        .single();

      if (dbError) {
        console.warn('Shop database upsert warning:', dbError);
      } else if (dbShop) {
        insertedShop = dbShop as Shop;
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

  const { identifier, password } = params;
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
      .limit(1);

    if (!shopError && shopRows && shopRows.length > 0) {
      shop = shopRows[0] as Shop;
    } else {
      // Securely provision a default shop linked to this authenticated user_id if none exists
      try {
        const meta = authData.user.user_metadata || {};
        const newShopId = 'shop_' + generateId();
        const now = new Date().toISOString();
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
    let bills: Bill[] = [];

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

      // Load bills directly from Supabase (protected by shop ownership RLS)
      const { data: billsRows } = await supabase
        .from('bills')
        .select('*')
        .eq('shop_id', shop.id)
        .order('bill_number', { ascending: false });

      if (billsRows) {
        bills = billsRows as Bill[];
      }
    }

    return {
      success: true,
      message: 'Logged in successfully from Supabase!',
      user: authData.user,
      session: authData.session,
      shop: shop || undefined,
      items,
      bills
    };
  } catch (err: any) {
    console.error('Login exception:', err);
    return { success: false, message: err.message || 'An unexpected error occurred during login.' };
  }
};

/**
 * Sign out the current user
 */
export const signOutBusiness = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
};

/**
 * Get active session user
 */
export const getActiveUser = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
};
