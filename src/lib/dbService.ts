import { getSupabaseClient } from './supabase';
import type { Shop, Item, Bill, BasketItem, SubscriptionPayment, ShopAdminView } from '../types';
import { generateId } from './storage';

/**
 * Check if the browser is currently online
 */
export const checkIsOnline = (): boolean => {
  return typeof navigator !== 'undefined' && navigator.onLine;
};

/**
 * Fetch the active shop for the authenticated user
 */
export const fetchShop = async (userId?: string): Promise<Shop | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    console.error('Error fetching user shop from Supabase:', error);
    throw error;
  }
  if (data && data.length > 0) {
    return data[0] as Shop;
  }

  return null;
};

/**
 * Create a new default shop in Supabase if none exists
 */
export const createInitialShop = async (userId: string, shopName = 'My Shop', panNumber = '123456789'): Promise<Shop> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  if (!userId) {
    throw new Error('User ID is required to create a shop.');
  }

  const now = new Date().toISOString();
  const newShop: Shop = {
    id: 'shop_' + generateId(),
    user_id: userId,
    shop_name: shopName,
    pan_number: panNumber,
    starting_bill_number: 1,
    next_bill_number: 1,
    created_at: now,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('shops')
    .insert({
      id: newShop.id,
      user_id: newShop.user_id,
      shop_name: newShop.shop_name,
      pan_number: newShop.pan_number,
      starting_bill_number: newShop.starting_bill_number,
      next_bill_number: newShop.next_bill_number,
      created_at: newShop.created_at,
      updated_at: newShop.updated_at
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating initial shop:', error);
    throw error;
  }

  return (data as Shop) || newShop;
};

/**
 * Save/Update shop details directly in Supabase
 */
export const updateShop = async (shop: Shop): Promise<Shop> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const now = new Date().toISOString();
  const updatedData = {
    shop_name: shop.shop_name,
    pan_number: shop.pan_number,
    owner_name: shop.owner_name || null,
    email: shop.email || null,
    phone: shop.phone || null,
    starting_bill_number: shop.starting_bill_number,
    next_bill_number: shop.next_bill_number,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('shops')
    .update(updatedData)
    .eq('id', shop.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating shop in Supabase:', error);
    throw error;
  }

  return (data as Shop) || { ...shop, ...updatedData };
};

/**
 * Fetch all inventory items for a shop directly from Supabase
 */
export const fetchItems = async (shopId: string): Promise<Item[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('shop_id', shopId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching items from Supabase:', error);
    throw error;
  }

  return (data as Item[]) || [];
};

/**
 * Create a new inventory item directly in Supabase
 */
export const createItem = async (shopId: string, item: { name: string; price: number }): Promise<Item> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const now = new Date().toISOString();
  const newItem = {
    id: 'it_' + generateId(),
    shop_id: shopId,
    name: item.name.trim(),
    price: item.price,
    created_at: now,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('items')
    .insert(newItem)
    .select()
    .single();

  if (error) {
    console.error('Error inserting item in Supabase:', error);
    throw error;
  }

  return (data as Item) || newItem;
};

/**
 * Update an existing inventory item directly in Supabase
 */
export const updateItem = async (itemId: string, updates: { name: string; price: number }): Promise<Item> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const now = new Date().toISOString();
  const payload = {
    name: updates.name.trim(),
    price: updates.price,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('items')
    .update(payload)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating item in Supabase:', error);
    throw error;
  }

  return data as Item;
};

/**
 * Delete an inventory item directly from Supabase
 */
export const deleteItem = async (itemId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting item from Supabase:', error);
    throw error;
  }
};

/**
 * Fetch all bills for a shop directly from Supabase
 */
export const fetchBills = async (shopId: string): Promise<Bill[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('shop_id', shopId)
    .order('bill_number', { ascending: false });

  if (error) {
    console.error('Error fetching bills from Supabase:', error);
    throw error;
  }

  return (data as Bill[]) || [];
};

