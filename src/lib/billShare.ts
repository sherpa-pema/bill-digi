import type { Bill, Shop, BasketItem } from '../types';

export interface CompactBillPayload {
  b: number; // bill_number
  t: number; // total_amount
  s?: number; // subtotal
  d?: number; // discount_amount
  x?: number; // tax_amount (VAT)
  c: string; // created_at
  y: 'simple' | 'itemized'; // bill_type
  sn: string; // shop_name
  pn: string; // pan_number
  id?: string; // bill id
  it: Array<{
    id?: string;
    n: string; // name
    q: number; // qty
    p: number; // unit_price
    t: number; // line_total
  }>;
}

/**
 * Converts a UTF-8 string to a URL-safe Base64 string without external dependencies
 */
export function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 string back to a UTF-8 string
 */
export function fromBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Packs a Bill and Shop into a compact, URL-safe Base64 string
 */
export function encodeBillData(bill: Bill, shop: Shop | null): string {
  const payload: CompactBillPayload = {
    b: bill.bill_number,
    t: bill.total_amount,
    s: bill.subtotal,
    d: bill.discount_amount,
    x: bill.tax_amount,
    c: bill.created_at,
    y: bill.bill_type,
    sn: shop?.shop_name || 'DigiBill Shop',
    pn: shop?.pan_number || 'N/A',
    id: bill.id,
    it: bill.items.map(item => ({
      id: item.id,
      n: item.name,
      q: item.qty,
      p: item.unit_price,
      t: item.line_total
    }))
  };

  return toBase64Url(JSON.stringify(payload));
}

/**
 * Unpacks an encoded Base64 payload into Bill and Shop models
 */
export function decodeBillData(encoded: string): { bill: Bill; shop: Shop } | null {
  try {
    const json = fromBase64Url(encoded);
    const p: CompactBillPayload = JSON.parse(json);

    if (!p || typeof p.b !== 'number' || typeof p.t !== 'number') {
      return null;
    }

    const items: BasketItem[] = Array.isArray(p.it)
      ? p.it.map((item, idx) => ({
          id: item.id || `item_${idx}`,
          name: item.n || 'Item',
          qty: Number(item.q) || 1,
          unit_price: Number(item.p) || 0,
          line_total: Number(item.t) || 0
        }))
      : [];

    const bill: Bill = {
      id: p.id || `bill_${p.b}`,
      bill_number: p.b,
      bill_type: p.y || 'simple',
      total_amount: p.t,
      subtotal: p.s,
      discount_amount: p.d,
      tax_amount: p.x,
      items,
      created_at: p.c || new Date().toISOString()
    };

    const shop: Shop = {
      id: 'shared_shop',
      shop_name: p.sn || 'DigiBill Shop',
      pan_number: p.pn || 'N/A',
      starting_bill_number: 1,
      next_bill_number: p.b + 1,
      created_at: p.c || new Date().toISOString(),
      updated_at: p.c || new Date().toISOString()
    };

    return { bill, shop };
  } catch (err) {
    console.warn('Failed to decode shared bill payload:', err);
    return null;
  }
}

/**
 * Builds the full customer-facing share URL
 */
export function generateBillShareUrl(bill: Bill, shop: Shop | null): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const encoded = encodeBillData(bill, shop);
  
  // Use pathname /billshare?data=... and include id for database lookup fallback
  const billIdParam = bill.id ? `&id=${encodeURIComponent(bill.id)}` : '';
  return `${origin}/billshare?data=${encoded}${billIdParam}`;
}
