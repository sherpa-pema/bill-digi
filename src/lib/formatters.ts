import type { Bill } from '../types';
import { toPaisa, toRupees } from './money';

export const formatDateTime = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatShortDateTime = (isoString: string) => {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
};

// Helper to extract breakdown from any Bill (from state or Supabase) using integer paisa
export const getBillBreakdown = (bill: Bill) => {
  // Derive strictly from explicit kind; only fall back to legacy name heuristic if kind is undefined
  const discountItem = bill.items.find(
    (i) => i.kind === 'discount' || (i.kind === undefined && (i.line_total < 0 || /^discount(\s|\(|$)/i.test(i.name.trim())))
  );
  const vatItem = bill.items.find(
    (i) => i.kind === 'vat' || (i.kind === undefined && /^vat(\s|\(|$)/i.test(i.name.trim()))
  );
  const regularItems = bill.items.filter(
    (i) => i !== discountItem && i !== vatItem && (i.kind === 'item' || i.kind === undefined)
  );

  const subtotalPaisa =
    typeof bill.subtotal === 'number'
      ? toPaisa(bill.subtotal)
      : (regularItems.length > 0
          ? regularItems.reduce((acc, curr) => acc + toPaisa(curr.line_total), 0)
          : toPaisa(bill.total_amount));

  const discountPaisa =
    typeof bill.discount_amount === 'number'
      ? toPaisa(bill.discount_amount)
      : (discountItem ? Math.abs(toPaisa(discountItem.line_total)) : 0);

  const taxableBasePaisa = Math.max(0, subtotalPaisa - discountPaisa);

  const vatPaisa =
    typeof bill.tax_amount === 'number'
      ? toPaisa(bill.tax_amount)
      : (vatItem ? toPaisa(vatItem.line_total) : 0);

  return {
    subtotal: toRupees(subtotalPaisa),
    discountAmount: toRupees(discountPaisa),
    taxableAmount: toRupees(taxableBasePaisa),
    vatAmount: toRupees(vatPaisa),
    regularItems,
    discountItem,
    vatItem,
  };
};

/**
 * Sanitizes and escapes CSV field values according to RFC 4180 and OWASP CSV Injection mitigation guidelines.
 * 
 * Formula injection (CWE-1236) occurs when values starting with '=', '+', '-', '@', '\t', '\r', '%', or '|'
 * are opened in spreadsheet programs (Excel, Google Sheets) and interpreted as executable formulas.
 */
export const escapeCsvSafe = (value: string | number | undefined | null): string => {
  if (value == null) return '""';
  
  // If it's a number, standard numeric output is safe
  if (typeof value === 'number') {
    return `"${Number.isFinite(value) ? value : ''}"`;
  }

  let str = String(value);

  // Replace raw newlines and carriage returns with spaces to prevent row splitting issues
  str = str.replace(/[\r\n]+/g, ' ');

  // Check if string starts with formula-triggering characters
  const trimmed = str.trimStart();
  const formulaChars = ['=', '+', '-', '@', '\t', '\r', '%', '|'];
  
  if (trimmed.length > 0 && formulaChars.some(char => trimmed.startsWith(char))) {
    // If it's a pure number string like "-12.50" or "+5", it's safe if it parses strictly as a finite number
    // But for general user text like "=HYPERLINK(...)" or "-something", prefix with a single quote
    const isPureNumber = !isNaN(Number(trimmed)) && !trimmed.includes('0x') && !trimmed.includes('0b');
    if (!isPureNumber) {
      str = `'${str}`;
    }
  }

  // Escape standard double quotes per RFC 4180
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};
