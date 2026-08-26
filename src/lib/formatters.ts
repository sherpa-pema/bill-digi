import type { Bill } from '../types';

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

// Helper to extract breakdown from any Bill (from state or Supabase)
export const getBillBreakdown = (bill: Bill) => {
  const discountItem = bill.items.find(
    (i) => i.name.toLowerCase().includes('discount') || i.line_total < 0
  );
  const vatItem = bill.items.find((i) => i.name.toLowerCase().includes('vat'));
  const regularItems = bill.items.filter((i) => i !== discountItem && i !== vatItem);

  const subtotal =
    bill.subtotal ??
    (regularItems.length > 0
      ? regularItems.reduce((acc, curr) => acc + curr.line_total, 0)
      : bill.total_amount);
  const discountAmount =
    bill.discount_amount ?? (discountItem ? Math.abs(discountItem.line_total) : 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const vatAmount = bill.tax_amount ?? (vatItem ? vatItem.line_total : 0);

  return { subtotal, discountAmount, taxableAmount, vatAmount, regularItems, discountItem, vatItem };
};