/**
 * Generate and store a bill atomically directly in Supabase using create_bill_atomic RPC.
 * Eliminates race conditions, duplicate numbering collisions, and lost bills.
 */
export const generateBill = async (
  shop: Shop,
  billData: {
    billType: 'simple' | 'itemized';
    totalAmount: number;
    subtotal?: number;
    discountAmount?: number;
    taxAmount?: number;
    items: BasketItem[];
  }
): Promise<{ bill: Bill; updatedShop: Shop }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const billId = 'bill_' + generateId();
  const now = new Date().toISOString();

  // 1. Primary path: Use atomic RPC stored procedure with PostgreSQL row locking
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_bill_atomic', {
      p_shop_id: shop.id,
      p_bill_id: billId,
      p_bill_type: billData.billType,
      p_total_amount: billData.totalAmount,
      p_items: billData.items,
      p_created_at: now
    });

    if (!rpcError && rpcResult && rpcResult.bill && rpcResult.shop) {
      const confirmedBill: Bill = {
        ...(rpcResult.bill as Bill),
        bill_number: Number(rpcResult.bill.bill_number),
        total_amount: Number(rpcResult.bill.total_amount),
        subtotal: billData.subtotal,
        discount_amount: billData.discountAmount,
        tax_amount: billData.taxAmount,
        items: Array.isArray(rpcResult.bill.items) ? (rpcResult.bill.items as BasketItem[]) : billData.items
      };
      const confirmedShop: Shop = {
        ...(rpcResult.shop as Shop),
        next_bill_number: Number(rpcResult.shop.next_bill_number)
      };

      return {
        bill: confirmedBill,
        updatedShop: confirmedShop
      };
    }

    if (rpcError) {
      console.warn('create_bill_atomic RPC failed or not yet deployed, using resilient retry loop:', rpcError.message);
    }
  } catch (rpcErr) {
    console.warn('RPC call exception, falling back to resilient retry loop:', rpcErr);
  }

  // 2. Resilient fallback retry loop with database re-fetch & jitter on concurrency collision
  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Re-fetch latest next_bill_number directly from Supabase to prevent stale state collisions
      const { data: freshShopData } = await supabase
        .from('shops')
        .select('next_bill_number')
        .eq('id', shop.id)
        .single();

      const targetBillNumber = freshShopData?.next_bill_number ? Number(freshShopData.next_bill_number) : shop.next_bill_number;

      const fallbackBill: Bill = {
        id: billId,
        shop_id: shop.id,
        bill_number: targetBillNumber,
        bill_type: billData.billType,
        total_amount: billData.totalAmount,
        subtotal: billData.subtotal,
        discount_amount: billData.discountAmount,
        tax_amount: billData.taxAmount,
        items: billData.items,
        created_at: now
      };

      const { data: insertedBill, error: insertError } = await supabase
        .from('bills')
        .insert({
          id: fallbackBill.id,
          shop_id: fallbackBill.shop_id,
          bill_number: fallbackBill.bill_number,
          bill_type: fallbackBill.bill_type,
          total_amount: fallbackBill.total_amount,
          items: fallbackBill.items,
          created_at: fallbackBill.created_at
        })
        .select()
        .single();

      if (insertError) {
        lastError = insertError;
        // If unique constraint violation, wait a random jitter (50-150ms) and retry with fresh counter
        if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('uq_bills_shop_number')) {
          await new Promise(res => setTimeout(res, 50 + Math.random() * 100));
          continue;
        }
        throw insertError;
      }

      // Increment next_bill_number in Supabase
      const nextNumber = targetBillNumber + 1;
      const { data: updatedShopData, error: updateError } = await supabase
        .from('shops')
        .update({
          next_bill_number: nextNumber,
          updated_at: now
        })
        .eq('id', shop.id)
        .select()
        .single();

      if (updateError) {
        console.warn('Bill saved, but shop counter increment warning:', updateError);
      }

      const finalShop = (updatedShopData as Shop) || {
        ...shop,
        next_bill_number: nextNumber,
        updated_at: now
      };

      return {
        bill: (insertedBill as Bill) || fallbackBill,
        updatedShop: finalShop
      };
    } catch (err: any) {
      lastError = err;
      if (attempt === MAX_RETRIES - 1) throw err;
    }
  }

  throw lastError || new Error('Failed to generate bill after multiple attempts.');
};

