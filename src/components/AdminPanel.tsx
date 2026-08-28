import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Search, 
  Crown, 
  Sparkles, 
  Clock, 
  Check, 
  X, 
  RefreshCw, 
  DollarSign, 
  LogOut, 
  Loader2, 
  CheckCircle2, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import type { ShopAdminView, SubscriptionPayment } from '../types';
import { 
  fetchAllShopsForAdmin, 
  activateShopSubscription, 
  extendShopTrial, 
  setShopToFree, 
  fetchSubscriptionPayments,
  getSubscriptionInfo
} from '../lib/dbService';
import { signOutBusiness } from '../lib/authService';
import { navigateToPOS } from '../lib/navigation';
import sanoBillLogo from '../assets/sano-bill-logo.png';

interface AdminPanelProps {
  currentUser: any;
  onBackToPOS?: () => void;
  onSignOut?: () => void;
}

export default function AdminPanel({ currentUser, onSignOut }: AdminPanelProps) {
  // Dashboard Data State
  const [shops, setShops] = useState<ShopAdminView[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'shops' | 'payments'>('shops');
  const [filterTier, setFilterTier] = useState<'all' | 'pro' | 'trial' | 'expiring' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  // Quick Action Modal State
  const [selectedShop, setSelectedShop] = useState<ShopAdminView | null>(null);
  const [actionType, setActionType] = useState<'activate30' | 'activate365' | 'extendTrial' | 'revoke' | null>(null);
  const [txRef, setTxRef] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Load Admin Data
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [shopsResult, paymentsData] = await Promise.all([
        fetchAllShopsForAdmin(),
        fetchSubscriptionPayments()
      ]);
      setShops(shopsResult.shops);
      setPayments(paymentsData);
      if (shopsResult.isFallback) {
        setFallbackWarning(shopsResult.warningMessage || 'Database aggregation RPC unavailable. Displaying estimates via query fallback.');
      } else {
        setFallbackWarning(null);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setActionNotice(err.message || 'Error loading shops from Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Execute Subscription Action
  const handleConfirmAction = async () => {
    if (!selectedShop || !actionType) return;
    setIsProcessingAction(true);
    const adminIdentifier = currentUser?.email || currentUser?.phone || 'admin';
    try {
      if (actionType === 'activate30') {
        const { updatedShop, payment } = await activateShopSubscription(
          selectedShop,
          30,
          500,
          txRef,
          actionNotes,
          adminIdentifier
        );
        setShops(prev => prev.map(s => s.id === selectedShop.id ? { ...s, ...updatedShop } : s));
        setPayments(prev => [payment, ...prev]);
        setActionNotice(`Successfully activated 30 Days Pro for ${selectedShop.shop_name}!`);
      } else if (actionType === 'activate365') {
        const { updatedShop, payment } = await activateShopSubscription(
          selectedShop,
          365,
          5000,
          txRef,
          actionNotes,
          adminIdentifier
        );
        setShops(prev => prev.map(s => s.id === selectedShop.id ? { ...s, ...updatedShop } : s));
        setPayments(prev => [payment, ...prev]);
        setActionNotice(`Successfully activated 1 Year Pro for ${selectedShop.shop_name}!`);
      } else if (actionType === 'extendTrial') {
        const updatedShop = await extendShopTrial(selectedShop, 7);
        setShops(prev => prev.map(s => s.id === selectedShop.id ? { ...s, ...updatedShop } : s));
        setActionNotice(`Extended 7-Day Free Trial for ${selectedShop.shop_name}!`);
      } else if (actionType === 'revoke') {
        const updatedShop = await setShopToFree(selectedShop);
        setShops(prev => prev.map(s => s.id === selectedShop.id ? { ...s, ...updatedShop } : s));
        setActionNotice(`Downgraded ${selectedShop.shop_name} to Free / Expired.`);
      }

      // Close modal
      setSelectedShop(null);
      setActionType(null);
      setTxRef('');
      setActionNotes('');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert('Action failed: ' + (err.message || 'Please check Supabase connection.'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Metrics Calculations
  const stats = useMemo(() => {
    let proCount = 0;
    let trialCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let totalBills = 0;
    let totalPlatformRevenue = 0;

    shops.forEach(s => {
      const info = getSubscriptionInfo(s);
      if (info.isPro) {
        proCount++;
        if (info.daysLeft <= 3) expiringCount++;
      } else if (info.isTrial) {
        trialCount++;
        if (info.daysLeft <= 2) expiringCount++;
      } else if (info.isExpired) {
        expiredCount++;
      }
      totalBills += (s.bill_count || 0);
      totalPlatformRevenue += (s.total_revenue || 0);
    });

    const mrr = proCount * 500;

    return {
      totalShops: shops.length,
      proCount,
      trialCount,
      expiringCount,
      expiredCount,
      totalBills,
      totalPlatformRevenue,
      mrr
    };
  }, [shops]);

  // Filtered Shops List
  const filteredShops = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return shops.filter(s => {
      const info = getSubscriptionInfo(s);

      // Tier filter
      if (filterTier === 'pro' && !info.isPro) return false;
      if (filterTier === 'trial' && !info.isTrial) return false;
      if (filterTier === 'expiring' && !(info.daysLeft <= 3 && !info.isExpired)) return false;
      if (filterTier === 'expired' && !info.isExpired) return false;

      // Text query
      if (!q) return true;
      return (
        s.shop_name.toLowerCase().includes(q) ||
        s.pan_number.includes(q) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    });
  }, [shops, filterTier, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans pb-12 transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] overflow-hidden flex items-center justify-center shrink-0 shadow-sm bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 p-0.5">
            <img 
              src={sanoBillLogo} 
              alt="Sano Bill" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="serif text-[18px] sm:text-[20px] font-bold leading-none text-zinc-900 dark:text-zinc-100 truncate">Sano Bill Admin</h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate max-w-[150px] sm:max-w-[240px] md:max-w-none">
              {currentUser?.email || currentUser?.phone || 'Administrator'}
            </p>
          </div>
        </div>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button" 
            onClick={loadAdminData} 
            disabled={isLoading}
            className="h-10 min-h-[40px] px-3 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[12px] font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button 
            type="button" 
            onClick={async () => {
              await signOutBusiness();
              if (onSignOut) {
                onSignOut();
              } else {
                navigateToPOS();
                window.location.reload();
              }
            }}
            className="h-10 min-h-[40px] px-3 rounded-[12px] bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-[12px] font-medium">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        
        {/* Action Notice Toast */}
        {actionNotice && (
          <div className="mb-6 p-4 rounded-[16px] bg-emerald-900 dark:bg-emerald-950 border border-emerald-800 text-white text-[13px] font-medium flex items-center justify-between shadow-lg animate-slideUp">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="p-1 hover:opacity-75 cursor-pointer" title="Dismiss notice">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Fallback Degradation Warning Banner */}
        {fallbackWarning && (
          <div className="mb-6 p-4 rounded-[16px] bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-[13px] font-medium flex items-start justify-between shadow-sm animate-slideUp">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-300">Database Aggregation Notice</p>
                <p className="text-[12px] text-amber-800 dark:text-amber-400 mt-0.5 leading-relaxed">{fallbackWarning}</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setFallbackWarning(null)} 
              className="p-1 text-amber-700 dark:text-amber-300 hover:text-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg transition shrink-0 ml-2 cursor-pointer"
              title="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          
          {/* Total Shops */}
          <div className="bg-white dark:bg-zinc-900 rounded-[20px] p-4 sm:p-5 border border-zinc-100 dark:border-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
            <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Total Shops</span>
              <Building2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="serif text-[28px] font-bold text-zinc-900 dark:text-zinc-100 leading-none">{stats.totalShops}</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">Registered Businesses</p>
          </div>

          {/* Active Pro */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 text-white rounded-[20px] p-4 sm:p-5 shadow-[0_6px_25px_rgba(0,0,0,0.08)] border border-transparent dark:border-zinc-700">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Active Pro</span>
              <Crown className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-white leading-none">{stats.proCount}</div>
            <p className="text-[11px] text-zinc-300 mt-2">Rs 500/mo Paying Shops</p>
          </div>

          {/* 7-Day Trial */}
          <div className="bg-white dark:bg-zinc-900 rounded-[20px] p-4 sm:p-5 border border-zinc-100 dark:border-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">7-Day Trial</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-zinc-900 dark:text-zinc-100 leading-none">{stats.trialCount}</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">Active Free Trials</p>
          </div>

          {/* Expiring / Expired */}
          <div className="bg-white dark:bg-zinc-900 rounded-[20px] p-4 sm:p-5 border border-zinc-100 dark:border-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Expiring / Expired</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-zinc-900 dark:text-zinc-100 leading-none">
              {stats.expiringCount} <span className="text-[16px] text-zinc-400 dark:text-zinc-500 font-normal">/ {stats.expiredCount}</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">Requires Renewal</p>
          </div>

          {/* Monthly Revenue (MRR) */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-[20px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Monthly MRR</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-emerald-950 dark:text-emerald-100 leading-none">Rs {stats.mrr.toLocaleString()}</div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2">Projected Recurring</p>
          </div>

        </div>

        {/* Main View Tabs (Shops vs Payments) */}
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('shops')}
            className={`min-h-[42px] px-5 rounded-[14px] text-[13px] font-semibold transition cursor-pointer ${activeTab === 'shops' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'}`}
          >
            🏬 Shops & Subscriptions ({shops.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`min-h-[42px] px-5 rounded-[14px] text-[13px] font-semibold transition cursor-pointer ${activeTab === 'payments' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'}`}
          >
            💳 Payment History Log ({payments.length})
          </button>
        </div>

        {/* TAB 1: SHOPS MANAGEMENT */}
        {activeTab === 'shops' && (
          <div className="space-y-4">
            
            {/* Search & Filter Toolbar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-[20px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="w-full md:w-80 relative flex items-center">
                <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search Shop Name, PAN, Phone..."
                  className="w-full h-11 pl-10 pr-4 rounded-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[13px] font-medium outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-500 transition"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="w-full md:w-auto flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-[12px]">
                <button
                  type="button"
                  onClick={() => setFilterTier('all')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${filterTier === 'all' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                >
                  All ({shops.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('pro')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${filterTier === 'pro' ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'}`}
                >
                  Pro ({stats.proCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('trial')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${filterTier === 'trial' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'}`}
                >
                  7-Day Trial ({stats.trialCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('expiring')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${filterTier === 'expiring' ? 'bg-orange-600 text-white' : 'bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60'}`}
                >
                  Expiring Soon ({stats.expiringCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('expired')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${filterTier === 'expired' ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60'}`}
                >
                  Expired ({stats.expiredCount})
                </button>
              </div>
            </div>

            {/* Shops List / Cards */}
            {isLoading ? (
              <div className="bg-white dark:bg-zinc-900 p-12 rounded-[24px] text-center border border-zinc-100 dark:border-zinc-800">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400 dark:text-zinc-500 mx-auto mb-3" />
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading shops from Supabase...</p>
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-12 rounded-[24px] text-center border border-zinc-100 dark:border-zinc-800">
                <Building2 className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <h3 className="serif text-[18px] text-zinc-800 dark:text-zinc-200">No shops found</h3>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredShops.map(shop => {
                  const subInfo = getSubscriptionInfo(shop);
                  return (
                    <div 
                      key={shop.id} 
                      className={`bg-white dark:bg-zinc-900 rounded-[22px] p-5 border shadow-sm flex flex-col justify-between transition hover:shadow-md ${subInfo.isPro ? 'border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-b from-amber-50/20 dark:from-amber-950/20 to-white dark:to-zinc-900' : subInfo.isTrial ? 'border-emerald-200/80 dark:border-emerald-800/60' : 'border-zinc-200 dark:border-zinc-800'}`}
                    >
                      {/* Shop Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100 leading-tight">{shop.shop_name}</h3>
                            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">PAN: {shop.pan_number}</p>
                          </div>
                          
                          {/* Badge */}
                          <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                            subInfo.isPro 
                              ? 'bg-amber-400 text-zinc-950 shadow-sm' 
                              : subInfo.isTrial 
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800' 
                              : 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                          }`}>
                            {subInfo.isPro && <Sparkles className="w-3 h-3 text-zinc-950" />}
                            {subInfo.badgeText}
                          </span>
                        </div>

                        {/* Owner & Contact */}
                        <div className="text-[12px] text-zinc-600 dark:text-zinc-300 space-y-1.5 my-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-[14px] p-3 border border-zinc-100/80 dark:border-zinc-750">
                          {shop.owner_name && (
                            <div className="flex justify-between">
                              <span className="text-zinc-400 dark:text-zinc-500">Owner:</span>
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">{shop.owner_name}</span>
                            </div>
                          )}
                          {(shop.phone || shop.email) && (
                            <div className="flex justify-between">
                              <span className="text-zinc-400 dark:text-zinc-500">Contact:</span>
                              <span className="font-mono text-zinc-800 dark:text-zinc-200">{shop.phone || shop.email}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-400 dark:text-zinc-500">Bills Count:</span>
                            <div className="text-right">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">{shop.bill_count || 0} bills</span>
                              {shop.total_revenue && shop.total_revenue > 0 ? (
                                <span className="text-zinc-500 dark:text-zinc-400 text-[11px] ml-1.5">(Rs {Number(shop.total_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-400 dark:text-zinc-500">Plan Status:</span>
                            <span className={`font-semibold ${subInfo.isPro ? 'text-amber-800 dark:text-amber-300' : subInfo.isTrial ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {subInfo.message}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShop(shop);
                              setActionType('activate30');
                            }}
                            className="min-h-[38px] rounded-[10px] bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-[12px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                            <span>+30d Pro (Rs 500)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShop(shop);
                              setActionType('extendTrial');
                            }}
                            className="min-h-[38px] rounded-[10px] bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[12px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>+7d Trial</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShop(shop);
                              setActionType('activate365');
                            }}
                            className="flex-1 min-h-[32px] rounded-[8px] bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" /> +1 Year (Rs 5k)
                          </button>

                          {Boolean(shop.phone) && (
                            <button
                              type="button"
                              onClick={() => {
                                const rawPhone = shop.phone || '';
                                const msg = `Namaste ${shop.owner_name || shop.shop_name}, this is Sano Bill Support regarding your POS subscription.`;
                                window.open(`https://wa.me/${rawPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                              }}
                              className="px-2.5 min-h-[32px] rounded-[8px] bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Message on WhatsApp"
                            >
                              WhatsApp
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Revoke Pro and set ${shop.shop_name} to expired?`)) {
                                setSelectedShop(shop);
                                setActionType('revoke');
                                handleConfirmAction();
                              }
                            }}
                            className="px-2 min-h-[32px] rounded-[8px] bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-400 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium transition cursor-pointer"
                            title="Set to Expired"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAYMENT HISTORY AUDIT LOG */}
        {activeTab === 'payments' && (
          <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-5 sm:p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="serif text-[20px] font-bold text-zinc-900 dark:text-zinc-100">Subscription Payments Ledger</h3>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Chronological record of approved Rs 500 / Rs 5,000 activations</p>
              </div>
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800">
                Total Logged: Rs {payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toLocaleString()}
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                <p className="text-[13px]">No payment activations recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase text-[10.5px] font-semibold tracking-wider">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Shop Name & PAN</th>
                      <th className="pb-3 pr-4">Plan Duration</th>
                      <th className="pb-3 pr-4">Amount</th>
                      <th className="pb-3 pr-4">Tx Reference / Notes</th>
                      <th className="pb-3">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition">
                        <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.shop_name}
                          <span className="block font-mono text-[11px] font-normal text-zinc-400 dark:text-zinc-500">PAN: {p.pan_number}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-bold text-[11px] border border-transparent dark:border-amber-800">
                            +{p.duration_days} Days
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-bold text-emerald-700 dark:text-emerald-400">
                          Rs {p.amount}
                        </td>
                        <td className="py-3 pr-4 font-mono text-zinc-600 dark:text-zinc-400 text-[11.5px]">
                          {p.transaction_ref || p.notes || 'Bank QR Deposit'}
                        </td>
                        <td className="py-3 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                          {p.activated_by || 'Admin'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ACTION CONFIRMATION MODAL */}
      {selectedShop && actionType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-slideUp">
          <div className="w-full max-w-[420px] bg-white dark:bg-zinc-900 rounded-[28px] p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="serif text-[22px] font-bold text-zinc-900 dark:text-zinc-100">
                {actionType === 'activate30' && 'Activate 30 Days Pro'}
                {actionType === 'activate365' && 'Activate 1 Year Pro'}
                {actionType === 'extendTrial' && 'Extend 7-Day Trial'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setSelectedShop(null); setActionType(null); }}
                className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-[16px] mb-4 text-[12.5px] space-y-1 border border-transparent dark:border-zinc-700">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Shop:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{selectedShop.shop_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">PAN:</span>
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{selectedShop.pan_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Plan:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {actionType === 'activate30' ? 'Rs 500 (30 Days Unlimited)' : actionType === 'activate365' ? 'Rs 5,000 (1 Year Unlimited)' : '+7 Days Free Trial'}
                </span>
              </div>
            </div>

            {(actionType === 'activate30' || actionType === 'activate365') && (
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">Bank Deposit / Tx Reference (Optional)</label>
                  <input
                    type="text"
                    value={txRef}
                    onChange={e => setTxRef(e.target.value)}
                    placeholder="e.g. Fonepay Tx #982312, Screenshot verified"
                    className="mt-1 w-full h-11 px-3.5 rounded-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[13px] outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-500 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">Notes (Optional)</label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder="e.g. Paid via Global IME QR"
                    className="mt-1 w-full h-11 px-3.5 rounded-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[13px] outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-500 transition"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => { setSelectedShop(null); setActionType(null); }}
                className="flex-1 min-h-[46px] rounded-[14px] bg-zinc-100 dark:bg-zinc-800 font-semibold text-[13px] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isProcessingAction}
                className="flex-[2] min-h-[46px] rounded-[14px] bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-[13.5px] flex items-center justify-center gap-2 active:scale-95 transition shadow-sm cursor-pointer"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                    <span>Confirm & Activate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
