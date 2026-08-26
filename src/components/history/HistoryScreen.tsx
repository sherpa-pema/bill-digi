import React from 'react';
import { Search, X, Ban, Hash, ShoppingBag } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';
import { formatShortDateTime } from '../../lib/formatters';
import { BillDetailSheet } from './BillDetailSheet';

export const HistoryScreen: React.FC = () => {
  const {
    historySearch,
    setHistorySearch,
    filteredHistory,
    billDetailSheet,
    setBillDetailSheet
  } = useBilling();

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto w-full">
      {/* Search Bar */}
      <div className="rounded-[18px] bg-white border border-zinc-200/80 p-2 flex items-center gap-2 shadow-sm max-w-xl mx-auto">
        <Search className="w-4 h-4 text-zinc-400 ml-2 shrink-0" />
        <input 
          value={historySearch} 
          onChange={(e) => setHistorySearch(e.target.value)} 
          placeholder="Search bill no, amount..." 
          className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-zinc-400 py-1" 
        />
        {historySearch && (
          <button 
            type="button"
            onClick={() => setHistorySearch('')} 
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-1 text-zinc-500 hover:text-zinc-800 active:scale-90 transition"
            title="Clear search"
          >
            <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </span>
          </button>
        )}
      </div>
      
      {/* Bills Grid */}
      <div className="mt-4 md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
        {filteredHistory.length === 0 ? (
          <div className="md:col-span-2 rounded-[20px] bg-white border border-zinc-100 p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-50 flex items-center justify-center mb-3">
              <Ban className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="serif text-[18px]">No bills found</p>
            <p className="text-[13px] text-zinc-500 mt-1">Bills saved in Supabase database will appear here</p>
          </div>
        ) : (
          filteredHistory.map(b => (
            <button 
              key={b.id} 
              onClick={() => setBillDetailSheet(b)} 
              className="w-full text-left rounded-[18px] bg-white border border-zinc-100 p-4 flex items-center justify-between hover:border-zinc-300 active:scale-[0.99] transition shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${b.bill_type === 'simple' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                  {b.bill_type === 'simple' ? <Hash className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-[14px] font-semibold">Bill No #{b.bill_number}</p>
                  <p className="text-[12px] text-zinc-500">{formatShortDateTime(b.created_at)} • {b.bill_type === 'simple' ? 'Simple' : `${b.items.length} items`} • ☁️ Live</p>
                </div>
              </div>
              <div className="text-right">
                <p className="serif text-[18px] font-medium">Rs {b.total_amount}</p>
                <p className="text-[11px] text-zinc-400">Tap to view</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Bill Detail Bottom Sheet */}
      {billDetailSheet && (
        <BillDetailSheet 
          bill={billDetailSheet} 
          onClose={() => setBillDetailSheet(null)} 
        />
      )}
    </div>
  );
};