/**
 * Compute subscription status, remaining days, and UI display details for a shop
 */
export const getSubscriptionInfo = (shop: Shop | null) => {
  if (!shop) {
    return {
      tier: 'free' as const,
      isPro: false,
      isTrial: false,
      isExpired: false,
      daysLeft: 0,
      badgeText: 'Free',
      message: ''
    };
  }

  const now = Date.now();

  // 1. Check if Active Pro
  if (shop.subscription_tier === 'pro') {
    if (!shop.subscription_expires_at) {
      // Lifetime / open-ended Pro
      return {
        tier: 'pro' as const,
        isPro: true,
        isTrial: false,
        isExpired: false,
        daysLeft: 9999,
        badgeText: 'PRO',
        message: 'Unlimited Bill Generation'
      };
    }
    const expiresAt = new Date(shop.subscription_expires_at).getTime();
    if (expiresAt > now) {
      const daysLeft = Math.max(1, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
      return {
        tier: 'pro' as const,
        isPro: true,
        isTrial: false,
        isExpired: false,
        daysLeft,
        badgeText: 'PRO',
        message: `Pro active (${daysLeft} day${daysLeft > 1 ? 's' : ''} left)`
      };
    } else {
      // Pro expired
      return {
        tier: 'expired' as const,
        isPro: false,
        isTrial: false,
        isExpired: true,
        daysLeft: 0,
        badgeText: 'PRO EXPIRED',
        message: 'Pro subscription expired. Renew for Rs 500/mo.'
      };
    }
  }

  // 2. 7-Day Free Trial Calculation
  const createdAtMs = new Date(shop.created_at || Date.now()).getTime();
  const trialExpiresAtMs = shop.trial_expires_at 
    ? new Date(shop.trial_expires_at).getTime() 
    : createdAtMs + (7 * 24 * 60 * 60 * 1000);

  if (trialExpiresAtMs > now) {
    const daysLeft = Math.max(1, Math.ceil((trialExpiresAtMs - now) / (1000 * 60 * 60 * 24)));
    return {
      tier: 'trial' as const,
      isPro: false,
      isTrial: true,
      isExpired: false,
      daysLeft,
      badgeText: `TRIAL (${daysLeft}d)`,
      message: `7-Day Free Trial (${daysLeft} day${daysLeft > 1 ? 's' : ''} remaining)`
    };
  }

  // 3. Trial Expired
  return {
    tier: 'expired' as const,
    isPro: false,
    isTrial: false,
    isExpired: true,
    daysLeft: 0,
    badgeText: 'TRIAL EXPIRED',
    message: '7-day trial ended. Upgrade to Pro for unlimited bill generation.'
  };
};

/**
 * ADMIN: Fetch all shops with their accurate bill counts and revenue totals
 * Priority 1: PostgreSQL get_admin_shops_summary RPC (accurate, server-side COUNT/SUM, no 1,000 row cap)
 * Priority 2: PostgREST embedded resource count query `select('*, bills(count)')`
 * Priority 3: Fallback client query with sequential counter reconciliation
 */
export const fetchAllShopsForAdmin = async (): Promise<ShopAdminView[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // 1. Attempt database-level aggregation RPC (fastest & most accurate, handles 100k+ bills without limit)
  try {
    const { data: rpcShops, error: rpcError } = await supabase.rpc('get_admin_shops_summary');
    if (!rpcError && rpcShops && Array.isArray(rpcShops) && rpcShops.length > 0) {
      return rpcShops.map((s: any) => ({
        ...s,
        starting_bill_number: Number(s.starting_bill_number || 1),
        next_bill_number: Number(s.next_bill_number || 1),
        bill_count: Number(s.bill_count || 0),
        total_revenue: Number(s.total_revenue || 0)
      }));
    }
    if (rpcError) {
      console.warn('get_admin_shops_summary RPC call notice (using resilient query fallback):', rpcError.message);
    }
  } catch (rpcEx) {
    console.warn('get_admin_shops_summary RPC exception (using query fallback):', rpcEx);
  }

  // 2. Fetch all shops with embedded bills count
  let shops: any[] = [];
  try {
    const { data: shopsWithCount, error: shopsCountError } = await supabase
      .from('shops')
      .select('*, bills(count)')
      .order('created_at', { ascending: false });

    if (!shopsCountError && shopsWithCount) {
      shops = shopsWithCount;
    } else {
      const { data: standardShops, error: standardError } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (standardError) throw standardError;
      shops = standardShops || [];
    }
  } catch (err: any) {
    console.error('Error fetching shops for admin:', err);
    throw err;
  }

  if (!shops || shops.length === 0) return [];

  // 3. Fetch bill sums if accessible (using elevated limit)
  const billCountMap: Record<string, number> = {};
  const revenueMap: Record<string, number> = {};

  try {
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('shop_id, total_amount')
      .limit(10000);

    if (billsError) {
      console.warn('Direct bills query notice in admin view:', billsError.message);
    } else if (bills) {
      bills.forEach((b: { shop_id?: string; total_amount?: number }) => {
        if (b.shop_id) {
          billCountMap[b.shop_id] = (billCountMap[b.shop_id] || 0) + 1;
          revenueMap[b.shop_id] = (revenueMap[b.shop_id] || 0) + (Number(b.total_amount) || 0);
        }
      });
    }
  } catch (bErr) {
    console.warn('Error aggregating bills in fallback mode:', bErr);
  }

  return shops.map((s: any) => {
    // Determine accurate bill count:
    // a) PostgREST embedded bills count
    // b) billCountMap from fetched bills
    // c) sequential counter fallback: next_bill_number - starting_bill_number
    const embeddedCount = Array.isArray(s.bills) && s.bills[0]?.count != null ? Number(s.bills[0].count) : null;
    const directQueryCount = billCountMap[s.id];
    const sequentialCount = Math.max(0, (Number(s.next_bill_number) || 1) - (Number(s.starting_bill_number) || 1));

    let finalCount = 0;
    if (embeddedCount != null && embeddedCount > 0) {
      finalCount = embeddedCount;
    } else if (directQueryCount != null && directQueryCount > 0) {
      finalCount = directQueryCount;
    } else {
      // Fall back to sequential counter if RLS or query limits blocked bill row counting
      finalCount = sequentialCount;
    }

    return {
      id: s.id,
      user_id: s.user_id,
      shop_name: s.shop_name,
      pan_number: s.pan_number,
      owner_name: s.owner_name,
      email: s.email,
      phone: s.phone,
      starting_bill_number: Number(s.starting_bill_number || 1),
      next_bill_number: Number(s.next_bill_number || 1),
      created_at: s.created_at,
      updated_at: s.updated_at,
      subscription_tier: s.subscription_tier,
      subscription_status: s.subscription_status,
      subscription_started_at: s.subscription_started_at,
      subscription_expires_at: s.subscription_expires_at,
      trial_expires_at: s.trial_expires_at,
      is_admin: s.is_admin,
      bill_count: finalCount,
      total_revenue: revenueMap[s.id] || 0
    };
  });
};

/**
 * ADMIN: Activate or Extend a Shop's Pro Subscription
 */
export const activateShopSubscription = async (
  shop: Shop,
  days = 30,
  amount = 500,
  transactionRef = '',
  notes = '',
  activatedBy = 'admin'
): Promise<{ updatedShop: Shop; payment: SubscriptionPayment }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const now = Date.now();
  let baseTime = now;

  // If already active pro, stack extra days onto current expiry
  if (shop.subscription_tier === 'pro' && shop.subscription_expires_at) {
    const currentExpiry = new Date(shop.subscription_expires_at).getTime();
    if (currentExpiry > now) {
      baseTime = currentExpiry;
    }
  }

  const newExpiryDate = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
  const nowDateIso = new Date().toISOString();

  // 1. Update shop in Supabase
  const updatedShopFields = {
    subscription_tier: 'pro' as const,
    subscription_status: 'active' as const,
    subscription_started_at: shop.subscription_started_at || nowDateIso,
    subscription_expires_at: newExpiryDate,
    updated_at: nowDateIso
  };

  const { data: updatedShopData, error: shopError } = await supabase
    .from('shops')
    .update(updatedShopFields)
    .eq('id', shop.id)
    .select()
    .single();

  if (shopError) {
    console.error('Error updating shop subscription in Supabase:', shopError);
    throw shopError;
  }

  // 2. Create subscription payment log
  const newPayment: SubscriptionPayment = {
    id: 'pay_' + generateId(),
    shop_id: shop.id,
    shop_name: shop.shop_name,
    pan_number: shop.pan_number,
    amount: amount,
    duration_days: days,
    payment_method: 'bank_qr',
    transaction_ref: transactionRef.trim() || undefined,
    activated_by: activatedBy,
    notes: notes.trim() || undefined,
    created_at: nowDateIso
  };

  try {
    await supabase.from('subscription_payments').insert(newPayment);
  } catch (payErr) {
    console.warn('Could not insert subscription payment log (table may not exist yet):', payErr);
  }

  return {
    updatedShop: (updatedShopData as Shop) || { ...shop, ...updatedShopFields },
    payment: newPayment
  };
};

