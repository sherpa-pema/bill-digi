import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, Clock, Settings, Search, X, Hash, Receipt, 
  Trash2, Pencil, ShoppingBag, ArrowLeft, MessageSquare, Ban,
  RefreshCw, Database, User, LogOut, WifiOff, Wifi, Loader2, Delete
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
import { LumaSpin } from '@/components/ui/luma-spin';
import sanoBillLogo from './assets/sano-bill-logo.png';

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

// Helper to extract breakdown from any Bill (from state or Supabase)
const getBillBreakdown = (bill: Bill) => {
  const discountItem = bill.items.find(i => i.name.toLowerCase().includes('discount') || i.line_total < 0);
  const vatItem = bill.items.find(i => i.name.toLowerCase().includes('vat'));
  const regularItems = bill.items.filter(i => i !== discountItem && i !== vatItem);

  const subtotal = bill.subtotal ?? (
    regularItems.length > 0 
      ? regularItems.reduce((acc, curr) => acc + curr.line_total, 0)
      : bill.total_amount
  );
  const discountAmount = bill.discount_amount ?? (discountItem ? Math.abs(discountItem.line_total) : 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const vatAmount = bill.tax_amount ?? (vatItem ? vatItem.line_total : 0);

  return { subtotal, discountAmount, taxableAmount, vatAmount, regularItems, discountItem, vatItem };
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
  const [isVat, setIsVat] = useState(false);
  const [isDiscount, setIsDiscount] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Custom Item Modal State
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const customPriceInputRef = useRef<HTMLInputElement>(null);
  
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
        if (!user) {
          // If unauthenticated / no user_id, navigate to login screen and clear state
          setShop(null);
          setItems([]);
          setBills([]);
          setAuthInitialMode('login');
          setShowAuthScreen(true);
          setIsLoadingData(false);
          return;
        }

        let loadedShop = await fetchShop(user.id);
        
        if (!loadedShop) {
          // If no shop exists on Supabase for this user, create an initial shop
          loadedShop = await createInitialShop(user.id);
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

  // Tax / Discount toggles
  const toggleVat = () => setIsVat(prev => !prev);
  const toggleDiscount = () => setIsDiscount(prev => !prev);

  // Keypad logic
  const handleKeypadPress = (key: string) => {
    let newAmount = simpleAmount;
    if (key === 'C') {
      newAmount = '0';
    } else if (key === 'backspace' || key === '⌫') {
      if (newAmount.length <= 1 || newAmount === '0') {
        newAmount = '0';
      } else {
        newAmount = newAmount.slice(0, -1);
        if (newAmount === '' || newAmount === '-') newAmount = '0';
      }
    } else if (key === '00') {
      if (newAmount === '0') {
        return;
      }
      const rawLen = newAmount.replace('.', '').length;
      if (rawLen >= 9) {
        return;
      } else if (rawLen === 8) {
        newAmount = newAmount + '0';
      } else {
        newAmount = newAmount + '00';
      }
    } else if (key === '.') {
      if (newAmount.includes('.')) return;
      newAmount = newAmount + '.';
    } else if (key === '0') {
      if (newAmount === '0') return;
      if (newAmount.replace('.', '').length >= 9) return;
      newAmount = newAmount + '0';
    } else {
      if (newAmount === '0') {
        newAmount = key;
      } else {
        if (newAmount.replace('.', '').length >= 9) return;
        newAmount = newAmount + key;
      }
    }
    setSimpleAmount(newAmount);
  };

  const simpleAmountNum = useMemo(() => {
    const val = parseFloat(simpleAmount);
    return isNaN(val) ? 0 : val;
  }, [simpleAmount]);

  // Simple Mode Tax/Discount Calculations
  const simpleDiscountAmount = useMemo(() => {
    return isDiscount ? Number((simpleAmountNum * 0.10).toFixed(2)) : 0;
  }, [isDiscount, simpleAmountNum]);

  const simpleTaxableAmount = useMemo(() => {
    return Math.max(0, simpleAmountNum - simpleDiscountAmount);
  }, [simpleAmountNum, simpleDiscountAmount]);

  const simpleVatAmount = useMemo(() => {
    return isVat ? Number((simpleTaxableAmount * 0.13).toFixed(2)) : 0;
  }, [isVat, simpleTaxableAmount]);

  const finalSimpleTotal = useMemo(() => {
    return Number((simpleTaxableAmount + simpleVatAmount).toFixed(2));
  }, [simpleTaxableAmount, simpleVatAmount]);

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

  // Auto-focus custom item price input when modal opens
  useEffect(() => {
    if (showCustomItemModal) {
      const timer = setTimeout(() => {
        customPriceInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showCustomItemModal]);

  const openCustomItemDialog = () => {
    setCustomItemName(searchQuery.trim() || 'Custom Item');
    setCustomItemPrice('');
    setShowCustomItemModal(true);
  };

  const handleConfirmCustomItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = customItemName.trim() || 'Custom Item';
    const price = parseFloat(customItemPrice);
    if (isNaN(price) || price <= 0) return;

    setBasket(prev => [...prev, {
      id: generateId(),
      name,
      qty: 1,
      unit_price: price,
      line_total: price
    }]);
    setSearchQuery('');
    setShowCustomItemModal(false);
    setCustomItemName('');
    setCustomItemPrice('');
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

  const itemizedDiscountAmount = useMemo(() => {
    return isDiscount ? Number((basketTotal * 0.10).toFixed(2)) : 0;
  }, [isDiscount, basketTotal]);

  const itemizedTaxableAmount = useMemo(() => {
    return Math.max(0, basketTotal - itemizedDiscountAmount);
  }, [basketTotal, itemizedDiscountAmount]);

  const itemizedVatAmount = useMemo(() => {
    return isVat ? Number((itemizedTaxableAmount * 0.13).toFixed(2)) : 0;
  }, [isVat, itemizedTaxableAmount]);

  const finalItemizedTotal = useMemo(() => {
    return Number((itemizedTaxableAmount + itemizedVatAmount).toFixed(2));
  }, [itemizedTaxableAmount, itemizedVatAmount]);

  // Generate Bill directly in Supabase
  const handleGenerateBill = async () => {
    if (!shop || isGeneratingBill) return;
    
    if (!checkIsOnline()) {
      alert('Internet connection required. DigiBill does not work offline — bills must be written directly to Supabase.');
      return;
    }

    let total = 0;
    let subtotalAmount = 0;
    let discAmt = 0;
    let vatAmt = 0;
    let billItems: BasketItem[] = [];
    let bType: 'simple' | 'itemized' = 'simple';

    if (isItemizedMode) {
      if (basketTotal <= 0) return;
      subtotalAmount = basketTotal;
      discAmt = itemizedDiscountAmount;
      vatAmt = itemizedVatAmount;
      total = finalItemizedTotal;
      
      billItems = [...basket];
      if (discAmt > 0) {
        billItems.push({
          id: generateId(),
          name: 'Discount (10%)',
          qty: 1,
          unit_price: -discAmt,
          line_total: -discAmt
        });
      }
      if (vatAmt > 0) {
        billItems.push({
          id: generateId(),
          name: 'VAT (13%)',
          qty: 1,
          unit_price: vatAmt,
          line_total: vatAmt
        });
      }
      bType = 'itemized';
    } else {
      if (simpleAmountNum <= 0) return;
      subtotalAmount = simpleAmountNum;
      discAmt = simpleDiscountAmount;
      vatAmt = simpleVatAmount;
      total = finalSimpleTotal;

      if (discAmt > 0 || vatAmt > 0) {
        billItems = [
          {
            id: generateId(),
            name: 'Base Amount',
            qty: 1,
            unit_price: subtotalAmount,
            line_total: subtotalAmount
          }
        ];
        if (discAmt > 0) {
          billItems.push({
            id: generateId(),
            name: 'Discount (10%)',
            qty: 1,
            unit_price: -discAmt,
            line_total: -discAmt
          });
        }
        if (vatAmt > 0) {
          billItems.push({
            id: generateId(),
            name: 'VAT (13%)',
            qty: 1,
            unit_price: vatAmt,
            line_total: vatAmt
          });
        }
      } else {
        billItems = [{
          id: generateId(),
          name: 'Total Amount',
          qty: 1,
          unit_price: total,
          line_total: total
        }];
      }
    }

    setIsGeneratingBill(true);
    try {
      const result = await generateBill(shop, {
        billType: bType,
        totalAmount: total,
        subtotal: subtotalAmount,
        discountAmount: discAmt,
        taxAmount: vatAmt,
        items: billItems
      });

      // Update state with confirmed Supabase data
      setBills(prev => [result.bill, ...prev]);
      setShop(result.updatedShop);
      setGeneratedBill(result.bill);
      setShowQr(false);
      setSimpleAmount('0');
      setIsVat(false);
      setIsDiscount(false);
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
    const { subtotal, discountAmount, taxableAmount, vatAmount, regularItems } = getBillBreakdown(bill);
    
    let itemsStr = '';
    if (bill.bill_type === 'itemized') {
      itemsStr = regularItems.map(i => `${i.name} x${i.qty} = Rs ${i.line_total}`).join('\n');
    } else {
      itemsStr = `Amount: Rs ${subtotal}`;
    }

    let adjustmentsStr = '';
    if (discountAmount > 0) {
      adjustmentsStr += `\nDiscount (-10%): -Rs ${discountAmount.toFixed(2)}`;
    }
    if (vatAmount > 0) {
      adjustmentsStr += `\nTaxable: Rs ${taxableAmount.toFixed(2)}\nVAT (+13%): +Rs ${vatAmount.toFixed(2)}`;
    }
    
    return `${shop.shop_name}\nPAN: ${shop.pan_number}\nBill No: ${bill.bill_number}\nDate: ${dateStr}\n${itemsStr}${adjustmentsStr}\nTotal: Rs ${bill.total_amount}\nThank you! Save for lottery at prize.ird.gov.np`;
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

  // Render Loading / Connection Screen with LumaSpin component
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center font-[Inter,system-ui,sans-serif]">
        <div className="w-full max-w-[430px] bg-[#fcfcfc] min-h-screen flex flex-col items-center justify-center p-6 text-center shadow-lg">
          <div className="mb-8 flex items-center justify-center">
            <LumaSpin />
          </div>
          <h2 className="serif text-xl font-medium tracking-tight mb-2">Sano Bill</h2>
          <p className="text-xs text-zinc-500 max-w-[260px] leading-relaxed">
            Initializing your Sano Bill & cloud workspace...
          </p>
        </div>
      </div>
    );
  }

  // Render Auth Screen directly when unauthenticated
  if (showAuthScreen && !shop) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex justify-center font-[Inter,system-ui,sans-serif]">
        <div className="w-full max-w-[430px] bg-[#fcfcfc] min-h-screen relative flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden">
          <AuthScreen 
            initialMode={authInitialMode}
            onSuccess={handleAuthSuccess}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex justify-center font-[Inter,system-ui,sans-serif]">
      <div className="w-full max-w-[430px] md:max-w-4xl lg:max-w-5xl bg-[#fcfcfc] min-h-screen relative flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden transition-all duration-200">

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
              className="min-h-[44px] px-2 text-[11px] font-bold underline shrink-0 hover:text-red-900 flex items-center"
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
                  <h1 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-zinc-500">Sano Bill</h1>
                  <p className="serif text-[22px] leading-none mt-1 tracking-tight">{shop?.shop_name || 'My Shop'}</p>
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[11px] font-medium">
                    <Hash className="w-3 h-3" /> Bill No: <span className="font-bold">{shop?.next_bill_number ?? '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
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
                <h1 className="serif text-[26px] tracking-tight">History</h1>
                <div className="flex items-center gap-1.5">
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
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* NEW BILL TAB */}
          {activeTab === 'newBill' && !generatedBill && !showItemsModal && !isSetupMode && (
            <div className="p-4 pb-24">
              {!isItemizedMode ? (
                <div className="max-w-[460px] mx-auto w-full">
                  <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Amount</span>
                      <div className="flex items-center gap-2">
                        {simpleAmount !== '0' && (
                          <button 
                            type="button" 
                            onClick={() => handleKeypadPress('C')} 
                            className="min-h-[36px] px-3 py-1 text-[12px] font-medium text-zinc-500 hover:text-red-600 active:scale-95 transition rounded-full bg-zinc-100"
                          >
                            Clear
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={() => setIsItemizedMode(true)} 
                          className="min-h-[36px] px-2 text-[13px] font-medium text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 flex items-center"
                        >
                          + Add items
                        </button>
                      </div>
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
                      <button 
                        type="button" 
                        onClick={() => setShowItemsModal(true)} 
                        className="min-h-[36px] px-2 py-1 font-medium text-zinc-700 hover:text-black flex items-center"
                      >
                        Manage Items • {items.length}
                      </button>
                    </div>

                    {/* Tax / Discount Quick Chips */}
                    <div className="mt-4 flex gap-2">
                      <button 
                        type="button" 
                        onClick={toggleVat} 
                        className={`flex-1 min-h-[44px] h-11 rounded-[14px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                          isVat 
                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        +13% VAT
                      </button>
                      <button 
                        type="button" 
                        onClick={toggleDiscount} 
                        className={`flex-1 min-h-[44px] h-11 rounded-[14px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                          isDiscount 
                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        -10% Disc
                      </button>
                    </div>

                    {/* Live Tax/Discount Breakdown Preview */}
                    {(isVat || isDiscount) && simpleAmountNum > 0 && (
                      <div className="mt-3 p-3 rounded-[14px] bg-zinc-50 border border-zinc-100 text-[12px] space-y-1.5 animate-slideUp">
                        <div className="flex justify-between text-zinc-500">
                          <span>Subtotal</span>
                          <span>Rs {simpleAmountNum.toFixed(2)}</span>
                        </div>
                        {isDiscount && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span>Discount (-10%)</span>
                            <span>- Rs {simpleDiscountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {isVat && (
                          <div className="flex justify-between text-emerald-700 font-medium">
                            <span>VAT (+13%{isDiscount ? ` on Rs ${simpleTaxableAmount.toFixed(2)}` : ''})</span>
                            <span>+ Rs {simpleVatAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-200/80 pt-1.5">
                          <span>Total to Pay</span>
                          <span>Rs {finalSimpleTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Enhanced Keypad Grid */}
                    <div className="mt-5 space-y-2.5">
                      {/* Digits 1-9 in 3 columns */}
                      <div className="grid grid-cols-3 gap-2.5">
                        {['7','8','9','4','5','6','1','2','3'].map(k => (
                          <button 
                            key={k} 
                            type="button" 
                            onClick={() => handleKeypadPress(k)} 
                            className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[22px] font-medium active:bg-zinc-900 active:text-white active:scale-[0.97] transition shadow-sm"
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                      
                      {/* 4-Key Bottom Row: 0, 00, ., ⌫ */}
                      <div className="grid grid-cols-4 gap-2.5">
                        <button 
                          type="button" 
                          onClick={() => handleKeypadPress('0')} 
                          className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[21px] font-medium active:bg-zinc-900 active:text-white active:scale-[0.97] transition shadow-sm flex items-center justify-center"
                        >
                          0
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleKeypadPress('00')} 
                          className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[19px] font-medium active:bg-zinc-900 active:text-white active:scale-[0.97] transition shadow-sm flex items-center justify-center"
                        >
                          00
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleKeypadPress('.')} 
                          className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] border border-zinc-100 text-[22px] font-bold active:bg-zinc-900 active:text-white active:scale-[0.97] transition shadow-sm flex items-center justify-center"
                        >
                          .
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleKeypadPress('⌫')} 
                          className="min-h-[60px] h-[60px] rounded-[16px] bg-zinc-900 text-white text-[15px] font-semibold active:bg-black active:scale-[0.97] transition shadow-sm flex items-center justify-center"
                          title="Backspace"
                        >
                          <Delete className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <button 
                      disabled={simpleAmountNum <= 0 || isGeneratingBill || !isOnline} 
                      onClick={handleGenerateBill} 
                      className="mt-5 w-full min-h-[56px] h-[56px] rounded-[16px] bg-black text-white font-semibold text-[15px] tracking-wide disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isGeneratingBill ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Recording in Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Receipt className="w-4 h-4" /> 
                          <span>Generate Bill — Rs {finalSimpleTotal.toFixed(2)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* DUAL-PANE ITEMIZE MODE (Tablets: 60% Left / 40% Right) */
                <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
                  {/* Left Column (Catalog & Search ~ 60% / 7 cols) */}
                  <div className="md:col-span-7 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <button 
                        onClick={() => setIsItemizedMode(false)} 
                        className="min-h-[44px] px-4 rounded-full bg-white border border-zinc-200 text-[13px] font-semibold flex items-center gap-2 hover:bg-zinc-50 active:scale-95 transition shadow-sm"
                      >
                        <ArrowLeft className="w-4 h-4" /> Simple
                      </button>
                      <button 
                        onClick={() => setShowItemsModal(true)} 
                        className="min-h-[44px] px-3 py-2 text-[12.5px] font-medium text-zinc-700 hover:text-black flex items-center gap-1 transition"
                      >
                        Manage Items • {items.length}
                      </button>
                    </div>
                    
                    <div className="rounded-[20px] bg-white border border-zinc-200/80 p-2.5 flex items-center gap-2 shadow-sm">
                      <Search className="w-4 h-4 text-zinc-400 ml-2 shrink-0" />
                      <input 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        placeholder="Search or add custom item..." 
                        className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-zinc-400 py-1" 
                      />
                      {searchQuery && (
                        <button 
                          type="button"
                          onClick={() => setSearchQuery('')} 
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-1 text-zinc-500 hover:text-zinc-800 active:scale-90 transition"
                          title="Clear search"
                        >
                          <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center">
                            <X className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="mt-4 rounded-[20px] bg-white border border-zinc-200/80 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">My Items</span>
                        <span className="text-[11px] font-medium text-zinc-400">{filteredItems.length} items</span>
                      </div>
                      <div className="max-h-[260px] md:max-h-[calc(100vh-320px)] md:min-h-[300px] overflow-y-auto divide-y divide-zinc-100">
                        <button 
                          onClick={openCustomItemDialog} 
                          className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-zinc-50 active:bg-zinc-100 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                              <Plus className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[14px] font-medium text-zinc-900 block leading-tight">Add "{searchQuery || 'Custom Item'}"</span>
                              <span className="text-[11.5px] text-zinc-400">Set custom price</span>
                            </div>
                          </div>
                          <span className="text-[12px] text-zinc-500 font-medium px-2.5 py-1 rounded-full bg-zinc-100">Set Price →</span>
                        </button>
                        {filteredItems.map(item => (
                          <button 
                            key={item.id} 
                            onClick={() => addToBasket(item)} 
                            className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-zinc-50 active:bg-zinc-100 transition"
                          >
                            <div>
                              <p className="text-[14px] font-medium leading-tight text-zinc-900">{item.name}</p>
                              <p className="text-[12px] text-zinc-500 mt-0.5">Tap to add</p>
                            </div>
                            <span className="text-[14.5px] font-bold text-zinc-900">Rs {item.price}</span>
                          </button>
                        ))}
                        {filteredItems.length === 0 && (
                          <div className="p-8 text-center text-[13px] text-zinc-400">No items match "{searchQuery}"</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column (Active Basket & Checkout ~ 40% / 5 cols) */}
                  <div className="md:col-span-5 md:sticky md:top-4 mt-4 md:mt-0">
                    <div className="rounded-[24px] bg-white border border-zinc-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
                      <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
                        <h3 className="serif text-[20px] text-zinc-900">Basket</h3>
                        <span className="text-[12px] px-2.5 py-1 rounded-full bg-zinc-100 font-semibold text-zinc-700">{basket.length} items</span>
                      </div>
                      
                      {basket.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                          <div className="w-14 h-14 mx-auto rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-2.5">
                            <ShoppingBag className="w-6 h-6 text-zinc-400" />
                          </div>
                          <p className="text-[13.5px] font-medium text-zinc-600">Your basket is empty</p>
                          <p className="text-[12px] text-zinc-400 mt-0.5">Tap items on the left to add</p>
                        </div>
                      ) : (
                        <div className="max-h-[260px] md:max-h-[calc(100vh-420px)] overflow-y-auto divide-y divide-zinc-100">
                          {basket.map(b => (
                            <div key={b.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-zinc-900 truncate">{b.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[12px] text-zinc-500">Rs</span>
                                  <input 
                                    type="number" 
                                    value={b.unit_price} 
                                    onChange={(e) => updateBasketPrice(b.id, Number(e.target.value) || 0)} 
                                    className="w-[72px] h-8 rounded-[8px] bg-zinc-50 border border-zinc-200 text-[13px] px-2 font-medium outline-none focus:bg-white focus:border-zinc-400" 
                                  />
                                  <span className="text-[12px] text-zinc-400">× {b.qty}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button 
                                  type="button"
                                  onClick={() => updateBasketQty(b.id, -1)} 
                                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center active:scale-95 transition"
                                  title="Decrease quantity"
                                >
                                  <span className="font-bold text-lg leading-none select-none">-</span>
                                </button>
                                <span className="w-6 text-center text-[13px] font-semibold">{b.qty}</span>
                                <button 
                                  type="button"
                                  onClick={() => updateBasketQty(b.id, 1)} 
                                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-900 hover:bg-black text-white flex items-center justify-center active:scale-95 transition shadow-sm"
                                  title="Increase quantity"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="text-right min-w-[64px] flex flex-col items-end">
                                <p className="text-[13.5px] font-bold text-zinc-900">Rs {b.line_total}</p>
                                <button 
                                  type="button"
                                  onClick={() => removeFromBasket(b.id)} 
                                  className="min-h-[36px] px-1 flex items-center justify-end text-[11px] text-zinc-400 hover:text-red-600 transition"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="p-4 bg-zinc-50 border-t border-zinc-100">
                        {/* Tax / Discount Quick Chips in Basket */}
                        <div className="flex gap-2 mb-3">
                          <button 
                            type="button" 
                            onClick={toggleVat} 
                            className={`flex-1 min-h-[44px] h-11 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1 transition active:scale-[0.98] ${
                              isVat 
                                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                                : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            +13% VAT
                          </button>
                          <button 
                            type="button" 
                            onClick={toggleDiscount} 
                            className={`flex-1 min-h-[44px] h-11 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1 transition active:scale-[0.98] ${
                              isDiscount 
                                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                                : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            -10% Disc
                          </button>
                        </div>

                        {(isVat || isDiscount) && basketTotal > 0 && (
                          <div className="mb-3 p-3 rounded-xl bg-white border border-zinc-100 text-[11.5px] space-y-1 animate-slideUp">
                            <div className="flex justify-between text-zinc-500">
                              <span>Basket Subtotal</span>
                              <span>Rs {basketTotal.toFixed(2)}</span>
                            </div>
                            {isDiscount && (
                              <div className="flex justify-between text-emerald-700 font-medium">
                                <span>Discount (-10%)</span>
                                <span>- Rs {itemizedDiscountAmount.toFixed(2)}</span>
                              </div>
                            )}
                            {isVat && (
                              <div className="flex justify-between text-emerald-700 font-medium">
                                <span>VAT (+13%{isDiscount ? ` on Rs ${itemizedTaxableAmount.toFixed(2)}` : ''})</span>
                                <span>+ Rs {itemizedVatAmount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[13px] font-medium text-zinc-500">Running total</span>
                          <span className="serif text-[26px] font-semibold text-zinc-900">Rs {finalItemizedTotal.toFixed(2)}</span>
                        </div>
                        <button 
                          disabled={basketTotal <= 0 || isGeneratingBill || !isOnline} 
                          onClick={handleGenerateBill} 
                          className="w-full min-h-[52px] h-[52px] rounded-[16px] bg-black text-white font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isGeneratingBill ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Recording in Supabase...</span>
                            </>
                          ) : (
                            `Generate Bill — Rs ${finalItemizedTotal.toFixed(2)}`
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && !generatedBill && !showItemsModal && !isSetupMode && (
            <div className="p-4 pb-24 max-w-4xl mx-auto w-full">
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
            </div>
          )}

          {/* GENERATED BILL / RECEIPT SCREEN */}
          {generatedBill && (
            <div className="min-h-[calc(100vh-28px)] bg-[#fcfcfc] flex flex-col">
              {!showQr ? (
                <>
                  <div className="px-5 pt-6 pb-4 bg-white border-b border-zinc-100">
                    <div className="flex items-center justify-between max-w-[420px] mx-auto w-full">
                      <button 
                        onClick={() => { setGeneratedBill(null); setShowQr(false); }} 
                        className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 hover:bg-zinc-200 transition"
                        title="Close receipt"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                      <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Bill Recorded</span>
                      <div className="w-11"></div>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-4">
                    <div className="relative mx-auto w-full max-w-[380px]">
                      <div className="receipt-edge-top bg-white px-5 pt-8 pb-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-zinc-950 receipt-font">
                        <div className="text-center mb-4">
                          <h2 className="text-[20px] font-bold leading-tight uppercase tracking-wider">{shop?.shop_name}</h2>
                          <p className="mt-1 text-[12px] uppercase">PAN: {shop?.pan_number}</p>
                          <p className="mt-1 text-[11px] uppercase font-bold">*** PAN BILL COPY ***</p>
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
                        
                        {(() => {
                          const { subtotal, discountAmount, taxableAmount, vatAmount, regularItems } = getBillBreakdown(generatedBill);
                          return (
                            <>
                              <div className="space-y-2 text-[12px]">
                                {generatedBill.items.map(v => (
                                  <div key={v.id} className="flex justify-between items-start">
                                    <span className="pr-2 leading-[1.4] break-words flex-1">
                                      {v.name}
                                      {v.qty > 1 && <span className="block text-[11px] text-zinc-500">{v.qty} x Rs {v.unit_price}</span>}
                                    </span>
                                    <span className={`font-bold whitespace-nowrap ${v.line_total < 0 ? 'text-emerald-700' : ''}`}>
                                      {v.line_total < 0 ? `-Rs ${Math.abs(v.line_total).toFixed(2)}` : v.line_total.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="receipt-dash-border mt-3 mb-3"></div>
                              
                              <div className="text-[12px] leading-[1.6] mb-3">
                                <div className="flex justify-between">
                                  <span>TOTAL ITEMS: {regularItems.length || 1}</span>
                                  <span>QTY: {regularItems.reduce((acc, i) => acc + i.qty, 0) || 1}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>SUBTOTAL:</span>
                                  <span>Rs {subtotal.toFixed(2)}</span>
                                </div>
                                {discountAmount > 0 && (
                                  <div className="flex justify-between text-zinc-700">
                                    <span>DISCOUNT (-10%):</span>
                                    <span>-Rs {discountAmount.toFixed(2)}</span>
                                  </div>
                                )}
                                {vatAmount > 0 && (
                                  <>
                                    <div className="flex justify-between text-zinc-700">
                                      <span>TAXABLE AMOUNT:</span>
                                      <span>Rs {taxableAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-700">
                                      <span>VAT (+13%):</span>
                                      <span>+Rs {vatAmount.toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </>
                          );
                        })()}

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

                    <div className="mt-5 grid grid-cols-3 gap-3 max-w-[380px] mx-auto">
                      <button onClick={() => window.open(`sms:?&body=${encodeURIComponent(generateBillText(generatedBill))}`, '_blank')} className="min-h-[64px] h-[72px] rounded-[18px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-[12px] font-medium">SMS</span>
                      </button>
                      <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generateBillText(generatedBill))}`, '_blank')} className="min-h-[64px] h-[72px] rounded-[18px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                        <div className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[12px] font-bold">W</div>
                        <span className="text-[12px] font-medium">WhatsApp</span>
                      </button>
                      <button onClick={() => setShowQr(true)} className="min-h-[64px] h-[72px] rounded-[18px] bg-black text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                        <Database className="w-5 h-5" />
                        <span className="text-[12px] font-medium">Show QR</span>
                      </button>
                    </div>

                    <div className="mt-4 rounded-[14px] bg-amber-50 border border-amber-100 p-3 flex gap-2.5 max-w-[380px] mx-auto">
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">!</div>
                      <p className="text-[11px] leading-[1.4] text-amber-900">
                        Bill recorded directly on Supabase. Customer can scan QR or save SMS for IRD lottery prize.ird.gov.np
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pb-6 bg-white border-t border-zinc-100">
                    <div className="max-w-[380px] mx-auto w-full">
                      <button 
                        onClick={() => { setGeneratedBill(null); setShowQr(false); setActiveTab('newBill'); }} 
                        className="w-full min-h-[52px] h-[54px] rounded-[16px] bg-zinc-100 text-zinc-900 font-semibold text-[14px] active:bg-zinc-200 transition flex items-center justify-center"
                      >
                        Done — New Bill
                      </button>
                      <p className="mt-3 text-center text-[11px] text-zinc-400">Bill No #{generatedBill.bill_number} • Saved to Supabase Cloud • Live</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="min-h-[calc(100vh-28px)] bg-white flex flex-col items-center justify-center p-6">
                  <div className="w-full max-w-[340px] bg-white rounded-[28px] border border-zinc-100 shadow-[0_16px_60px_rgba(0,0,0,0.08)] p-6 flex flex-col items-center">
                    <div className="w-full aspect-square rounded-[20px] bg-zinc-50 flex items-center justify-center overflow-hidden border border-zinc-100">
                      <QRCodeSVG value={generateBillText(generatedBill)} size={240} className="p-2 w-full h-full object-contain" />
                    </div>
                    <p className="mt-5 serif text-[20px]">Bill #{generatedBill.bill_number}</p>
                    <p className="text-[12px] text-zinc-500 mt-1 text-center">Scan to get bill details for IRD lottery</p>
                    <p className="mt-4 text-[11px] px-3 py-1.5 rounded-full bg-zinc-900 text-white font-medium">Rs {generatedBill.total_amount}</p>
                  </div>
                  <button 
                    onClick={() => setShowQr(false)} 
                    className="mt-8 min-h-[44px] h-12 px-6 rounded-full bg-zinc-900 text-white text-[14px] font-medium flex items-center gap-2 active:scale-95 transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Bill
                  </button>
                  <button 
                    onClick={() => { setGeneratedBill(null); setShowQr(false); }} 
                    className="mt-3 min-h-[44px] px-4 text-[13px] text-zinc-500 underline underline-offset-4 flex items-center"
                  >
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
                <button 
                  onClick={() => setShowItemsModal(false)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 hover:bg-zinc-200 transition"
                  title="Back"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <h2 className="serif text-[22px]">My Items</h2>
                <div className="ml-auto text-[12px] px-3 py-1 rounded-full bg-zinc-900 text-white font-medium">{items.length} items</div>
              </div>
              <div className="flex-1 p-4 pb-32 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                  {items.map(v => (
                    <div key={v.id} className="rounded-[16px] bg-white border border-zinc-100 p-3.5 flex items-center justify-between shadow-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14.5px] font-medium truncate">{v.name}</p>
                        <p className="text-[12.5px] font-semibold text-zinc-600 mt-0.5">Rs {v.price}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleEditItem(v)} 
                          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center active:scale-95 transition"
                          title="Edit Item"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(v.id)} 
                          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center active:scale-95 transition"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-12 text-[13px] text-zinc-400">No items found in Supabase. Add one below.</div>
                  )}
                </div>
                <div className="mt-6 rounded-[20px] bg-white border border-zinc-100 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                  <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400 mb-3">{editItemId ? 'Edit Item in Supabase' : 'Add New Item to Supabase'}</p>
                  <div className="flex gap-2">
                    <input value={editItemName} onChange={e => setEditItemName(e.target.value)} placeholder="Name e.g. Tea" className="flex-1 h-12 rounded-[14px] bg-zinc-50 border border-zinc-200 px-3.5 text-[14px] outline-none focus:bg-white focus:border-zinc-400 transition" />
                    <input value={editItemPrice} onChange={e => setEditItemPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Rs" type="text" inputMode="decimal" className="w-[100px] h-12 rounded-[14px] bg-zinc-50 border border-zinc-200 px-3.5 text-[14px] outline-none focus:bg-white focus:border-zinc-400 transition font-medium" />
                  </div>
                  <button 
                    onClick={handleSaveItem} 
                    disabled={!editItemName.trim() || !editItemPrice || isSavingItem || !isOnline} 
                    className="mt-3.5 w-full min-h-[48px] h-12 rounded-[14px] bg-black text-white text-[13.5px] font-semibold disabled:opacity-30 active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSavingItem ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving to Supabase...</span>
                      </>
                    ) : (
                      editItemId ? 'Update Item in Cloud' : '+ Add Item to Cloud'
                    )}
                  </button>
                  {editItemId && (
                    <button 
                      onClick={() => { setEditItemId(null); setEditItemName(''); setEditItemPrice(''); }} 
                      className="mt-2 w-full min-h-[44px] h-11 rounded-[14px] bg-zinc-100 text-[13px] font-medium hover:bg-zinc-200 transition"
                    >
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
        )}

        {/* SETUP / SETTINGS OVERLAY */}
        {isSetupMode && (
          <div className="absolute inset-0 z-[50] bg-[#fcfcfc] flex flex-col overflow-y-auto">
            <div className="flex-1 p-5 pb-10">
              <div className="w-full max-w-[440px] mx-auto">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-[18px] overflow-hidden flex items-center justify-center shadow-sm">
                    <img 
                      src={sanoBillLogo} 
                      alt="Sano Bill" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h1 className="serif text-[32px] mt-3.5 tracking-tight text-zinc-900 leading-tight">Sano Bill</h1>
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
                      className="min-h-[44px] h-11 rounded-[12px] bg-zinc-900 text-white text-[13px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <User className="w-3.5 h-3.5" /> Sign In
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setAuthInitialMode('register'); setShowAuthScreen(true); }}
                      className="min-h-[44px] h-11 rounded-[12px] bg-zinc-100 text-zinc-800 text-[13px] font-medium flex items-center justify-center gap-1.5 hover:bg-zinc-200 active:scale-95 transition"
                    >
                      Register
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-semibold text-zinc-800">Supabase Connection</h3>
                    {isEditingShop && (
                      <button 
                        onClick={handleManualRefresh} 
                        disabled={isRefreshing || !isOnline} 
                        className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 disabled:opacity-50 hover:bg-zinc-200 transition"
                        title="Refresh connection"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                  className="mt-6 w-full min-h-[52px] h-[52px] rounded-[14px] bg-black text-white font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
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
                    <button 
                      onClick={() => { setIsSetupMode(false); setIsEditingShop(false); }} 
                      className="mt-3 w-full min-h-[44px] h-11 rounded-[12px] bg-zinc-100 font-medium text-[13px] hover:bg-zinc-200 transition flex items-center justify-center"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      onClick={async () => {
                        await signOutBusiness();
                        setShop(null);
                        setItems([]);
                        setBills([]);
                        setBasket([]);
                        setSimpleAmount('0');
                        setIsSetupMode(false);
                        setIsEditingShop(false);
                        setAuthInitialMode('login');
                        setShowAuthScreen(true);
                      }} 
                      className="mt-2 w-full min-h-[44px] h-11 rounded-[12px] bg-red-50 text-red-600 font-medium text-[13px] hover:bg-red-100 transition flex items-center justify-center gap-2"
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
            <div className="w-full max-w-[460px] bg-[#fcfcfc] rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.2)] animate-slideUp">
              <div className="p-3 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-zinc-200"></div>
              </div>
              <div className="px-5 pb-3 flex items-center justify-between">
                <h3 className="serif text-[20px]">Bill #{billDetailSheet.bill_number}</h3>
                <button 
                  onClick={() => setBillDetailSheet(null)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 hover:bg-zinc-200 transition"
                  title="Close"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="relative mx-auto w-full">
                  <div className="receipt-edge-top bg-white px-5 pt-8 pb-8 shadow-sm text-zinc-950 receipt-font">
                    <div className="text-center mb-4">
                      <h2 className="text-[18px] font-bold leading-tight uppercase tracking-wider">{shop?.shop_name}</h2>
                      <p className="mt-1 text-[11px] uppercase">PAN: {shop?.pan_number}</p>
                      <p className="mt-1 text-[10px] uppercase font-bold">*** PAN BILL COPY ***</p>
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
                    
                    {(() => {
                      const { subtotal, discountAmount, taxableAmount, vatAmount, regularItems } = getBillBreakdown(billDetailSheet);
                      return (
                        <>
                          <div className="space-y-2 text-[11px]">
                            {billDetailSheet.items.map(v => (
                              <div key={v.id} className="flex justify-between items-start">
                                <span className="pr-2 leading-[1.4] break-words flex-1">
                                  {v.name}
                                  {v.qty > 1 && <span className="block text-[10px] text-zinc-500">{v.qty} x Rs {v.unit_price}</span>}
                                </span>
                                <span className={`font-bold whitespace-nowrap ${v.line_total < 0 ? 'text-emerald-700' : ''}`}>
                                  {v.line_total < 0 ? `-Rs ${Math.abs(v.line_total).toFixed(2)}` : v.line_total.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="receipt-dash-border mt-3 mb-3"></div>
                          
                          <div className="text-[11px] leading-[1.6] mb-3">
                            <div className="flex justify-between">
                              <span>ITEMS: {regularItems.length || 1}</span>
                              <span>QTY: {regularItems.reduce((acc, i) => acc + i.qty, 0) || 1}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>SUBTOTAL:</span>
                              <span>Rs {subtotal.toFixed(2)}</span>
                            </div>
                            {discountAmount > 0 && (
                              <div className="flex justify-between text-zinc-700">
                                <span>DISCOUNT (-10%):</span>
                                <span>-Rs {discountAmount.toFixed(2)}</span>
                              </div>
                            )}
                            {vatAmount > 0 && (
                              <>
                                <div className="flex justify-between text-zinc-700">
                                  <span>TAXABLE AMOUNT:</span>
                                  <span>Rs {taxableAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-zinc-700">
                                  <span>VAT (+13%):</span>
                                  <span>+Rs {vatAmount.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}

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
                  <button onClick={() => window.open(`sms:?&body=${encodeURIComponent(generateBillText(billDetailSheet))}`, '_blank')} className="min-h-[56px] h-[64px] rounded-[16px] bg-white border flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-[11px] font-medium">SMS</span>
                  </button>
                  <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generateBillText(billDetailSheet))}`, '_blank')} className="min-h-[56px] h-[64px] rounded-[16px] bg-white border flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                    <div className="w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-bold">W</div>
                    <span className="text-[11px] font-medium">WhatsApp</span>
                  </button>
                  <button onClick={() => { setGeneratedBill(billDetailSheet); setBillDetailSheet(null); setShowQr(true); }} className="min-h-[56px] h-[64px] rounded-[16px] bg-black text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                    <Database className="w-4 h-4" />
                    <span className="text-[11px] font-medium">QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM ITEM PRICE DIALOG MODAL */}
        {showCustomItemModal && (
          <div className="absolute inset-0 z-[45] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-slideUp">
            <div className="w-full max-w-[440px] bg-white rounded-t-[28px] sm:rounded-[28px] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Itemized Mode</span>
                  <h3 className="serif text-[22px] leading-tight text-zinc-900 mt-0.5">Enter Custom Price</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowCustomItemModal(false)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 active:scale-95 transition"
                  title="Close"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleConfirmCustomItem} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Item Name</label>
                  <input 
                    value={customItemName} 
                    onChange={e => setCustomItemName(e.target.value)} 
                    placeholder="e.g. Special Dish, Extra Service" 
                    className="mt-1.5 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-200 px-3.5 text-[14px] font-medium outline-none focus:bg-white focus:border-zinc-400 transition" 
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Unit Price (Rs) *</label>
                  <div className="mt-1.5 relative flex items-center">
                    <span className="absolute left-3.5 text-[16px] font-medium text-zinc-400">Rs</span>
                    <input 
                      ref={customPriceInputRef}
                      type="text"
                      inputMode="decimal"
                      value={customItemPrice} 
                      onChange={e => setCustomItemPrice(e.target.value.replace(/[^0-9.]/g, ''))} 
                      placeholder="0.00" 
                      className="w-full h-14 pl-10 pr-4 rounded-[14px] bg-zinc-50 border border-zinc-200 text-[24px] font-semibold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition" 
                    />
                  </div>
                  {customItemPrice !== '' && (parseFloat(customItemPrice) <= 0 || isNaN(parseFloat(customItemPrice))) && (
                    <p className="mt-1.5 text-[11px] text-red-500 font-medium">Price must be greater than Rs 0</p>
                  )}
                </div>

                {/* Quick price presets */}
                <div className="flex gap-2 pt-1">
                  {['50', '100', '200', '500'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomItemPrice(val)}
                      className="flex-1 min-h-[40px] h-10 rounded-[12px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[12.5px] font-semibold transition active:scale-95"
                    >
                      Rs {val}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => setShowCustomItemModal(false)} 
                    className="flex-1 min-h-[48px] h-12 rounded-[14px] bg-zinc-100 text-zinc-700 font-semibold text-[13.5px] hover:bg-zinc-200 active:scale-95 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={!customItemPrice || isNaN(parseFloat(customItemPrice)) || parseFloat(customItemPrice) <= 0} 
                    className="flex-[2] min-h-[48px] h-12 rounded-[14px] bg-black text-white font-semibold text-[13.5px] disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add to Basket
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* AUTH SCREEN (MODAL OVERLAY FOR LOGGED-IN SHOP SWITCHING) */}
        {showAuthScreen && shop && (
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
