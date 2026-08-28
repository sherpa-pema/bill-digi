import React from 'react';
import { Settings, Hash, Sparkles, Crown, Clock, ArrowLeft } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { isUserAdmin } from '../../lib/authService';
import { navigateToAdmin } from '../../lib/navigation';

export const Header: React.FC = () => {
  const { shop, authUser, subscriptionInfo, setShowUpgradeModal, setIsAdminView, openShopSettings } = useShop();
  const { activeTab, setActiveTab } = useBilling();

  const isAdmin = isUserAdmin(authUser) || isUserAdmin(shop);

  return (
    <div className="px-5 pt-5 pb-3 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 transition-colors">
      {activeTab === 'newBill' ? (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">Sano Bill</h1>
              {subscriptionInfo.isPro ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> PRO
                </span>
              ) : subscriptionInfo.isTrial ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Trial ({subscriptionInfo.daysLeft}d)
                </span>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse hover:bg-red-200 dark:hover:bg-red-900/60 cursor-pointer"
                >
                  Trial Expired
                </button>
              )}
            </div>
            <p className="serif text-[22px] leading-none mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">{shop?.shop_name || 'My Shop'}</p>
            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white text-[11px] font-medium">
              <Hash className="w-3 h-3 text-zinc-400" /> Bill No: <span className="font-bold">{shop?.next_bill_number ?? '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button 
                type="button" 
                onClick={() => { setIsAdminView(true); navigateToAdmin(); }} 
                className="min-h-[44px] px-3 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-[11.5px] font-bold flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition cursor-pointer"
                title="Open Admin Console"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Admin</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setActiveTab('history')} 
              className="min-h-[44px] px-3.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[12.5px] font-semibold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
              title="View Bill History"
            >
              <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span>History</span>
            </button>
            <button 
              onClick={openShopSettings} 
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center active:scale-95 transition cursor-pointer" 
              title="Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setActiveTab('newBill')} 
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 active:scale-95 transition cursor-pointer"
              title="Back to New Bill"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div>
              <h1 className="serif text-[24px] tracking-tight leading-tight text-zinc-900 dark:text-zinc-100">Bill History</h1>
              <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 font-medium">{shop?.shop_name || 'My Shop'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button 
                type="button" 
                onClick={() => { setIsAdminView(true); navigateToAdmin(); }} 
                className="min-h-[44px] px-3 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-[11.5px] font-bold flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition cursor-pointer"
                title="Open Admin Console"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Admin</span>
              </button>
            )}
            <button 
              onClick={openShopSettings} 
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center active:scale-95 transition cursor-pointer" 
              title="Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
