import React from 'react';
import { ShoppingBag, Plus, Loader2 } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';

export const BasketView: React.FC = () => {
  const { isOnline } = useShop();
  const {
    basket,
    updateBasketQty,
    updateBasketPrice,
    removeFromBasket,
    isVatEnabled,
    isDiscountEnabled,
    isVat,
    isDiscount,
    toggleVat,
    toggleDiscount,
    basketTotal,
    itemizedDiscountAmount,
    itemizedTaxableAmount,
    itemizedVatAmount,
    finalItemizedTotal,
    isGeneratingBill,
    handleGenerateBill
  } = useBilling();

  return (
    <div className="rounded-[24px] bg-white border border-zinc-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
        <h3 className="serif text-[20px] text-zinc-900">Basket</h3>
        <span className="text-[12px] px-2.5 py-1 rounded-full bg-zinc-100 font-semibold text-zinc-700">{basket.length} items</span>
      </div>
      
      {basket.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-2.5">
            <ShoppingBag className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-[13.5px] font-medium text-zinc-600">Your basket is empty</p>
          <p className="text-[12px] text-zinc-400 mt-0.5">Tap items on the left to add</p>
        </div>
      ) : (
        <div className="max-h-[260px] md:max-h-[calc(100vh-420px)] overflow-y-auto divide-y divide-zinc-100">
          {basket.map(b => (
            <div key={b.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-zinc-900 truncate">{b.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] text-zinc-500">Rs</span>
                  <input 
                    type="number" 
                    value={b.unit_price} 
                    onChange={(e) => updateBasketPrice(b.id, Number(e.target.value) || 0)} 
                    className="w-[72px] h-8 rounded-[8px] bg-zinc-50 border border-zinc-200 text-[13px] px-2 font-medium outline-none focus:bg-white focus:border-zinc-400" 
                  />
                  <span className="text-[12px] text-zinc-400">× {b.qty}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  type="button"
                  onClick={() => updateBasketQty(b.id, -1)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center active:scale-95 transition"
                  title="Decrease quantity"
                >
                  <span className="font-bold text-lg leading-none select-none">-</span>
                </button>
                <span className="w-6 text-center text-[13px] font-semibold">{b.qty}</span>
                <button 
                  type="button"
                  onClick={() => updateBasketQty(b.id, 1)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-900 hover:bg-black text-white flex items-center justify-center active:scale-95 transition shadow-sm"
                  title="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-right min-w-[64px] flex flex-col items-end">
                <p className="text-[13.5px] font-bold text-zinc-900">Rs {b.line_total}</p>
                <button 
                  type="button"
                  onClick={() => removeFromBasket(b.id)} 
                  className="min-h-[36px] px-1 flex items-center justify-end text-[11px] text-zinc-400 hover:text-red-600 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="p-4 bg-zinc-50 border-t border-zinc-100">
        {/* Tax / Discount Quick Chips in Basket */}
        {(isVatEnabled || isDiscountEnabled) && (
          <div className="flex gap-2 mb-3">
            {isVatEnabled && (
              <button 
                type="button" 
                onClick={toggleVat} 
                className={`flex-1 min-h-[44px] h-11 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1 transition active:scale-[0.98] ${
                  isVat 
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                    : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                +13% VAT
              </button>
            )}
            {isDiscountEnabled && (
              <button 
                type="button" 
                onClick={toggleDiscount} 
                className={`flex-1 min-h-[44px] h-11 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1 transition active:scale-[0.98] ${
                  isDiscount 
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                    : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                -10% Disc
              </button>
            )}
          </div>
        )}

        {/* Live Calculation Preview */}
        {((isVatEnabled && isVat) || (isDiscountEnabled && isDiscount)) && basketTotal > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-white border border-zinc-100 text-[11.5px] space-y-1 animate-slideUp">
            <div className="flex justify-between text-zinc-500">
              <span>Basket Subtotal</span>
              <span>Rs {basketTotal.toFixed(2)}</span>
            </div>
            {isDiscountEnabled && isDiscount && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount (-10%)</span>
                <span>- Rs {itemizedDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {isVatEnabled && isVat && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>VAT (+13%{isDiscountEnabled && isDiscount ? ` on Rs ${itemizedTaxableAmount.toFixed(2)}` : ''})</span>
                <span>+ Rs {itemizedVatAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-zinc-500">Running total</span>
          <span className="serif text-[26px] font-semibold text-zinc-900">Rs {finalItemizedTotal.toFixed(2)}</span>
        </div>
        <button 
          disabled={basketTotal <= 0 || isGeneratingBill || !isOnline} 
          onClick={handleGenerateBill} 
          className="w-full min-h-[52px] h-[52px] rounded-[16px] bg-black text-white font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
        >
          {isGeneratingBill ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Recording in Supabase...</span>
            </>
          ) : (
            `Generate Bill — Rs ${finalItemizedTotal.toFixed(2)}`
          )}
        </button>
      </div>
    </div>
  );
};
