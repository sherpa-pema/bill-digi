import React from 'react';
import { ArrowLeft, Search, X, Plus } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { BasketView } from './BasketView';

export const ItemizedModeView: React.FC = () => {
  const { setShowItemsModal } = useShop();
  const {
    items,
    setIsItemizedMode,
    searchQuery,
    setSearchQuery,
    filteredItems,
    addToBasket,
    openCustomItemDialog
  } = useBilling();

  return (
    <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
      {/* Left Column (Catalog & Search ~ 60% / 7 cols) */}
      <div className="md:col-span-7 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button 
            onClick={() => setIsItemizedMode(false)} 
            className="min-h-[44px] px-4 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95 transition shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Simple
          </button>
          <button 
            onClick={() => setShowItemsModal(true)} 
            className="min-h-[44px] px-3 py-2 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white flex items-center gap-1 transition cursor-pointer"
          >
            Manage Items • {items.length}
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="rounded-[20px] bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 p-2.5 flex items-center gap-2 shadow-sm">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 ml-2 shrink-0" />
          <input 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Search or add custom item..." 
            className="flex-1 bg-transparent outline-none text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 py-1" 
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')} 
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 active:scale-90 transition cursor-pointer"
              title="Clear search"
            >
              <span className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>

        {/* Item Catalog List */}
        <div className="mt-4 rounded-[20px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400 dark:text-zinc-500">My Items</span>
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{filteredItems.length} items</span>
          </div>
          <div className="max-h-[300px] md:max-h-[calc(100vh-320px)] md:min-h-[300px] overflow-y-auto overscroll-y-contain divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* Custom Item Trigger */}
            <button 
              onClick={openCustomItemDialog} 
              className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/80 active:bg-zinc-100 dark:active:bg-zinc-800 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 block leading-tight">Add "{searchQuery || 'Custom Item'}"</span>
                  <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">Set custom price</span>
                </div>
              </div>
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">Set Price →</span>
            </button>

            {filteredItems.map(item => (
              <button 
                key={item.id} 
                onClick={() => addToBasket(item)} 
                className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/80 active:bg-zinc-100 dark:active:bg-zinc-800 transition cursor-pointer"
              >
                <div>
                  <p className="text-[14px] font-medium leading-tight text-zinc-900 dark:text-zinc-100">{item.name}</p>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">Tap to add</p>
                </div>
                <span className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100">Rs {item.price}</span>
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="p-8 text-center text-[13px] text-zinc-400 dark:text-zinc-500">No items match "{searchQuery}"</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column (Active Basket & Checkout ~ 40% / 5 cols) */}
      <div className="md:col-span-5 md:sticky md:top-4 mt-4 md:mt-0">
        <BasketView />
      </div>
    </div>
  );
};
