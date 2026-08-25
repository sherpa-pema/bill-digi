import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, Clock, Settings, Search, X, Hash, Receipt, 
  Trash2, Pencil, ShoppingBag, ArrowLeft, MessageSquare, Ban,
  RefreshCw, Database, User, LogOut, WifiOff, Wifi, Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Shop, Item, Bill, BasketItem, SyncConfig } from './types';
import { getItem, setItem, STORAGE_KEYS, generateId } from './lib/storage';
import { 
  checkIsOnline, 
  fetchShop, 
  createInitialShop, 
  updateShop, 
  fetchItems, 
  createItem, 
  updateItem, 
  deleteItem, 
  fetchBills, 
  generateBill 
} from './lib/dbService';
import { signOutBusiness, getActiveUser } from './lib/authService';
import AuthScreen from './components/AuthScreen';

// Formatters
const formatDateTime = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
};

const formatShortDateTime = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + 
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export default function App() {
  // Online / Network State
  const [isOnline, setIsOnline] = useState(checkIsOnline());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Global State (Direct Supabase data)
  const [shop, setShop] = useState<Shop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'newBill' | 'history'>('newBill');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  
  // New Bill State
  const [isItemizedMode, setIsItemizedMode] = useState(false);
  const [simpleAmount, setSimpleAmount] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  // Action Pending States
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  
  // Generated Bill State
  const [generatedBill, setGeneratedBill] = useState<Bill | null>(null);
  const [showQr, setShowQr] = useState(false);
  
  // History State
  const [historySearch, setHistorySearch] = useState('');
  const [billDetailSheet, setBillDetailSheet] = useState<Bill | null>(null);
  
  // Manage Items State
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Setup Form State
  const [setupShopName, setSetupShopName] = useState('');
  const [setupPanNumber, setSetupPanNumber] = useState('');
  const [setupStartingBill, setSetupStartingBill] = useState('1');
  const [setupSupabaseUrl, setSetupSupabaseUrl] = useState('');
  const [setupSupabaseKey, setSetupSupabaseKey] = useState('');

  // Load all data directly from Supabase
  const loadCloudData = useCallback(async (forcedShop?: Shop) => {
    if (!checkIsOnline()) {
      setIsOnline(false);
      setIsLoadingData(false);
      setLoadError('No internet connection. DigiBill requires an active online connection to load data from Supabase.');
      return;
    }

    setLoadError(null);
    try {
      let activeShop = forcedShop || shop;
      
      if (!activeShop) {
        const user = await getActiveUser();
        let loadedShop = await fetchShop(user?.id);
        
        if (!loadedShop) {
          // If no shop exists on Supabase at all, create an initial shop
          loadedShop = await createInitialShop(user?.id);
        }
        activeShop = loadedShop;
        setShop(activeShop);
      }

      if (activeShop) {
        setSetupShopName(activeShop.shop_name);
        setSetupPanNumber(activeShop.pan_number);
        setSetupStartingBill(String(activeShop.starting_bill_number));

        // Load items & bills directly from Supabase
        const [cloudItems, cloudBills] = await Promise.all([
          fetchItems(activeShop.id),
          fetchBills(activeShop.id)
        ]);

        setItems(cloudItems);
        setBills(cloudBills);
      }
    } catch (err: any) {
      console.error('Error loading data from Supabase:', err);
      setLoadError(err.message || 'Failed to load data from Supabase cloud.');
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  }, [shop]);

  // Monitor Online/Offline Status
  useEffect(() => {
    let isMounted = true;
    const handleOnline = () => {
      setIsOnline(true);
      setFeedbackMessage('Back online. Reconnecting to Supabase...');
      loadCloudData();
      setTimeout(() => {
        if (isMounted) setFeedbackMessage(null);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setFeedbackMessage('Connection lost. You are currently offline.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load from Supabase cloud
    void loadCloudData();

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCloudData]);

  const openShopSettings = () => {
    if (shop) {
      setSetupShopName(shop.shop_name);
      setSetupPanNumber(shop.pan_number);
      setSetupStartingBill(String(shop.starting_bill_number));
    }
    const syncConfig = getItem<SyncConfig>(STORAGE_KEYS.SYNC_CONFIG);
    if (syncConfig) {
      setSetupSupabaseUrl(syncConfig.supabaseUrl);
      setSetupSupabaseKey(syncConfig.supabaseAnonKey);
    }
    setIsEditingShop(true);
    setIsSetupMode(true);
  };

  const isValidSetup = useMemo(() => {
    return setupShopName.trim().length > 0 && 
           /^\d{9}$/.test(setupPanNumber) && 
           Number(setupStartingBill) >= 1;
  }, [setupShopName, setupPanNumber, setupStartingBill]);

  // Save Shop Details directly to Supabase
  const handleSaveSetup = async () => {
    if (!isValidSetup || !shop) return;
    if (!checkIsOnline()) {
      alert('Internet connection required to update shop details in Supabase.');
      return;
    }

    setIsSavingSetup(true);
    try {
      if (setupSupabaseUrl && setupSupabaseKey) {
        setItem(STORAGE_KEYS.SYNC_CONFIG, {
          supabaseUrl: setupSupabaseUrl.trim(),
          supabaseAnonKey: setupSupabaseKey.trim()
        });
      }

      const newStartingBill = Number(setupStartingBill) || shop.starting_bill_number;
      const newNextBill = newStartingBill !== shop.starting_bill_number ? newStartingBill : shop.next_bill_number;

      const updatedShopData: Shop = {
        ...shop,
        shop_name: setupShopName.trim(),
        pan_number: setupPanNumber,
        starting_bill_number: newStartingBill,
        next_bill_number: newNextBill,
        updated_at: new Date().toISOString()
      };

      const savedShop = await updateShop(updatedShopData);
      setShop(savedShop);
      setIsSetupMode(false);
      setIsEditingShop(false);
      setActiveTab('newBill');
    } catch (err: any) {
      console.error('Failed to update shop:', err);
      alert('Error updating shop in Supabase: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingSetup(false);
    }
  };

  // Manual Refresh Data from Supabase
  const handleManualRefresh = async () => {
    if (!checkIsOnline()) {
      alert('Internet connection required to refresh data from Supabase.');
      return;
    }
    setIsRefreshing(true);
    await loadCloudData();
  };

  // Auth Success Callback
  const handleAuthSuccess = (authData: { 
    mode: 'login' | 'register'; 
    data: Record<string, string>; 
    shop?: Shop;
    items?: Item[];
    bills?: Bill[];
  }) => {
    if (authData.shop) {
      setShop(authData.shop);
      setSetupShopName(authData.shop.shop_name);
      setSetupPanNumber(authData.shop.pan_number);
      setSetupStartingBill(String(authData.shop.starting_bill_number));
    }
    if (authData.items) setItems(authData.items);
    if (authData.bills) setBills(authData.bills);

    setShowAuthScreen(false);
    loadCloudData(authData.shop);
  };

  // Keypad logic
  const handleKeypadPress = (key: string) => {
    let newAmount = simpleAmount;
    if (key === 'C') {
      newAmount = '0';
    } else if (key === '.') {
      if (simpleAmount.includes('.')) return;
      newAmount = simpleAmount + '.';
    } else if (simpleAmount === '0') {
      newAmount = key;
    } else {
      if (simpleAmount.replace('.', '').length >= 9) return;
      newAmount = simpleAmount + key;
    }
    setSimpleAmount(newAmount);
  };

  const simpleAmountNum = useMemo(() => {
    const val = parseFloat(simpleAmount);
    return isNaN(val) ? 0 : val;
  }, [simpleAmount]);

  // Items logic
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const addToBasket = (item: Item) => {
    setBasket(prev => {
      const existing = prev.find(b => b.item_id === item.id);
      if (existing) {
        return prev.map(b => b.item_id === item.id 
          ? { ...b, qty: b.qty + 1, line_total: (b.qty + 1) * b.unit_price } 
          : b);
      }
      return [...prev, {
        id: generateId(),
        name: item.name,
        qty: 1,
        unit_price: item.price,
        line_total: item.price,
        item_id: item.id
      }];
    });
  };

  const addCustomItem = () => {
    const name = searchQuery.trim() || 'Custom Item';
    setBasket(prev => [...prev, {
      id: generateId(),
      name,
      qty: 1,
      unit_price: 0,
      line_total: 0
    }]);
    setSearchQuery('');
  };

  const updateBasketQty = (id: string, delta: number) => {
    setBasket(prev => prev.map(b => {
      if (b.id !== id) return b;
      const newQty = Math.max(1, b.qty + delta);
      return { ...b, qty: newQty, line_total: newQty * b.unit_price };
    }));
  };

  const updateBasketPrice = (id: string, price: number) => {
    setBasket(prev => prev.map(b => b.id === id ? { ...b, unit_price: price, line_total: b.qty * price } : b));
  };

  const removeFromBasket = (id: string) => {
    setBasket(prev => prev.filter(b => b.id !== id));
  };

  const basketTotal = useMemo(() => basket.reduce((acc, curr) => acc + curr.line_total, 0), [basket]);

  // Generate Bill directly in Supabase
  const handleGenerateBill = async () => {
    if (!shop || isGeneratingBill) return;
    
    if (!checkIsOnline()) {
      alert('Internet connection required. DigiBill does not work offline — bills must be written directly to Supabase.');
      return;
    }

    let total = 0;
    let billItems: BasketItem[] = [];
    let bType: 'simple' | 'itemized' = 'simple';

    if (isItemizedMode) {
      if (basketTotal <= 0) return;
      total = basketTotal;
      billItems = basket;
      bType = 'itemized';
    } else {
      if (simpleAmountNum <= 0) return;
      total = simpleAmountNum;
      billItems = [{
        id: generateId(),
        name: 'Total Amount',
        qty: 1,
        unit_price: total,
        line_total: total
      }];
    }

    setIsGeneratingBill(true);
    try {
      const result = await generateBill(shop, {
        billType: bType,
        totalAmount: total,
        items: billItems
      });

      // Update state with confirmed Supabase data
      setBills(prev => [result.bill, ...prev]);
      setShop(result.updatedShop);
      setGeneratedBill(result.bill);
      setShowQr(false);
      setSimpleAmount('0');
      setBasket([]);
      setIsItemizedMode(false);
    } catch (err: any) {
      console.error('Failed to generate bill in Supabase:', err);
      alert('Failed to save bill to Supabase: ' + (err.message || 'Please check your connection.'));
    } finally {
      setIsGeneratingBill(false);
    }
  };

  // Bill text generation
  const generateBillText = (bill: Bill | null) => {
    if (!bill || !shop) return '';
    const dateStr = formatDateTime(bill.created_at);
    let itemsStr = '';
    
    if (bill.bill_type === 'itemized') {
      itemsStr = bill.items.map(i => `${i.name} x${i.qty} = Rs ${i.line_total}`).join('\n');
    } else {
      itemsStr = `Amount: Rs ${bill.total_amount}`;
    }
    
    return `${shop.shop_name}\nPAN: ${shop.pan_number}\nBill No: ${bill.bill_number}\nDate: ${dateStr}\n${itemsStr}\nTotal: Rs ${bill.total_amount}\nThank you! Save for lottery at prize.ird.gov.np`;
  };

  // History filtering
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    const sorted = [...bills].sort((a, b) => b.bill_number - a.bill_number);
    if (!q) return sorted;
    
    return sorted.filter(b => 
      String(b.bill_number).includes(q) || 
      String(b.total_amount).includes(q) || 
      formatDateTime(b.created_at).toLowerCase().includes(q)
    );
  }, [bills, historySearch]);

  // Manage Items CRUD directly in Supabase
  const handleSaveItem = async () => {
    const name = editItemName.trim();
    const price = Number(editItemPrice);
    if (!name || isNaN(price) || price < 0 || !shop) return;

    if (!checkIsOnline()) {
      alert('Internet connection required to modify inventory items in Supabase.');
      return;
    }

    setIsSavingItem(true);
    try {
      if (editItemId) {
        const updated = await updateItem(editItemId, { name, price });
        setItems(prev => prev.map(i => i.id === editItemId ? updated : i));
        setEditItemId(null);
      } else {
        const created = await createItem(shop.id, { name, price });
        setItems(prev => [...prev, created]);
      }
      setEditItemName('');
      setEditItemPrice('');
    } catch (err: any) {
      console.error('Failed to save item in Supabase:', err);
      alert('Failed to save item: ' + (err.message || 'Connection error'));
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleEditItem = (item: Item) => {
    setEditItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(String(item.price));
  };

  const handleDeleteItem = async (id: string) => {
    if (!checkIsOnline()) {
      alert('Internet connection required to delete item in Supabase.');
      return;
    }

    try {
      await deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      if (editItemId === id) {
        setEditItemId(null);
        setEditItemName('');
        setEditItemPrice('');
      }
    } catch (err: any) {
      console.error('Failed to delete item in Supabase:', err);
      alert('Failed to delete item: ' + (err.message || 'Connection error'));
    }
  };

  // Render Loading / Connection Screen if Supabase isn't reachable on cold start
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center font-[Inter,system-ui,sans-serif]">
        <div className="w-full max-w-[430px] bg-[#fcfcfc] min-h-screen flex flex-col items-center justify-center p-6 text-center shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center serif text-2xl mb-4 animate-pulse">
            D
          </div>
          <h2 className="serif text-xl font-medium tracking-tight mb-2">Connecting to Supabase</h2>
          <p className="text-xs text-zinc-500 max-w-[260px] leading-relaxed mb-6">
            Loading real-time shop records and live database bills...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex justify-center font-[Inter,system-ui,sans-serif]">
      <div className="w-full max-w-[430px] bg-[#fcfcfc] min-h-screen relative flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden">

        {/* Offline Status Warning Bar */}
        {!isOnline && (
          <div className="bg-amber-500 text-black px-4 py-2 text-[12px] font-medium flex items-center justify-between shadow-sm z-30">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Offline: App requires an active internet connection.</span>
            </div>
          </div>
        )}

        {/* Temporary Feedback Notification */}
        {feedbackMessage && isOnline && (
          <div className="bg-zinc-900 text-white px-4 py-2 text-[12px] font-medium flex items-center justify-between z-30">
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>{feedbackMessage}</span>
            </div>
          </div>
        )}

        {/* Load Error Banner */}
        {loadError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-[12px] text-red-700 flex items-center justify-between z-30">
            <span className="truncate pr-2">{loadError}</span>
            <button 
              onClick={handleManualRefresh} 
              className="text-[11px] font-bold underline shrink-0 hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Header */}
        {!isSetupMode && !generatedBill && !showItemsModal && (
          <div className="px-5 pt-5 pb-3 bg-white border-b border-zinc-100">
            {activeTab === 'newBill' ? (
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-zinc-500">Digital Chit</h1>
                  <p className="serif text-[22px] leading-none mt-1 tracking-tight">{shop?.shop_name || 'My Shop'}</p>
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[11px] font-medium">
                    <Hash className="w-3 h-3" /> Bill No: <span className="font-bold">{shop?.next_bill_number ?? '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={openShopSettings} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 transition" title="Settings">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h1 className="serif text-[26px] tracking-tight">History</h1>
                <div className="flex items-center gap-1.5">
                  <button onClick={openShopSettings} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 transition" title="Settings">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* NEW BILL TAB */}
          {activeTab === 'newBill' && !generatedBill && !showItemsModal && !isSetupMode && (
            <div className="p-4 pb-24">
              {!isItemizedMode ? (
                <>
                  <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Amount</span>
                      <button type="button" onClick={() => setIsItemizedMode(true)} className="text-[13px] font-medium text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900">
                        + Add items
                      </button>
                    </div>
                    <div className="relative">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[16px] font-medium text-zinc-400">Rs</span>
                        <input ref={amountInputRef} readOnly value={simpleAmount} className="serif w-full bg-transparent text-[56px] leading-none tracking-tight font-[400] outline-none" placeholder="0" />
                      </div>
                      <div className="mt-3 h-[1px] bg-zinc-100"></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-zinc-500">
                      <span>Enter amount via keypad</span>
                      <button type="button" onClick={() => setShowItemsModal(true)} className="font-medium text-zinc-700">Manage Items • {items.length}</button>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      {['7','8','9','4','5','6','1','2','3'].map(k => (
                        <button key={k} type="button" onClick={() => handleKeypadPress(k)} className="h-[64px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[22px] font-medium active:bg-zinc-900 active:text-white active:scale-[0.98] transition shadow-sm">{k}</button>
                      ))}
                      <button type="button" onClick={() => handleKeypadPress('0')} className="h-[64px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[22px] font-medium active:bg-zinc-900 active:text-white active:scale-[0.98] transition shadow-sm">0</button>
                      <button type="button" onClick={() => handleKeypadPress('.')} className="h-[64px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[22px] font-medium active:bg-zinc-900 active:text-white active:scale-[0.98] transition shadow-sm">.</button>
                      <button type="button" onClick={() => handleKeypadPress('C')} className="h-[64px] rounded-[16px] bg-zinc-900 text-white text-[15px] font-semibold tracking-wide active:bg-black active:scale-[0.98] transition shadow-sm">C</button>
                    </div>
                    <button 
                      disabled={simpleAmountNum <= 0 || isGeneratingBill || !isOnline} 
                      onClick={handleGenerateBill} 
                      className="mt-6 w-full h-[56px] rounded-[16px] bg-black text-white font-semibold text-[15px] tracking-wide disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isGeneratingBill ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Recording in Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Receipt className="w-4 h-4" /> 
                          <span>Generate Bill — Rs {simpleAmountNum}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-4 rounded-[20px] bg-[#111] text-white p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium">QR Bill for Lottery</p>
                      <p className="text-[11px] text-white/60">Customer can save at prize.ird.gov.np</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setIsItemizedMode(false)} className="h-9 px-3 rounded-full bg-white border text-[13px] font-medium flex items-center gap-1.5 active:scale-95">
                      <ArrowLeft className="w-4 h-4" /> Simple
                    </button>
                    <div className="flex-1"></div>
                    <button onClick={() => setShowItemsModal(true)} className="text-[12px] font-medium text-zinc-600">
                      Manage Items • {items.length}
                    </button>
                  </div>
                  
                  <div className="rounded-[20px] bg-white border border-zinc-100 p-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-zinc-400 ml-1" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search or add custom item" className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-zinc-400" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 rounded-[20px] bg-white border border-zinc-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-50 flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">My Items</span>
                      <span className="text-[11px] text-zinc-400">{filteredItems.length} items</span>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-zinc-50">
                      <button onClick={addCustomItem} className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-50 active:bg-zinc-100 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-[14px] font-medium">Add "{searchQuery || 'Custom'}"</span>
                        </div>
                        <span className="text-[12px] text-zinc-400">Custom</span>
                      </button>
                      {filteredItems.map(item => (
                        <button key={item.id} onClick={() => addToBasket(item)} className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-50 active:bg-zinc-100 transition">
                          <div>
                            <p className="text-[14px] font-medium leading-tight">{item.name}</p>
                            <p className="text-[12px] text-zinc-500">Tap to add</p>
                          </div>
                          <span className="text-[14px] font-semibold">Rs {item.price}</span>
                        </button>
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="p-6 text-center text-[13px] text-zinc-400">No items match</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] bg-white border border-zinc-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <h3 className="serif text-[18px]">Basket</h3>
                      <span className="text-[12px] px-2 py-1 rounded-full bg-zinc-100 font-medium">{basket.length} items</span>
                    </div>
                    {basket.length === 0 ? (
                      <div className="px-5 pb-6 pt-2 text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-zinc-50 flex items-center justify-center mb-2">
                          <ShoppingBag className="w-5 h-5 text-zinc-400" />
                        </div>
                        <p className="text-[13px] text-zinc-500">No items yet. Tap items above to add.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-50">
                        {basket.map(b => (
                          <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium truncate">{b.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[12px] text-zinc-500">Rs</span>
                                <input type="number" value={b.unit_price} onChange={(e) => updateBasketPrice(b.id, Number(e.target.value) || 0)} className="w-[70px] h-7 rounded-full bg-zinc-50 border border-zinc-100 text-[12px] px-2 outline-none focus:border-zinc-300" />
                                <span className="text-[12px] text-zinc-400">× {b.qty}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateBasketQty(b.id, -1)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center active:bg-zinc-200">
                                <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-lg">-</span>
                              </button>
                              <span className="w-6 text-center text-[13px] font-medium">{b.qty}</span>
                              <button onClick={() => updateBasketQty(b.id, 1)} className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center active:bg-black">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-right min-w-[60px]">
                              <p className="text-[13px] font-semibold">Rs {b.line_total}</p>
                              <button onClick={() => removeFromBasket(b.id)} className="text-[11px] text-zinc-400 hover:text-red-500">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-4 bg-zinc-50 rounded-b-[24px] sticky bottom-0">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] text-zinc-500">Running total</span>
                        <span className="serif text-[24px] font-medium">Rs {basketTotal}</span>
                      </div>
                      <button 
                        disabled={basketTotal <= 0 || isGeneratingBill || !isOnline} 
                        onClick={handleGenerateBill} 
                        className="w-full h-[52px] rounded-[14px] bg-black text-white font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2"
                      >
                        {isGeneratingBill ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Recording in Supabase...</span>
                          </>
                        ) : (
                          'Generate Bill'
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && !generatedBill && !showItemsModal && !isSetupMode && (
            <div className="p-4 pb-24">
              <div className="rounded-[16px] bg-white border border-zinc-100 p-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-zinc-400 ml-2" />
                <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search bill no, amount..." className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-zinc-400" />
                {historySearch && (
                  <button onClick={() => setHistorySearch('')} className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <div className="mt-4 space-y-2">
                {filteredHistory.length === 0 ? (
                  <div className="rounded-[20px] bg-white border border-zinc-100 p-10 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-zinc-50 flex items-center justify-center mb-3">
                      <Ban className="w-5 h-5 text-zinc-400" />
                    </div>
                    <p className="serif text-[18px]">No bills found</p>
                    <p className="text-[13px] text-zinc-500 mt-1">Bills saved in Supabase database will appear here</p>
                  </div>
                ) : (
                  filteredHistory.map(b => (
                    <button key={b.id} onClick={() => setBillDetailSheet(b)} className="w-full text-left rounded-[18px] bg-white border border-zinc-100 p-4 flex items-center justify-between hover:border-zinc-200 active:scale-[0.99] transition shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
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
            </div>
          )}

          {/* GENERATED BILL / RECEIPT SCREEN */}
          {generatedBill && (
            <div className="min-h-[calc(100vh-28px)] bg-[#fcfcfc] flex flex-col">
              {!showQr ? (
                <>
                  <div className="px-5 pt-6 pb-4 bg-white border-b border-zinc-100">
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setGeneratedBill(null); setShowQr(false); }} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95">
                        <X className="w-4 h-4" />
                      </button>
                      <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Bill Recorded</span>
                      <div className="w-9"></div>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-4">
                    <div className="relative mx-auto w-full max-w-[380px]">
                      <div className="receipt-edge-top bg-white px-5 pt-8 pb-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-zinc-950 receipt-font">
                        <div className="text-center mb-4">
                          <h2 className="text-[20px] font-bold leading-tight uppercase tracking-wider">{shop?.shop_name}</h2>
                          <p className="mt-1 text-[12px] uppercase">PAN: {shop?.pan_number}</p>
                          <p className="mt-1 text-[11px] uppercase font-bold">*** TAX INVOICE ***</p>
                        </div>
                        
                        <div className="receipt-dash-border mb-3"></div>
                        
                        <div className="text-[12px] leading-[1.6] mb-3">
                          <div className="flex justify-between"><span>BILL NO:</span> <span className="font-bold">#{generatedBill.bill_number}</span></div>
                          <div className="flex justify-between"><span>DATE:</span> <span>{formatShortDateTime(generatedBill.created_at)}</span></div>
                        </div>

                        <div className="receipt-dash-border mb-3"></div>
                        
                        <div className="text-[12px] font-bold flex justify-between mb-2">
                          <span>ITEM</span>
                          <span className="text-right">AMOUNT</span>
                        </div>
                        
                        <div className="receipt-dash-border mb-3"></div>
                        
                        <div className="space-y-2 text-[12px]">
                          {generatedBill.items.map(v => (
                            <div key={v.id} className="flex justify-between items-start">
                              <span className="pr-2 leading-[1.4] break-words flex-1">
                                {v.name}
                                {v.qty > 1 && <span className="block text-[11px] text-zinc-500">{v.qty} x Rs {v.unit_price}</span>}
                              </span>
                              <span className="font-bold whitespace-nowrap">{v.line_total.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="receipt-dash-border mt-3 mb-3"></div>
                        
                        <div className="text-[12px] leading-[1.6] mb-3">
                          <div className="flex justify-between">
                            <span>TOTAL ITEMS: {generatedBill.items.length}</span>
                            <span>QTY: {generatedBill.items.reduce((acc, i) => acc + i.qty, 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SUBTOTAL:</span>
                            <span>Rs {generatedBill.total_amount.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="border-y-[3px] border-double border-zinc-900 py-2 mb-6">
                          <div className="flex justify-between items-center text-[16px] font-bold">
                            <span>TOTAL</span>
                            <span>Rs {generatedBill.total_amount.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="text-center text-[11px] leading-relaxed">
                          <p className="font-bold mb-1">*** THANK YOU! ***</p>
                          <div className="mt-4 flex justify-center opacity-60">
                            <svg width="120" height="30" viewBox="0 0 120 30" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0" y="0" width="4" height="30"/>
                              <rect x="6" y="0" width="2" height="30"/>
                              <rect x="10" y="0" width="6" height="30"/>
                              <rect x="18" y="0" width="2" height="30"/>
                              <rect x="22" y="0" width="4" height="30"/>
                              <rect x="28" y="0" width="8" height="30"/>
                              <rect x="40" y="0" width="2" height="30"/>
                              <rect x="44" y="0" width="6" height="30"/>
                              <rect x="52" y="0" width="2" height="30"/>
                              <rect x="56" y="0" width="4" height="30"/>
                              <rect x="62" y="0" width="8" height="30"/>
                              <rect x="74" y="0" width="4" height="30"/>
                              <rect x="80" y="0" width="2" height="30"/>
                              <rect x="84" y="0" width="6" height="30"/>
                              <rect x="92" y="0" width="2" height="30"/>
                              <rect x="96" y="0" width="4" height="30"/>
                              <rect x="102" y="0" width="8" height="30"/>
                              <rect x="114" y="0" width="6" height="30"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="receipt-edge-bottom bg-white w-full h-[6px] shadow-[0_10px_40px_rgba(0,0,0,0.08)]"></div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <button onClick={() => window.open(`sms:?&body=${encodeURIComponent(generateBillText(generatedBill))}`, '_blank')} className="h-[72px] rounded-[18px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-[12px] font-medium">SMS</span>
                      </button>
                      <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generateBillText(generatedBill))}`, '_blank')} className="h-[72px] rounded-[18px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                        <div className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[12px] font-bold">W</div>
                        <span className="text-[12px] font-medium">WhatsApp</span>
                      </button>
                      <button onClick={() => setShowQr(true)} className="h-[72px] rounded-[18px] bg-black text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                        <Database className="w-5 h-5" />
                        <span className="text-[12px] font-medium">Show QR</span>
                      </button>
                    </div>

                    <div className="mt-4 rounded-[14px] bg-amber-50 border border-amber-100 p-3 flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">!</div>
                      <p className="text-[11px] leading-[1.4] text-amber-900">
                        Bill recorded directly on Supabase. Customer can scan QR or save SMS for IRD lottery prize.ird.gov.np
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pb-6 bg-white border-t border-zinc-100">
                    <button onClick={() => { setGeneratedBill(null); setShowQr(false); setActiveTab('newBill'); }} className="w-full h-[54px] rounded-[16px] bg-zinc-100 text-zinc-900 font-semibold text-[14px] active:bg-zinc-200 transition">
                      Done — New Bill
                    </button>
                    <p className="mt-3 text-center text-[11px] text-zinc-400">Bill No #{generatedBill.bill_number} • Saved to Supabase Cloud • Live</p>
                  </div>
                </>
              ) : (
                <div className="min-h-[calc(100vh-28px)] bg-white flex flex-col items-center justify-center p-6">
                  <div className="w-full max-w-[320px] bg-white rounded-[28px] border border-zinc-100 shadow-[0_16px_60px_rgba(0,0,0,0.08)] p-6 flex flex-col items-center">
                    <div className="w-full aspect-square rounded-[20px] bg-zinc-50 flex items-center justify-center overflow-hidden border border-zinc-100">
                      <QRCodeSVG value={generateBillText(generatedBill)} size={240} className="p-2 w-full h-full object-contain" />
                    </div>
                    <p className="mt-5 serif text-[20px]">Bill #{generatedBill.bill_number}</p>
                    <p className="text-[12px] text-zinc-500 mt-1 text-center">Scan to get bill details for IRD lottery</p>
                    <p className="mt-4 text-[11px] px-3 py-1.5 rounded-full bg-zinc-900 text-white font-medium">Rs {generatedBill.total_amount}</p>
                  </div>
                  <button onClick={() => setShowQr(false)} className="mt-8 h-11 px-6 rounded-full bg-zinc-900 text-white text-[14px] font-medium flex items-center gap-2 active:scale-95">
                    <ArrowLeft className="w-4 h-4" /> Back to Bill
                  </button>
                  <button onClick={() => { setGeneratedBill(null); setShowQr(false); }} className="mt-3 text-[13px] text-zinc-500 underline underline-offset-4">
                    Done — New Bill
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MANAGE ITEMS MODAL */}
          {showItemsModal && !generatedBill && (
            <div className="min-h-[calc(100vh-28px)] bg-[#fcfcfc] flex flex-col">
              <div className="px-5 pt-5 pb-3 bg-white border-b border-zinc-100 flex items-center gap-3">
                <button onClick={() => setShowItemsModal(false)} className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="serif text-[22px]">My Items</h2>
                <div className="ml-auto text-[12px] px-2.5 py-1 rounded-full bg-zinc-900 text-white font-medium">{items.length} items</div>
              </div>
              <div className="flex-1 p-4 pb-32">
                <div className="space-y-2">
                  {items.map(v => (
                    <div key={v.id} className="rounded-[16px] bg-white border border-zinc-100 p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium truncate">{v.name}</p>
                        <p className="text-[12px] text-zinc-500">Rs {v.price}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEditItem(v)} className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center active:bg-zinc-100">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteItem(v.id)} className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center active:bg-red-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-12 text-[13px] text-zinc-400">No items found in Supabase. Add one below.</div>
                  )}
                </div>
                <div className="mt-6 rounded-[20px] bg-white border border-zinc-100 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400 mb-3">{editItemId ? 'Edit Item in Supabase' : 'Add New Item to Supabase'}</p>
                  <div className="flex gap-2">
                    <input value={editItemName} onChange={e => setEditItemName(e.target.value)} placeholder="Name e.g. Tea" className="flex-1 h-11 rounded-[12px] bg-zinc-50 border border-zinc-100 px-3 text-[14px] outline-none focus:border-zinc-300" />
                    <input value={editItemPrice} onChange={e => setEditItemPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Rs" type="text" inputMode="decimal" className="w-[90px] h-11 rounded-[12px] bg-zinc-50 border border-zinc-100 px-3 text-[14px] outline-none focus:border-zinc-300" />
                  </div>
                  <button 
                    onClick={handleSaveItem} 
                    disabled={!editItemName.trim() || !editItemPrice || isSavingItem || !isOnline} 
                    className="mt-3 w-full h-11 rounded-[12px] bg-black text-white text-[13px] font-semibold disabled:opacity-30 active:scale-[0.99] transition flex items-center justify-center gap-2"
                  >
                    {isSavingItem ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to Supabase...</span>
                      </>
                    ) : (
                      editItemId ? 'Update Item in Cloud' : '+ Add Item to Cloud'
                    )}
                  </button>
                  {editItemId && (
                    <button onClick={() => { setEditItemId(null); setEditItemName(''); setEditItemPrice(''); }} className="mt-2 w-full h-10 rounded-[12px] bg-zinc-100 text-[13px] font-medium">
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAVIGATION */}
        {!generatedBill && !showItemsModal && !isSetupMode && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setActiveTab('newBill')} className={`h-[48px] rounded-[14px] flex items-center justify-center gap-2 text-[13px] font-semibold transition ${activeTab === 'newBill' ? 'bg-zinc-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]' : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'}`}>
                <Plus className="w-4 h-4" /> New Bill
              </button>
              <button onClick={() => setActiveTab('history')} className={`h-[48px] rounded-[14px] flex items-center justify-center gap-2 text-[13px] font-semibold transition ${activeTab === 'history' ? 'bg-zinc-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]' : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'}`}>
                <Clock className="w-4 h-4" /> History
              </button>
            </div>
            <div className="mt-2 mx-auto w-10 h-1 rounded-full bg-zinc-200"></div>
          </div>
        )}

        {/* SETUP / SETTINGS OVERLAY */}
        {isSetupMode && (
          <div className="absolute inset-0 z-[50] bg-[#fcfcfc] flex flex-col overflow-y-auto">
            <div className="flex-1 p-5 pb-10">
              <div className="w-full max-w-[360px] mx-auto">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto rounded-[16px] bg-black text-white flex items-center justify-center serif text-[24px]">D</div>
                  <h1 className="serif text-[32px] mt-4 tracking-tight">Digital Chit</h1>
                  <p className="text-[13px] text-zinc-500 mt-1">{isEditingShop ? 'Edit shop & cloud settings' : 'Set up your shop to start billing'}</p>
                </div>
                
                <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 mb-4">
                  <h3 className="text-[14px] font-semibold mb-4 text-zinc-800">Shop Details (Supabase)</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Shop Name *</label>
                      <input value={setupShopName} onChange={e => setSetupShopName(e.target.value)} placeholder="e.g. Shrestha Kirana Pasal" className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[14px] outline-none focus:bg-white focus:border-zinc-300 transition" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">PAN Number (9 digits) *</label>
                      <input value={setupPanNumber} onChange={e => setSetupPanNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="123456789" inputMode="numeric" className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[15px] tracking-widest font-medium outline-none focus:bg-white focus:border-zinc-300 transition" />
                      <p className="mt-1.5 text-[11px] text-zinc-400">{setupPanNumber.length}/9 digits {setupPanNumber.length === 9 ? '✓ valid' : ''}</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Starting Bill Number</label>
                      <input value={setupStartingBill} onChange={e => setSetupStartingBill(e.target.value.replace(/\D/g, ''))} placeholder="1" inputMode="numeric" className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[14px] outline-none focus:bg-white focus:border-zinc-300 transition" />
                    </div>
                  </div>
                </div>

                {/* Business Account Card */}
                <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[14px] font-semibold text-zinc-800">Business Account</h3>
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">Cloud Auth</span>
                  </div>
                  <p className="text-[12px] text-zinc-500 mb-4 leading-relaxed">
                    Sign in or register your business to sync invoices and link your Supabase database directly.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button" 
                      onClick={() => { setAuthInitialMode('login'); setShowAuthScreen(true); }}
                      className="h-10 rounded-[12px] bg-zinc-900 text-white text-[13px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <User className="w-3.5 h-3.5" /> Sign In
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setAuthInitialMode('register'); setShowAuthScreen(true); }}
                      className="h-10 rounded-[12px] bg-zinc-100 text-zinc-800 text-[13px] font-medium flex items-center justify-center gap-1.5 hover:bg-zinc-200 active:scale-95 transition"
                    >
                      Register
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-semibold text-zinc-800">Supabase Connection</h3>
                    {isEditingShop && (
                      <button onClick={handleManualRefresh} disabled={isRefreshing || !isOnline} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 disabled:opacity-50">
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Supabase URL</label>
                      <input value={setupSupabaseUrl} onChange={e => setSetupSupabaseUrl(e.target.value)} placeholder="https://xyz.supabase.co" className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[13px] outline-none focus:bg-white focus:border-zinc-300 transition" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Anon Key</label>
                      <input value={setupSupabaseKey} onChange={e => setSetupSupabaseKey(e.target.value)} type="password" placeholder="eyJhb..." className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[13px] outline-none focus:bg-white focus:border-zinc-300 transition" />
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] text-zinc-400 leading-relaxed">
                    All shop records and generated bills are stored directly on your Supabase cloud database in real-time.
                  </p>
                </div>

                <button 
                  disabled={!isValidSetup || isSavingSetup || !isOnline} 
                  onClick={handleSaveSetup} 
                  className="mt-6 w-full h-[52px] rounded-[14px] bg-black text-white font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  {isSavingSetup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving in Supabase...</span>
                    </>
                  ) : (
                    isEditingShop ? 'Save Changes' : 'Save & Continue'
                  )}
                </button>
                {isEditingShop && (
                  <>
                    <button onClick={() => { setIsSetupMode(false); setIsEditingShop(false); }} className="mt-3 w-full h-11 rounded-[12px] bg-zinc-100 font-medium text-[13px] hover:bg-zinc-200 transition">
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      onClick={async () => {
                        await signOutBusiness();
                        setIsSetupMode(false);
                        setIsEditingShop(false);
                        setAuthInitialMode('login');
                        setShowAuthScreen(true);
                      }} 
                      className="mt-2 w-full h-11 rounded-[12px] bg-red-50 text-red-600 font-medium text-[13px] hover:bg-red-100 transition flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out / Switch Account
                    </button>
                  </>
                )}
                
                {!isEditingShop && (
                  <p className="mt-6 text-center text-[11px] text-zinc-400 leading-relaxed">
                    Bill numbers are sequential & never reset. PAN is masked on printed bills.<br/>
                    Cloud Database • Supabase Realtime • Live
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BILL DETAIL BOTTOM SHEET */}
        {billDetailSheet && (
          <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-[430px] bg-[#fcfcfc] rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.2)] animate-slideUp">
              <div className="p-3 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-zinc-200"></div>
              </div>
              <div className="px-5 pb-3 flex items-center justify-between">
                <h3 className="serif text-[20px]">Bill #{billDetailSheet.bill_number}</h3>
                <button onClick={() => setBillDetailSheet(null)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="relative mx-auto w-full">
                  <div className="receipt-edge-top bg-white px-5 pt-8 pb-8 shadow-sm text-zinc-950 receipt-font">
                    <div className="text-center mb-4">
                      <h2 className="text-[18px] font-bold leading-tight uppercase tracking-wider">{shop?.shop_name}</h2>
                      <p className="mt-1 text-[11px] uppercase">PAN: {shop?.pan_number}</p>
                      <p className="mt-1 text-[10px] uppercase font-bold">*** TAX INVOICE ***</p>
                    </div>
                    
                    <div className="receipt-dash-border mb-3"></div>
                    
                    <div className="text-[11px] leading-[1.6] mb-3">
                      <div className="flex justify-between"><span>BILL NO:</span> <span className="font-bold">#{billDetailSheet.bill_number}</span></div>
                      <div className="flex justify-between"><span>DATE:</span> <span>{formatShortDateTime(billDetailSheet.created_at)}</span></div>
                      <div className="flex justify-between"><span>TYPE:</span> <span>{billDetailSheet.bill_type.toUpperCase()}</span></div>
                    </div>

                    <div className="receipt-dash-border mb-3"></div>
                    
                    <div className="text-[11px] font-bold flex justify-between mb-2">
                      <span>ITEM</span>
                      <span className="text-right">AMOUNT</span>
                    </div>
                    
                    <div className="receipt-dash-border mb-3"></div>
                    
                    <div className="space-y-2 text-[11px]">
                      {billDetailSheet.items.map(v => (
                        <div key={v.id} className="flex justify-between items-start">
                          <span className="pr-2 leading-[1.4] break-words flex-1">
                            {v.name}
                            {v.qty > 1 && <span className="block text-[10px] text-zinc-500">{v.qty} x Rs {v.unit_price}</span>}
                          </span>
                          <span className="font-bold whitespace-nowrap">{v.line_total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="receipt-dash-border mt-3 mb-3"></div>
                    
                    <div className="text-[11px] leading-[1.6] mb-3">
                      <div className="flex justify-between">
                        <span>ITEMS: {billDetailSheet.items.length}</span>
                        <span>QTY: {billDetailSheet.items.reduce((acc, i) => acc + i.qty, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SUBTOTAL:</span>
                        <span>Rs {billDetailSheet.total_amount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="border-y-[3px] border-double border-zinc-900 py-2 mb-4">
                      <div className="flex justify-between items-center text-[15px] font-bold">
                        <span>TOTAL</span>
                        <span>Rs {billDetailSheet.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="text-center text-[10px] leading-relaxed">
                      <p className="font-bold mb-1">*** THANK YOU! ***</p>
                      <div className="mt-3 flex justify-center opacity-60">
                        <svg width="100" height="24" viewBox="0 0 120 30" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0" y="0" width="4" height="30"/><rect x="6" y="0" width="2" height="30"/><rect x="10" y="0" width="6" height="30"/><rect x="18" y="0" width="2" height="30"/><rect x="22" y="0" width="4" height="30"/><rect x="28" y="0" width="8" height="30"/><rect x="40" y="0" width="2" height="30"/><rect x="44" y="0" width="6" height="30"/><rect x="52" y="0" width="2" height="30"/><rect x="56" y="0" width="4" height="30"/><rect x="62" y="0" width="8" height="30"/><rect x="74" y="0" width="4" height="30"/><rect x="80" y="0" width="2" height="30"/><rect x="84" y="0" width="6" height="30"/><rect x="92" y="0" width="2" height="30"/><rect x="96" y="0" width="4" height="30"/><rect x="102" y="0" width="8" height="30"/><rect x="114" y="0" width="6" height="30"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="receipt-edge-bottom bg-white w-full h-[6px] shadow-sm"></div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => window.open(`sms:?&body=${encodeURIComponent(generateBillText(billDetailSheet))}`, '_blank')} className="h-[64px] rounded-[16px] bg-white border flex flex-col items-center justify-center gap-1 active:scale-95">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-[11px] font-medium">SMS</span>
                  </button>
                  <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generateBillText(billDetailSheet))}`, '_blank')} className="h-[64px] rounded-[16px] bg-white border flex flex-col items-center justify-center gap-1 active:scale-95">
                    <div className="w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-bold">W</div>
                    <span className="text-[11px] font-medium">WhatsApp</span>
                  </button>
                  <button onClick={() => { setGeneratedBill(billDetailSheet); setBillDetailSheet(null); setShowQr(true); }} className="h-[64px] rounded-[16px] bg-black text-white flex flex-col items-center justify-center gap-1 active:scale-95">
                    <Database className="w-4 h-4" />
                    <span className="text-[11px] font-medium">QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUTH SCREEN (LOGIN / REGISTER BUSINESS) */}
        {showAuthScreen && (
          <div className="absolute inset-0 z-[60] bg-[#fcfcfc] flex flex-col animate-slideUp">
            <AuthScreen 
              initialMode={authInitialMode}
              onClose={() => setShowAuthScreen(false)}
              onSuccess={handleAuthSuccess}
            />
          </div>
        )}
      </div>
    </div>
  );
}
