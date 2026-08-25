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
  items: BasketItem[];
  created_at: string;
  synced?: boolean;
}

export interface SyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}
