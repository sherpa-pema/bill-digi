import React from 'react';
import { Search, X, Ban, Hash, ShoppingBag, Download, Loader2, Calendar } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';
import { formatShortDateTime } from '../../lib/formatters';
import { BillDetailSheet } from './BillDetailSheet';
import type { HistoryDateFilter } from '../../types';

export const HistoryScreen: React.FC = () => {
  const {
    historySearch,
    setHistorySearch,
    filteredHistory,
    billDetailSheet,
    setBillDetailSheet,
    historyDateFilter,
    setHistoryDateFilter,
    isLoadingBills,
    isLoadingMore,
    hasMoreBills,
    totalBillsCount,
    loadMoreBills,
    isExportingCsv,
    handleExportCsv
  } = useBilling();

  const filterOptions: { id: HistoryDateFilter; label: string }[] = [
    { id: '30days', label: 'Last 30 Days' },
    { id: '7days', label: '7 Days' },
    { id: 'today', label: 'Today' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto w-full">
      {/* Top Filter & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {filterOptions.map((opt) => {
            const isActive = historyDateFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHistoryDateFilter(opt.id)}
                className={`min-h-[44px] sm:min-h-[36px] px-3.5 sm:px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'bg-white border border-zinc-200/80 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {opt.id === 'today' && <Calendar className="w-3 h-3" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* CSV Export Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            disabled={isExportingCsv || filteredHistory.length === 0}
            onClick={() => handleExportCsv(historyDateFilter === 'all' ? 'all_time' : 'current_filter')}
            className="min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/80 text-zinc-800 text-[12px] font-medium flex items-center gap-1.5 hover:bg-zinc-50 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            title="Export bill history to Excel/CSV"
          >
            {isExportingCsv ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-800" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-zinc-600" />
                <span>Export CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-[18px] bg-white border border-zinc-200/80 p-2 flex items-center gap-2 shadow-sm">
        <Search className="w-4 h-4 text-zinc-400 ml-2 shrink-0" />
        <input 
          value={historySearch} 
          onChange={(e) => setHistorySearch(e.target.value)} 
          placeholder="Search bill no, amount, item..." 
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

      {/* Bill Count Summary */}
      <div className="mt-2.5 px-1 flex items-center justify-between text-[11.5px] text-zinc-500 font-medium">
        <span>
          Showing {filteredHistory.length}
          {totalBillsCount > filteredHistory.length ? ` of ${totalBillsCount}` : ''} bills
        </span>
        {isLoadingBills && (
          <span className="flex items-center gap-1 text-zinc-600">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading bills...
          </span>
        )}
      </div>
      
      {/* Bills Grid */}
      <div className="mt-3 md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
        {isLoadingBills && filteredHistory.length === 0 ? (
          <div className="md:col-span-2 rounded-[20px] bg-white border border-zinc-100 p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-3" />
            <p className="serif text-[18px]">Loading bill history...</p>
            <p className="text-[13px] text-zinc-500 mt-1">Retrieving bills from Supabase database</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="md:col-span-2 rounded-[20px] bg-white border border-zinc-100 p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-50 flex items-center justify-center mb-3">
              <Ban className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="serif text-[18px]">No bills found</p>
            <p className="text-[13px] text-zinc-500 mt-1">
              {historySearch
                ? `No bills matched "${historySearch}"`
                : 'No bills recorded for this time period'}
            </p>
          </div>
        ) : (
          filteredHistory.map((b) => (
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

      {/* Pagination: Load More Button */}
      {hasMoreBills && !historySearch && (
        <div className="mt-5 text-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={loadMoreBills}
            className="w-full sm:w-auto min-w-[200px] min-h-[48px] px-6 py-2.5 rounded-[16px] bg-white border border-zinc-200/90 text-zinc-800 text-[13px] font-semibold hover:bg-zinc-50 active:scale-95 transition shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                <span>Loading more bills...</span>
              </>
            ) : (
              <span>Load More Bills ({totalBillsCount - filteredHistory.length} remaining)</span>
            )}
          </button>
        </div>
      )}

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
