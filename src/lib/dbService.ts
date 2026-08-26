import { getSupabaseClient } from './supabase';
import type { Shop, Item, Bill, BasketItem } from '../types';
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
 * Generate and store a bill directly into Supabase and update shop's next bill number
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

  const billNumber = shop.next_bill_number;
  const now = new Date().toISOString();

  const newBill: Bill = {
    id: 'bill_' + Date.now(),
    shop_id: shop.id,
    bill_number: billNumber,
    bill_type: billData.billType,
    total_amount: billData.totalAmount,
    subtotal: billData.subtotal,
    discount_amount: billData.discountAmount,
    tax_amount: billData.taxAmount,
    items: billData.items,
    created_at: now
  };

  // 1. Insert bill directly into Supabase
  const { data: insertedBill, error: billError } = await supabase
    .from('bills')
    .insert({
      id: newBill.id,
      shop_id: newBill.shop_id,
      bill_number: newBill.bill_number,
      bill_type: newBill.bill_type,
      total_amount: newBill.total_amount,
      items: newBill.items,
      created_at: newBill.created_at
    })
    .select()
    .single();

  if (billError) {
    console.error('Error generating bill in Supabase:', billError);
    throw billError;
  }

  // 2. Increment next_bill_number in Supabase
  const nextNumber = billNumber + 1;
  const { data: updatedShopData, error: shopError } = await supabase
    .from('shops')
    .update({
      next_bill_number: nextNumber,
      updated_at: now
    })
    .eq('id', shop.id)
    .select()
    .single();

  if (shopError) {
    console.warn('Bill was saved, but failed to update next_bill_number on shop:', shopError);
  }

  const finalShop = (updatedShopData as Shop) || {
    ...shop,
    next_bill_number: nextNumber,
    updated_at: now
  };

  return {
    bill: (insertedBill as Bill) || newBill,
    updatedShop: finalShop
  };
};
