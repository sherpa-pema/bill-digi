import React from 'react';
import { Settings, Hash, Sparkles, Crown, Clock, ArrowLeft } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { isUserAdmin } from '../../lib/authService';

export const Header: React.FC = () => {
  const { shop, authUser, subscriptionInfo, setShowUpgradeModal, setIsAdminView, openShopSettings } = useShop();
  const { activeTab, setActiveTab } = useBilling();

  const isAdmin = isUserAdmin(authUser) || isUserAdmin(shop);

  return (
    <div className="px-5 pt-5 pb-3 bg-white border-b border-zinc-100">
      {activeTab === 'newBill' ? (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-zinc-500">Sano Bill</h1>
              {subscriptionInfo.isPro ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/60 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" /> PRO
                </span>
              ) : subscriptionInfo.isTrial ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Trial ({subscriptionInfo.daysLeft}d)
                </span>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse hover:bg-red-200 cursor-pointer"
                >
                  Trial Expired
                </button>
              )}
            </div>
            <p className="serif text-[22px] leading-none mt-1 tracking-tight">{shop?.shop_name || 'My Shop'}</p>
            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[11px] font-medium">
              <Hash className="w-3 h-3" /> Bill No: <span className="font-bold">{shop?.next_bill_number ?? '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button 
                type="button" 
                onClick={() => { setIsAdminView(true); window.location.hash = 'admin'; }} 
                className="min-h-[44px] px-3 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px] font-bold flex items-center gap-1 hover:bg-amber-100 active:scale-95 transition cursor-pointer"
                title="Open Admin Console"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setActiveTab('history')} 
              className="min-h-[44px] px-3.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12.5px] font-semibold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
              title="View Bill History"
            >
              <Clock className="w-4 h-4 text-zinc-600" />
              <span>History</span>
            </button>
            <button 
              onClick={openShopSettings} 
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200/80 flex items-center justify-center active:scale-95 transition" 
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
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 active:scale-95 transition cursor-pointer"
              title="Back to New Bill"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div>
              <h1 className="serif text-[24px] tracking-tight leading-tight">Bill History</h1>
              <p className="text-[11.5px] text-zinc-400 font-medium">{shop?.shop_name || 'My Shop'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button 
                type="button" 
                onClick={() => { setIsAdminView(true); window.location.hash = 'admin'; }} 
                className="min-h-[44px] px-3 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px] font-bold flex items-center gap-1 hover:bg-amber-100 active:scale-95 transition cursor-pointer"
                title="Open Admin Console"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin</span>
              </button>
            )}
            <button 
              onClick={openShopSettings} 
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200/80 flex items-center justify-center active:scale-95 transition" 
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
