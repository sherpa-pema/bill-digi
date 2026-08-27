export interface Shop {
  id: string;
  user_id?: string;
  shop_name: string;
  pan_number: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  starting_bill_number: number;
  next_bill_number: number;
  created_at: string;
  updated_at: string;
  // Subscription fields
  subscription_tier?: 'free' | 'pro';
  subscription_status?: 'active' | 'expired' | 'trial';
  subscription_started_at?: string;
  subscription_expires_at?: string | null;
  trial_expires_at?: string | null;
  is_admin?: boolean;
}

export interface SubscriptionPayment {
  id: string;
  shop_id: string;
  shop_name: string;
  pan_number: string;
  amount: number;
  duration_days: number;
  payment_method: string;
  transaction_ref?: string;
  activated_by?: string;
  notes?: string;
  created_at: string;
}

export interface ShopAdminView extends Shop {
  bill_count?: number;
  total_revenue?: number;
}

export interface Item {
  id: string;
  shop_id?: string;
  name: string;
  price: number;
  created_at: string;
  updated_at?: string;
}

export interface BasketItem {
  id: string;
  item_id?: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface Bill {
  id: string;
  shop_id?: string;
  bill_number: number;
  bill_type: 'simple' | 'itemized';
  total_amount: number;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  items: BasketItem[];
  created_at: string;
  synced?: boolean;
}

export interface SyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export type HistoryDateFilter = 'today' | '7days' | '30days' | 'all';

export interface FetchBillsOptions {
  limit?: number;
  offset?: number;
  dateFilter?: HistoryDateFilter;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface PaginatedBillsResult {
  bills: Bill[];
  totalCount: number;
  hasMore: boolean;
}

export interface AdminShopsFetchResult {
  shops: ShopAdminView[];
  isFallback: boolean;
  warningMessage?: string;
}

