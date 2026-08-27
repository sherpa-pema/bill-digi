import { forwardRef } from 'react';
import type { Bill, Shop } from '../../types';
import { formatShortDateTime, getBillBreakdown } from '../../lib/formatters';

interface ReceiptCardProps {
  bill: Bill;
  shop: Shop | null;
  className?: string;
}

export const ReceiptCard = forwardRef<HTMLDivElement, ReceiptCardProps>(({ bill, shop, className = '' }, ref) => {
  const { subtotal, discountAmount, taxableAmount, vatAmount, regularItems } = getBillBreakdown(bill);

  return (
    <div ref={ref} className={`relative mx-auto w-full max-w-[380px] pt-2 pb-2 bg-white rounded-[4px] ${className}`}>
      <div className="receipt-edge-top bg-white px-5 pt-8 pb-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-zinc-950 receipt-font">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-[20px] font-bold leading-tight uppercase tracking-wider">{shop?.shop_name || 'DigiBill Shop'}</h2>
          <p className="mt-1 text-[12px] uppercase">PAN: {shop?.pan_number || 'N/A'}</p>
          <p className="mt-1 text-[11px] uppercase font-bold">*** PAN BILL COPY ***</p>
        </div>
        
        <div className="receipt-dash-border mb-3"></div>
        
        {/* Meta Info */}
        <div className="text-[12px] leading-[1.6] mb-3">
          <div className="flex justify-between"><span>BILL NO:</span> <span className="font-bold">#{bill.bill_number}</span></div>
          <div className="flex justify-between"><span>DATE:</span> <span>{formatShortDateTime(bill.created_at)}</span></div>
        </div>

        <div className="receipt-dash-border mb-3"></div>
        
        {/* Table Header */}
        <div className="text-[12px] font-bold flex justify-between mb-2">
          <span>ITEM</span>
          <span className="text-right">AMOUNT</span>
        </div>
        
        {/* Item Rows */}
        <div className="space-y-2 text-[12px]">
          {bill.items.map((v) => (
            <div key={v.id} className="flex justify-between items-start">
              <span className="pr-2 leading-[1.4] break-words flex-1">
                {v.name}
                {v.qty > 1 && <span className="block text-[11px] text-zinc-500">{v.qty} x Rs {v.unit_price}</span>}
              </span>
              <span className={`font-bold whitespace-nowrap ${v.line_total < 0 ? 'text-emerald-700' : ''}`}>
                {v.line_total < 0 ? `-Rs ${Math.abs(v.line_total).toFixed(2)}` : v.line_total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="receipt-dash-border mt-3 mb-3"></div>
        
        {/* Breakdown Calculation */}
        <div className="text-[12px] leading-[1.6] mb-3">
          <div className="flex justify-between">
            <span>TOTAL ITEMS: {regularItems.length || 1}</span>
            <span>QTY: {regularItems.reduce((acc, i) => acc + i.qty, 0) || 1}</span>
          </div>
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-zinc-700">
              <span>DISCOUNT (-10%):</span>
              <span>-Rs {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {vatAmount > 0 && (
            <>
              <div className="flex justify-between text-zinc-700">
                <span>TAXABLE AMOUNT:</span>
                <span>Rs {taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>VAT (+13%):</span>
                <span>+Rs {vatAmount.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Total Box */}
        <div className="border-y-[3px] border-double border-zinc-900 py-2 mb-6">
          <div className="flex justify-between items-center text-[16px] font-bold">
            <span>TOTAL</span>
            <span>Rs {bill.total_amount.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center text-[11px] leading-relaxed">
          <p className="font-bold mb-1">*** THANK YOU! ***</p>
        </div>
      </div>
      <div className="receipt-edge-bottom bg-white w-full h-[6px] shadow-[0_10px_40px_rgba(0,0,0,0.08)]"></div>
    </div>
  );
});

ReceiptCard.displayName = 'ReceiptCard';
