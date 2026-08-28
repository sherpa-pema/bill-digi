import React from 'react';
import { X, Plus } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';

export const CustomItemModal: React.FC = () => {
  const {
    showCustomItemModal,
    setShowCustomItemModal,
    customItemName,
    setCustomItemName,
    customItemPrice,
    setCustomItemPrice,
    customPriceInputRef,
    handleConfirmCustomItem
  } = useBilling();

  if (!showCustomItemModal) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-slideUp"
      onClick={() => setShowCustomItemModal(false)}
    >
      <div 
        className="w-full max-w-[440px] bg-white dark:bg-zinc-900 rounded-[28px] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] border border-transparent dark:border-zinc-800 flex flex-col text-zinc-900 dark:text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400 dark:text-zinc-500">Itemized Mode</span>
            <h3 className="serif text-[22px] leading-tight text-zinc-900 dark:text-zinc-100 mt-0.5">Enter Custom Price</h3>
          </div>
          <button 
            type="button" 
            onClick={() => setShowCustomItemModal(false)} 
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 active:scale-95 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleConfirmCustomItem} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">Item Name</label>
            <input 
              value={customItemName} 
              onChange={e => setCustomItemName(e.target.value)} 
              maxLength={120}
              placeholder="e.g. Special Dish, Extra Service" 
              className="mt-1.5 w-full h-12 rounded-[14px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 text-[14px] font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-500 transition" 
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">Unit Price (Rs) *</label>
            <div className="mt-1.5 relative flex items-center">
              <span className="absolute left-3.5 text-[16px] font-medium text-zinc-400 dark:text-zinc-500">Rs</span>
              <input 
                ref={customPriceInputRef}
                type="text"
                inputMode="decimal"
                maxLength={10}
                value={customItemPrice} 
                onChange={e => setCustomItemPrice(e.target.value.replace(/[^0-9.]/g, ''))} 
                placeholder="0.00" 
                className="w-full h-14 pl-10 pr-4 rounded-[14px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[24px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-400 transition" 
              />
            </div>
            {customItemPrice !== '' && (parseFloat(customItemPrice) <= 0 || isNaN(parseFloat(customItemPrice))) && (
              <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400 font-medium">Price must be greater than Rs 0</p>
            )}
            {customItemPrice !== '' && parseFloat(customItemPrice) > 9999999.99 && (
              <p className="mt-1.5 text-[11px] text-red-500 font-medium">Price cannot exceed Rs 9,999,999.99</p>
            )}
          </div>

          {/* Quick price presets */}
          <div className="flex gap-2 pt-1">
            {['50', '100', '200', '500'].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setCustomItemPrice(val)}
                className="flex-1 min-h-[40px] h-10 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[12.5px] font-semibold transition active:scale-95 cursor-pointer"
              >
                Rs {val}
              </button>
            ))}
          </div>

          <div className="pt-2 flex gap-2.5">
            <button 
              type="button" 
              onClick={() => setShowCustomItemModal(false)} 
              className="flex-1 min-h-[48px] h-12 rounded-[14px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-[13.5px] hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={!customItemPrice || isNaN(parseFloat(customItemPrice)) || parseFloat(customItemPrice) <= 0 || parseFloat(customItemPrice) > 9999999.99} 
              className="flex-[2] min-h-[48px] h-12 rounded-[14px] bg-black dark:bg-white text-white dark:text-zinc-950 font-semibold text-[13.5px] disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:bg-zinc-900 dark:hover:bg-zinc-100"
            >
              <Plus className="w-4 h-4" /> Add to Basket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
