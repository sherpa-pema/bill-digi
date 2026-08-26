import React, { useRef } from 'react';
import { Receipt, Loader2 } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { Keypad } from './Keypad';

export const SimpleModeView: React.FC = () => {
  const { isOnline, setShowItemsModal } = useShop();
  const { 
    simpleAmount, 
    handleKeypadPress, 
    setIsItemizedMode, 
    items, 
    isVatEnabled, 
    isDiscountEnabled, 
    isVat, 
    isDiscount, 
    toggleVat, 
    toggleDiscount, 
    simpleAmountNum, 
    simpleDiscountAmount, 
    simpleTaxableAmount, 
    simpleVatAmount, 
    finalSimpleTotal, 
    isGeneratingBill, 
    handleGenerateBill 
  } = useBilling();

  const amountInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="max-w-[460px] mx-auto w-full">
      <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Amount</span>
          <div className="flex items-center gap-2">
            {simpleAmount !== '0' && (
              <button 
                type="button" 
                onClick={() => handleKeypadPress('C')} 
                className="min-h-[36px] px-3 py-1 text-[12px] font-medium text-zinc-500 hover:text-red-600 active:scale-95 transition rounded-full bg-zinc-100"
              >
                Clear
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setIsItemizedMode(true)} 
              className="min-h-[36px] px-2 text-[13px] font-medium text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 flex items-center"
            >
              + Add items
            </button>
          </div>
        </div>

        {/* Amount Input Display */}
        <div className="relative">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-medium text-zinc-400">Rs</span>
            <input 
              ref={amountInputRef} 
              readOnly 
              value={simpleAmount} 
              className="serif w-full bg-transparent text-[56px] leading-none tracking-tight font-[400] outline-none" 
              placeholder="0" 
            />
          </div>
          <div className="mt-3 h-[1px] bg-zinc-100"></div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[12px] text-zinc-500">
          <span>Enter amount via keypad</span>
          <button 
            type="button" 
            onClick={() => setShowItemsModal(true)} 
            className="min-h-[36px] px-2 py-1 font-medium text-zinc-700 hover:text-black flex items-center"
          >
            Manage Items • {items.length}
          </button>
        </div>

        {/* Tax / Discount Quick Chips */}
        {(isVatEnabled || isDiscountEnabled) && (
          <div className="mt-4 flex gap-2">
            {isVatEnabled && (
              <button 
                type="button" 
                onClick={toggleVat} 
                className={`flex-1 min-h-[44px] h-11 rounded-[14px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                  isVat 
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                +13% VAT
              </button>
            )}
            {isDiscountEnabled && (
              <button 
                type="button" 
                onClick={toggleDiscount} 
                className={`flex-1 min-h-[44px] h-11 rounded-[14px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                  isDiscount 
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                -10% Disc
              </button>
            )}
          </div>
        )}

        {/* Live Tax/Discount Breakdown Preview */}
        {((isVatEnabled && isVat) || (isDiscountEnabled && isDiscount)) && simpleAmountNum > 0 && (
          <div className="mt-3 p-3 rounded-[14px] bg-zinc-50 border border-zinc-100 text-[12px] space-y-1.5 animate-slideUp">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span>
              <span>Rs {simpleAmountNum.toFixed(2)}</span>
            </div>
            {isDiscountEnabled && isDiscount && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount (-10%)</span>
                <span>- Rs {simpleDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {isVatEnabled && isVat && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>VAT (+13%{isDiscountEnabled && isDiscount ? ` on Rs ${simpleTaxableAmount.toFixed(2)}` : ''})</span>
                <span>+ Rs {simpleVatAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-200/80 pt-1.5">
              <span>Total to Pay</span>
              <span>Rs {finalSimpleTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Numeric Keypad Grid */}
        <Keypad />

        {/* Generate Bill Button */}
        <button 
          disabled={simpleAmountNum <= 0 || isGeneratingBill || !isOnline} 
          onClick={handleGenerateBill} 
          className="mt-5 w-full min-h-[56px] h-[56px] rounded-[16px] bg-black text-white font-semibold text-[15px] tracking-wide disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
        >
          {isGeneratingBill ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Recording in Supabase...</span>
            </>
          ) : (
            <>
              <Receipt className="w-4 h-4" /> 
              <span>Generate Bill — Rs {finalSimpleTotal.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