/**
 * ADMIN: Extend Shop's 7-Day Trial
 */
export const extendShopTrial = async (shop: Shop, extraDays = 7): Promise<Shop> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const now = Date.now();
  const currentTrial = shop.trial_expires_at ? new Date(shop.trial_expires_at).getTime() : now;
  const baseTime = currentTrial > now ? currentTrial : now;
  const newTrialExpiry = new Date(baseTime + extraDays * 24 * 60 * 60 * 1000).toISOString();
  const nowDateIso = new Date().toISOString();

  const updatedFields = {
    subscription_tier: 'free' as const,
    subscription_status: 'trial' as const,
    trial_expires_at: newTrialExpiry,
    updated_at: nowDateIso
  };

  const { data, error } = await supabase
    .from('shops')
    .update(updatedFields)
    .eq('id', shop.id)
    .select()
    .single();

  if (error) {
    console.error('Error extending trial in Supabase:', error);
    throw error;
  }

  return (data as Shop) || { ...shop, ...updatedFields };
};

/**
 * ADMIN: Downgrade Shop to Free / Expired
 */
export const setShopToFree = async (shop: Shop): Promise<Shop> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const expiredDate = new Date(Date.now() - 1000).toISOString();
  const nowDateIso = new Date().toISOString();

  const updatedFields = {
    subscription_tier: 'free' as const,
    subscription_status: 'expired' as const,
    subscription_expires_at: expiredDate,
    trial_expires_at: expiredDate,
    updated_at: nowDateIso
  };

  const { data, error } = await supabase
    .from('shops')
    .update(updatedFields)
    .eq('id', shop.id)
    .select()
    .single();

  if (error) {
    console.error('Error downgrading shop in Supabase:', error);
    throw error;
  }

  return (data as Shop) || { ...shop, ...updatedFields };
};

/**
 * ADMIN: Fetch all subscription payment logs
 */
export const fetchSubscriptionPayments = async (): Promise<SubscriptionPayment[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching subscription payments:', error);
    return [];
  }

  return (data as SubscriptionPayment[]) || [];
};
