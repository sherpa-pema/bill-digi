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
  FileText
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
      const [shopsData, paymentsData] = await Promise.all([
        fetchAllShopsForAdmin(),
        fetchSubscriptionPayments()
      ]);
      setShops(shopsData);
      setPayments(paymentsData);
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
    try {
      if (actionType === 'activate30') {
        const { updatedShop, payment } = await activateShopSubscription(
          selectedShop,
          30,
          500,
          txRef,
          actionNotes
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
          actionNotes
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
    });

    const mrr = proCount * 500;

    return {
      totalShops: shops.length,
      proCount,
      trialCount,
      expiringCount,
      expiredCount,
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
    <div className="min-h-screen bg-[#f5f5f7] text-zinc-900 font-sans pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] overflow-hidden flex items-center justify-center shrink-0 shadow-sm bg-white border border-zinc-200/60 p-0.5">
            <img 
              src={sanoBillLogo} 
              alt="Sano Bill" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="serif text-[18px] sm:text-[20px] font-bold leading-none text-zinc-900 truncate">Sano Bill Admin</h1>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5 truncate max-w-[150px] sm:max-w-[240px] md:max-w-none">
              {currentUser?.email || 'user@gmail.com'}
            </p>
          </div>
        </div>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button" 
            onClick={loadAdminData} 
            disabled={isLoading}
            className="h-10 min-h-[40px] px-3 rounded-[12px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12px] font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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
                window.location.hash = '';
                window.location.reload();
              }
            }}
            className="h-10 min-h-[40px] px-3 rounded-[12px] bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-[12px] font-medium">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        
        {/* Notice Toast */}
        {actionNotice && (
          <div className="mb-6 p-4 rounded-[16px] bg-emerald-900 text-white text-[13px] font-medium flex items-center justify-between shadow-lg animate-slideUp">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="p-1 hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          
          {/* Total Shops */}
          <div className="bg-white rounded-[20px] p-4 sm:p-5 border border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Total Shops</span>
              <Building2 className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="serif text-[28px] font-bold text-zinc-900 leading-none">{stats.totalShops}</div>
            <p className="text-[11px] text-zinc-500 mt-2">Registered Businesses</p>
          </div>

          {/* Active Pro */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-[20px] p-4 sm:p-5 shadow-[0_6px_25px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Active Pro</span>
              <Crown className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-white leading-none">{stats.proCount}</div>
            <p className="text-[11px] text-zinc-300 mt-2">Rs 500/mo Paying Shops</p>
          </div>

          {/* 7-Day Trial */}
          <div className="bg-white rounded-[20px] p-4 sm:p-5 border border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">7-Day Trial</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-zinc-900 leading-none">{stats.trialCount}</div>
            <p className="text-[11px] text-zinc-500 mt-2">Active Free Trials</p>
          </div>

          {/* Expiring / Expired */}
          <div className="bg-white rounded-[20px] p-4 sm:p-5 border border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Expiring / Expired</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-zinc-900 leading-none">
              {stats.expiringCount} <span className="text-[16px] text-zinc-400 font-normal">/ {stats.expiredCount}</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">Requires Renewal</p>
          </div>

          {/* Monthly Revenue (MRR) */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-emerald-50 border border-emerald-200/80 rounded-[20px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between text-emerald-800 mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase">Monthly MRR</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="serif text-[28px] font-bold text-emerald-950 leading-none">Rs {stats.mrr.toLocaleString()}</div>
            <p className="text-[11px] text-emerald-700 mt-2">Projected Recurring</p>
          </div>

        </div>

        {/* Main View Tabs (Shops vs Payments) */}
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('shops')}
            className={`min-h-[42px] px-5 rounded-[14px] text-[13px] font-semibold transition ${activeTab === 'shops' ? 'bg-zinc-900 text-white shadow-sm' : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'}`}
          >
            🏬 Shops & Subscriptions ({shops.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`min-h-[42px] px-5 rounded-[14px] text-[13px] font-semibold transition ${activeTab === 'payments' ? 'bg-zinc-900 text-white shadow-sm' : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'}`}
          >
            💳 Payment History Log ({payments.length})
          </button>
        </div>

        {/* TAB 1: SHOPS MANAGEMENT */}
        {activeTab === 'shops' && (
          <div className="space-y-4">
            
            {/* Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-[20px] border border-zinc-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="w-full md:w-80 relative flex items-center">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search Shop Name, PAN, Phone..."
                  className="w-full h-11 pl-10 pr-4 rounded-[12px] bg-zinc-50 border border-zinc-200 text-[13px] font-medium outline-none focus:bg-white focus:border-zinc-900 transition"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 text-zinc-400 hover:text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="w-full md:w-auto flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-[12px]">
                <button
                  type="button"
                  onClick={() => setFilterTier('all')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap ${filterTier === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                >
                  All ({shops.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('pro')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap ${filterTier === 'pro' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
                >
                  Pro ({stats.proCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('trial')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap ${filterTier === 'trial' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                >
                  7-Day Trial ({stats.trialCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('expiring')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap ${filterTier === 'expiring' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-800 hover:bg-orange-100'}`}
                >
                  Expiring Soon ({stats.expiringCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTier('expired')}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold transition whitespace-nowrap ${filterTier === 'expired' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-800 hover:bg-red-100'}`}
                >
                  Expired ({stats.expiredCount})
                </button>
              </div>
            </div>

            {/* Shops List / Cards */}
            {isLoading ? (
              <div className="bg-white p-12 rounded-[24px] text-center border border-zinc-100">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-3" />
                <p className="text-[13px] text-zinc-500">Loading shops from Supabase...</p>
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="bg-white p-12 rounded-[24px] text-center border border-zinc-100">
                <Building2 className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <h3 className="serif text-[18px] text-zinc-800">No shops found</h3>
                <p className="text-[12px] text-zinc-500 mt-1">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredShops.map(shop => {
                  const subInfo = getSubscriptionInfo(shop);
                  return (
                    <div 
                      key={shop.id} 
                      className={`bg-white rounded-[22px] p-5 border shadow-sm flex flex-col justify-between transition hover:shadow-md ${subInfo.isPro ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/20 to-white' : subInfo.isTrial ? 'border-emerald-200/80' : 'border-zinc-200'}`}
                    >
                      {/* Shop Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="font-bold text-[16px] text-zinc-900 leading-tight">{shop.shop_name}</h3>
                            <p className="text-[12px] text-zinc-500 font-mono mt-0.5">PAN: {shop.pan_number}</p>
                          </div>
                          
                          {/* Badge */}
                          <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                            subInfo.isPro 
                              ? 'bg-amber-400 text-zinc-950 shadow-sm' 
                              : subInfo.isTrial 
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300/60' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {subInfo.isPro && <Sparkles className="w-3 h-3 text-zinc-950" />}
                            {subInfo.badgeText}
                          </span>
                        </div>

                        {/* Owner & Contact */}
                        <div className="text-[12px] text-zinc-600 space-y-1 my-3 bg-zinc-50 rounded-[12px] p-2.5">
                          {shop.owner_name && (
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Owner:</span>
                              <span className="font-medium text-zinc-800">{shop.owner_name}</span>
                            </div>
                          )}
                          {(shop.phone || shop.email) && (
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Contact:</span>
                              <span className="font-mono text-zinc-800">{shop.phone || shop.email}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-zinc-400">Bills Count:</span>
                            <span className="font-bold text-zinc-900">{shop.bill_count || 0} bills (Rs {(shop.total_revenue || 0).toFixed(0)})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-400">Plan Status:</span>
                            <span className={`font-semibold ${subInfo.isPro ? 'text-amber-800' : subInfo.isTrial ? 'text-emerald-700' : 'text-red-600'}`}>
                              {subInfo.message}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="pt-2 border-t border-zinc-100 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShop(shop);
                              setActionType('activate30');
                            }}
                            className="min-h-[38px] rounded-[10px] bg-zinc-950 hover:bg-zinc-800 text-white text-[12px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>+30d Pro (Rs 500)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShop(shop);
                              setActionType('extendTrial');
                            }}
                            className="min-h-[38px] rounded-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[12px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
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
                            className="flex-1 min-h-[32px] rounded-[8px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                          >
                            <Crown className="w-3 h-3 text-amber-600" /> +1 Year (Rs 5k)
                          </button>

                          {Boolean(shop.phone) && (
                            <button
                              type="button"
                              onClick={() => {
                                const rawPhone = shop.phone || '';
                                const msg = `Namaste ${shop.owner_name || shop.shop_name}, this is Sano Bill Support regarding your POS subscription.`;
                                window.open(`https://wa.me/${rawPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                              }}
                              className="px-2.5 min-h-[32px] rounded-[8px] bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-[11px] font-semibold flex items-center gap-1 transition"
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
                            className="px-2 min-h-[32px] rounded-[8px] bg-zinc-100 hover:bg-red-50 hover:text-red-700 text-zinc-500 text-[11px] font-medium transition"
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
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-zinc-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="serif text-[20px] font-bold text-zinc-900">Subscription Payments Ledger</h3>
                <p className="text-[12px] text-zinc-500">Chronological record of approved Rs 500 / Rs 5,000 activations</p>
              </div>
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Total Logged: Rs {payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toLocaleString()}
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="text-[13px]">No payment activations recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 uppercase text-[10.5px] font-semibold tracking-wider">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Shop Name & PAN</th>
                      <th className="pb-3 pr-4">Plan Duration</th>
                      <th className="pb-3 pr-4">Amount</th>
                      <th className="pb-3 pr-4">Tx Reference / Notes</th>
                      <th className="pb-3">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-50/60 transition">
                        <td className="py-3 pr-4 text-zinc-500 whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-zinc-900">
                          {p.shop_name}
                          <span className="block font-mono text-[11px] font-normal text-zinc-400">PAN: {p.pan_number}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                            +{p.duration_days} Days
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-bold text-emerald-700">
                          Rs {p.amount}
                        </td>
                        <td className="py-3 pr-4 font-mono text-zinc-600 text-[11.5px]">
                          {p.transaction_ref || p.notes || 'Bank QR Deposit'}
                        </td>
                        <td className="py-3 text-zinc-500 font-mono text-[11px]">
                          {p.activated_by || 'user@gmail.com'}
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
          <div className="w-full max-w-[420px] bg-white rounded-[28px] p-6 shadow-2xl border border-zinc-100 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="serif text-[22px] font-bold text-zinc-900">
                {actionType === 'activate30' && 'Activate 30 Days Pro'}
                {actionType === 'activate365' && 'Activate 1 Year Pro'}
                {actionType === 'extendTrial' && 'Extend 7-Day Trial'}
              </h3>
              <button 
                type="button" 
                onClick={() => { setSelectedShop(null); setActionType(null); }}
                className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 rounded-[16px] mb-4 text-[12.5px] space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Shop:</span>
                <span className="font-bold text-zinc-900">{selectedShop.shop_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">PAN:</span>
                <span className="font-mono font-semibold text-zinc-800">{selectedShop.pan_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Plan:</span>
                <span className="font-bold text-emerald-700">
                  {actionType === 'activate30' ? 'Rs 500 (30 Days Unlimited)' : actionType === 'activate365' ? 'Rs 5,000 (1 Year Unlimited)' : '+7 Days Free Trial'}
                </span>
              </div>
            </div>

            {(actionType === 'activate30' || actionType === 'activate365') && (
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">Bank Deposit / Tx Reference (Optional)</label>
                  <input
                    type="text"
                    value={txRef}
                    onChange={e => setTxRef(e.target.value)}
                    placeholder="e.g. Fonepay Tx #982312, Screenshot verified"
                    className="mt-1 w-full h-11 px-3.5 rounded-[12px] bg-zinc-50 border border-zinc-200 text-[13px] outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500">Notes (Optional)</label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder="e.g. Paid via Global IME QR"
                    className="mt-1 w-full h-11 px-3.5 rounded-[12px] bg-zinc-50 border border-zinc-200 text-[13px] outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => { setSelectedShop(null); setActionType(null); }}
                className="flex-1 min-h-[46px] rounded-[14px] bg-zinc-100 font-semibold text-[13px] hover:bg-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isProcessingAction}
                className="flex-[2] min-h-[46px] rounded-[14px] bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 active:scale-95 transition shadow-sm cursor-pointer"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
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
