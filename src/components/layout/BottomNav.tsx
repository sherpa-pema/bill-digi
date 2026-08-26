import React from 'react';
import { Plus, Clock } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useBilling();

  return (
    <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-4 py-2.5 z-20">
      <div className="max-w-[480px] mx-auto grid grid-cols-2 gap-2.5">
        <button 
          onClick={() => setActiveTab('newBill')} 
          className={`min-h-[48px] h-[48px] rounded-[14px] flex items-center justify-center gap-2 text-[13.5px] font-semibold transition ${
            activeTab === 'newBill' 
              ? 'bg-zinc-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]' 
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:scale-[0.98]'
          }`}
        >
          <Plus className="w-4 h-4" /> New Bill
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`min-h-[48px] h-[48px] rounded-[14px] flex items-center justify-center gap-2 text-[13.5px] font-semibold transition ${
            activeTab === 'history' 
              ? 'bg-zinc-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]' 
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:scale-[0.98]'
          }`}
        >
          <Clock className="w-4 h-4" /> History
        </button>
      </div>
      <div className="mt-2 mx-auto w-10 h-1 rounded-full bg-zinc-200"></div>
    </div>
  );
};
