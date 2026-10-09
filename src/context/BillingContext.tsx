import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Item, Bill, BasketItem, HistoryDateFilter } from '../types';
import { generateId } from '../lib/storage';
import { 
  checkIsOnline, 
  fetchItems, 
  createItem, 
  updateItem, 
  deleteItem, 
  fetchBillsPaginated,
  fetchAllBillsForExport,
  downloadBillsCsv,
  generateBill 
} from '../lib/dbService';
import { useShop } from '../hooks/useShop';
import { formatDateTime } from '../lib/formatters';
import { BillingContext, type BillingContextType } from './billingContextDef';

const PAGE_SIZE = 50;

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { shop, setShop, subscriptionInfo, setShowUpgradeModal } = useShop();

  // Navigation
  const [activeTab, setActiveTab] = useState<'newBill' | 'history'>('newBill');

  // Items & Bills from Supabase
  const [items, setItems] = useState<Item[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  // Simple Mode State
  const [isItemizedMode, setIsItemizedMode] = useState(false);
  const [simpleAmount, setSimpleAmount] = useState('0');
  const [isVat, setIsVat] = useState(false);
  const [isDiscount, setIsDiscount] = useState(false);
  const isVatEnabled = Boolean(shop?.vat_enabled);
  const isDiscountEnabled = Boolean(shop?.discount_enabled);

  // Search & Basket
  const [searchQuery, setSearchQuery] = useState('');
  const [basket, setBasket] = useState<BasketItem[]>([]);

  // Custom Item Modal State
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const customPriceInputRef = useRef<HTMLInputElement>(null);

  // Generated Bill
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const isSubmittingBillRef = useRef(false);
  // Idempotency key per basket: prevents duplicate bills on flaky network retries/retaps
  const basketIdempotencyKeyRef = useRef<string | null>(null);

  const resetBasketIdempotencyKey = useCallback(() => {
    basketIdempotencyKeyRef.current = null;
  }, []);

  const [generatedBill, setGeneratedBill] = useState<Bill | null>(null);
  const [showQr, setShowQr] = useState(false);

  // History & Pagination State
  const [historySearch, setHistorySearch] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [billDetailSheet, setBillDetailSheet] = useState<Bill | null>(null);
  const [historyDateFilter, setHistoryDateFilter] = useState<HistoryDateFilter>('30days');
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreBills, setHasMoreBills] = useState(false);
  const [totalBillsCount, setTotalBillsCount] = useState(0);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Request sequencing ref to cancel and discard stale out-of-order network responses
  const billsRequestIdRef = useRef(0);

  // Debounce search input (300ms) to avoid spamming the database on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(historySearch.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [historySearch]);

  // Manage Items State
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');

  // 1. Fetch Inventory Items strictly when shop changes (decoupled from bills date/search filtering)
  useEffect(() => {
    let isMounted = true;
    if (shop?.id) {
      void fetchItems(shop.id)
        .then(cloudItems => {
          if (isMounted) setItems(cloudItems);
        })
        .catch(err => {
          console.error('Error fetching inventory items:', err);
        });
    } else {
      void Promise.resolve().then(() => {
        if (isMounted) setItems([]);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [shop?.id]);

  // 2. Fetch Paginated Bills reactively when shop, date filter, or debounced search query changes
  useEffect(() => {
    let isMounted = true;
    if (!shop?.id) {
      void Promise.resolve().then(() => {
        if (!isMounted) return;
        setBills([]);
        setBasket([]);
        setSimpleAmount('0');
        setGeneratedBill(null);
        setBillDetailSheet(null);
        setTotalBillsCount(0);
        setHasMoreBills(false);
      });
      return;
    }

    const shopId = shop.id;
    const currentRequestId = ++billsRequestIdRef.current;

    void (async () => {
      await Promise.resolve();
      if (!isMounted || billsRequestIdRef.current !== currentRequestId) return;
      setIsLoadingBills(true);

      try {
        const billsResult = await fetchBillsPaginated(shopId, {
          limit: PAGE_SIZE,
          offset: 0,
          dateFilter: historyDateFilter,
          searchQuery: debouncedSearchQuery
        });

        if (!isMounted || billsRequestIdRef.current !== currentRequestId) return;
        setBills(billsResult.bills);
        setTotalBillsCount(billsResult.totalCount);
        setHasMoreBills(billsResult.hasMore);
      } catch (err) {
        if (!isMounted || billsRequestIdRef.current !== currentRequestId) return;
        console.error('Error fetching bills:', err);
      } finally {
        if (isMounted && billsRequestIdRef.current === currentRequestId) {
          setIsLoadingBills(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [shop?.id, historyDateFilter, debouncedSearchQuery]);

  // Load more bills (keyset cursor when no search, or offset when searching)
  const loadMoreBills = useCallback(async () => {
    if (!shop || isLoadingMore || !hasMoreBills) return;
    setIsLoadingMore(true);
    const currentRequestId = billsRequestIdRef.current;
    try {
      const lastBill = bills[bills.length - 1];
      const result = await fetchBillsPaginated(shop.id, {
        limit: PAGE_SIZE,
        cursorBillNumber: debouncedSearchQuery ? undefined : lastBill?.bill_number,
        offset: bills.length,
        includeCount: false,
        cachedTotalCount: totalBillsCount,
        dateFilter: historyDateFilter,
        searchQuery: debouncedSearchQuery
      });

      if (billsRequestIdRef.current === currentRequestId) {
        setBills(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newUnique = result.bills.filter(b => !existingIds.has(b.id));
          return [...prev, ...newUnique];
        });
        setTotalBillsCount(result.totalCount);
        setHasMoreBills(result.hasMore);
      }
    } catch (err) {
      console.error('Error loading more bills:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [shop, isLoadingMore, hasMoreBills, bills, historyDateFilter, debouncedSearchQuery, totalBillsCount]);

  // Handle changing date filter (reactive effect is single source of truth; avoids racing duplicate fetch)
  const handleSetHistoryDateFilter = useCallback((filter: HistoryDateFilter) => {
    setHistoryDateFilter(filter);
  }, []);

  // Manual refresh of current bills view
  const refreshBillingData = useCallback(async () => {
    if (!shop) return;
    const currentRequestId = ++billsRequestIdRef.current;
    setIsLoadingBills(true);
    try {
      const [cloudItems, billsResult] = await Promise.all([
        fetchItems(shop.id),
        fetchBillsPaginated(shop.id, {
          limit: PAGE_SIZE,
          offset: 0,
          dateFilter: historyDateFilter,
          searchQuery: debouncedSearchQuery
        })
      ]);
      if (billsRequestIdRef.current === currentRequestId) {
        setItems(cloudItems);
        setBills(billsResult.bills);
        setTotalBillsCount(billsResult.totalCount);
        setHasMoreBills(billsResult.hasMore);
      }
    } catch (err) {
      console.error('Error refreshing billing data:', err);
    } finally {
      if (billsRequestIdRef.current === currentRequestId) {
        setIsLoadingBills(false);
      }
    }
  }, [shop, historyDateFilter, debouncedSearchQuery]);

  // Handle on-demand CSV Export (streams without polluting state)
  const handleExportCsv = useCallback(async (scope: 'current_filter' | 'all_time' = 'current_filter') => {
    if (!shop || isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const exportFilter = scope === 'all_time' ? 'all' : historyDateFilter;
      const billsToExport = await fetchAllBillsForExport(shop.id, {
        dateFilter: exportFilter
      });
      
      if (billsToExport.length === 0) {
        alert('No bills found for the selected export range.');
        return;
      }
      
      await downloadBillsCsv(billsToExport, shop, `DigiBill_${exportFilter}`);
    } catch (err: any) {
      console.error('Error exporting bills to CSV:', err);
      alert('CSV Export failed: ' + (err.message || 'Please check your connection.'));
    } finally {
      setIsExportingCsv(false);
    }
  }, [shop, isExportingCsv, historyDateFilter]);

  // Safe setters that invalidate idempotency key when draft input changes
  const handleSetIsItemizedMode = useCallback((val: boolean) => {
    resetBasketIdempotencyKey();
    setIsItemizedMode(val);
  }, [resetBasketIdempotencyKey]);

  const handleSetSimpleAmount = useCallback((val: string) => {
    resetBasketIdempotencyKey();
    setSimpleAmount(val);
  }, [resetBasketIdempotencyKey]);

  // Tax / Discount Settings toggles
  const handleToggleVatSetting = useCallback((enabled: boolean) => {
    resetBasketIdempotencyKey();
    if (!enabled) setIsVat(false);
  }, [resetBasketIdempotencyKey]);

  const handleToggleDiscountSetting = useCallback((enabled: boolean) => {
    resetBasketIdempotencyKey();
    if (!enabled) setIsDiscount(false);
  }, [resetBasketIdempotencyKey]);

  const toggleVat = useCallback(() => {
    resetBasketIdempotencyKey();
    setIsVat(prev => !prev);
  }, [resetBasketIdempotencyKey]);

  const toggleDiscount = useCallback(() => {
    resetBasketIdempotencyKey();
    setIsDiscount(prev => !prev);
  }, [resetBasketIdempotencyKey]);

  // Keypad logic
  const handleKeypadPress = useCallback((key: string) => {
    resetBasketIdempotencyKey();
    setSimpleAmount(prevAmount => {
      let newAmount = prevAmount;
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
          return newAmount;
        }
        if (newAmount.includes('.')) {
          const decimalPart = newAmount.split('.')[1] || '';
          if (decimalPart.length >= 2) return newAmount;
          if (decimalPart.length === 1) return newAmount + '0';
          return newAmount + '00';
        }
        const rawLen = newAmount.replace('.', '').length;
        if (rawLen >= 8) {
          if (rawLen === 8) return newAmount + '0';
          return newAmount;
        }
        return newAmount + '00';
      } else if (key === '.') {
        if (newAmount.includes('.')) return newAmount;
        newAmount = newAmount + '.';
      } else if (key === '0') {
        if (newAmount === '0') return newAmount;
        if (newAmount.includes('.')) {
          const decimalPart = newAmount.split('.')[1] || '';
          if (decimalPart.length >= 2) return newAmount;
        }
        if (newAmount.replace('.', '').length >= 9) return newAmount;
        newAmount = newAmount + '0';
      } else {
        if (newAmount.includes('.')) {
          const decimalPart = newAmount.split('.')[1] || '';
          if (decimalPart.length >= 2) return newAmount;
        }
        if (newAmount === '0') {
          newAmount = key;
        } else {
          if (newAmount.replace('.', '').length >= 9) return newAmount;
          newAmount = newAmount + key;
        }
      }
      return newAmount;
    });
  }, [resetBasketIdempotencyKey]);

  // Simple mode calculations
  const simpleAmountNum = useMemo(() => {
    const val = parseFloat(simpleAmount);
    return isNaN(val) ? 0 : val;
  }, [simpleAmount]);

  const simpleDiscountAmount = useMemo(() => {
    return (isDiscountEnabled && isDiscount) ? Number((simpleAmountNum * 0.10).toFixed(2)) : 0;
  }, [isDiscountEnabled, isDiscount, simpleAmountNum]);

  const simpleTaxableAmount = useMemo(() => {
    return Math.max(0, simpleAmountNum - simpleDiscountAmount);
  }, [simpleAmountNum, simpleDiscountAmount]);

  const simpleVatAmount = useMemo(() => {
    return (isVatEnabled && isVat) ? Number((simpleTaxableAmount * 0.13).toFixed(2)) : 0;
  }, [isVatEnabled, isVat, simpleTaxableAmount]);

  const finalSimpleTotal = useMemo(() => {
    return Number((simpleTaxableAmount + simpleVatAmount).toFixed(2));
  }, [simpleTaxableAmount, simpleVatAmount]);

  // Itemized Mode & Basket
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const addToBasket = useCallback((item: Item) => {
    resetBasketIdempotencyKey();
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
        item_id: item.id,
        kind: 'item'
      }];
    });
  }, [resetBasketIdempotencyKey]);

  const updateBasketQty = useCallback((id: string, delta: number) => {
    resetBasketIdempotencyKey();
    setBasket(prev => prev.map(b => {
      if (b.id !== id) return b;
      const newQty = Math.min(Math.max(1, b.qty + delta), 99999);
      return { ...b, qty: newQty, line_total: Number((newQty * b.unit_price).toFixed(2)) };
    }));
  }, [resetBasketIdempotencyKey]);

  const updateBasketPrice = useCallback((id: string, price: number) => {
    resetBasketIdempotencyKey();
    const sanitized = Math.min(Math.max(0, isNaN(price) ? 0 : price), 9999999.99);
    const rounded = Number(sanitized.toFixed(2));
    setBasket(prev => prev.map(b => b.id === id ? { 
      ...b, 
      unit_price: rounded, 
      line_total: Number((b.qty * rounded).toFixed(2)) 
    } : b));
  }, [resetBasketIdempotencyKey]);

  const removeFromBasket = useCallback((id: string) => {
    resetBasketIdempotencyKey();
    setBasket(prev => prev.filter(b => b.id !== id));
  }, [resetBasketIdempotencyKey]);

  const clearBasket = useCallback(() => {
    resetBasketIdempotencyKey();
    setBasket([]);
  }, [resetBasketIdempotencyKey]);

  const basketTotal = useMemo(() => basket.reduce((acc, curr) => acc + curr.line_total, 0), [basket]);

  const itemizedDiscountAmount = useMemo(() => {
    return (isDiscountEnabled && isDiscount) ? Number((basketTotal * 0.10).toFixed(2)) : 0;
  }, [isDiscountEnabled, isDiscount, basketTotal]);

  const itemizedTaxableAmount = useMemo(() => {
    return Math.max(0, basketTotal - itemizedDiscountAmount);
  }, [basketTotal, itemizedDiscountAmount]);

  const itemizedVatAmount = useMemo(() => {
    return (isVatEnabled && isVat) ? Number((itemizedTaxableAmount * 0.13).toFixed(2)) : 0;
  }, [isVatEnabled, isVat, itemizedTaxableAmount]);

  const finalItemizedTotal = useMemo(() => {
    return Number((itemizedTaxableAmount + itemizedVatAmount).toFixed(2));
  }, [itemizedTaxableAmount, itemizedVatAmount]);

  // Custom Item Modal
  useEffect(() => {
    if (showCustomItemModal) {
      const timer = setTimeout(() => {
        customPriceInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showCustomItemModal]);

  const openCustomItemDialog = useCallback(() => {
    setCustomItemName(searchQuery.trim().slice(0, 120) || 'Custom Item');
    setCustomItemPrice('');
    setShowCustomItemModal(true);
  }, [searchQuery]);

  const handleConfirmCustomItem = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    resetBasketIdempotencyKey();
    let name = customItemName.trim().slice(0, 120) || 'Custom Item';
    // Defense-in-depth: strip leading formula characters
    name = name.replace(/^[=+\-@\t\r%|]+/, '').trim() || 'Custom Item';
    const price = parseFloat(customItemPrice);
    if (isNaN(price) || price <= 0 || price > 9999999.99) return;
    const roundedPrice = Number(price.toFixed(2));

    setBasket(prev => [...prev, {
      id: generateId(),
      name,
      qty: 1,
      unit_price: roundedPrice,
      line_total: roundedPrice,
      kind: 'item'
    }]);
    setSearchQuery('');
    setShowCustomItemModal(false);
    setCustomItemName('');
    setCustomItemPrice('');
  }, [customItemName, customItemPrice, resetBasketIdempotencyKey]);

  // Generate Bill directly in Supabase
  const handleGenerateBill = useCallback(async () => {
    if (!shop || isGeneratingBill || isSubmittingBillRef.current) return;
    
    // Subscription & 7-Day Trial Guard
    if (subscriptionInfo.isExpired) {
      setShowUpgradeModal(true);
      return;
    }

    if (!checkIsOnline()) {
      alert('Internet connection required. DigiBill does not work offline — bills must be written directly to Supabase.');
      return;
    }

    // Maintain one idempotency key per basket attempt: reuse across retries/retaps
    if (!basketIdempotencyKeyRef.current) {
      basketIdempotencyKeyRef.current = 'bill_' + generateId();
    }
    const currentBillId = basketIdempotencyKeyRef.current;

    isSubmittingBillRef.current = true;
    setIsGeneratingBill(true);
    try {
      let total = 0;
      let subtotalAmount = 0;
      let discAmt = 0;
      let vatAmt = 0;
      let billItems: BasketItem[] = [];
      let bType: 'simple' | 'itemized' = 'simple';

      if (isItemizedMode) {
        if (basket.length === 0 || basketTotal <= 0) return;
        const invalidItem = basket.find(b => b.unit_price < 0 || b.qty <= 0 || isNaN(b.unit_price) || isNaN(b.qty));
        if (invalidItem) {
          alert(`Invalid item "${invalidItem.name}": Unit price and quantity must be positive numbers.`);
          return;
        }
        if (finalItemizedTotal <= 0 || finalItemizedTotal > 99999999.99) {
          alert('Bill total must be between Rs 0.01 and Rs 99,999,999.99.');
          return;
        }
        subtotalAmount = basketTotal;
        discAmt = itemizedDiscountAmount;
        vatAmt = itemizedVatAmount;
        total = finalItemizedTotal;
        
        billItems = basket.map(b => ({ ...b, kind: (b.kind || 'item') as BasketItem['kind'] }));
        if (discAmt > 0) {
          billItems.push({
            id: generateId(),
            name: 'Discount (10%)',
            qty: 1,
            unit_price: -discAmt,
            line_total: -discAmt,
            kind: 'discount'
          });
        }
        if (vatAmt > 0) {
          billItems.push({
            id: generateId(),
            name: 'VAT (13%)',
            qty: 1,
            unit_price: vatAmt,
            line_total: vatAmt,
            kind: 'vat'
          });
        }
        bType = 'itemized';
      } else {
        if (simpleAmountNum <= 0 || simpleAmountNum > 99999999.99) {
          alert('Please enter a valid bill amount.');
          return;
        }
        if (finalSimpleTotal <= 0 || finalSimpleTotal > 99999999.99) {
          alert('Bill total must be between Rs 0.01 and Rs 99,999,999.99.');
          return;
        }
        subtotalAmount = simpleAmountNum;
        discAmt = simpleDiscountAmount;
        vatAmt = simpleVatAmount;
        total = finalSimpleTotal;

        if (discAmt > 0 || vatAmt > 0) {
          billItems = [
            {
              id: generateId(),
              name: 'Grocery item',
              qty: 1,
              unit_price: subtotalAmount,
              line_total: subtotalAmount,
              kind: 'item'
            }
          ];
          if (discAmt > 0) {
            billItems.push({
              id: generateId(),
              name: 'Discount (10%)',
              qty: 1,
              unit_price: -discAmt,
              line_total: -discAmt,
              kind: 'discount'
            });
          }
          if (vatAmt > 0) {
            billItems.push({
              id: generateId(),
              name: 'VAT (13%)',
              qty: 1,
              unit_price: vatAmt,
              line_total: vatAmt,
              kind: 'vat'
            });
          }
        } else {
          billItems = [{
            id: generateId(),
            name: 'Grocery item',
            qty: 1,
            unit_price: total,
            line_total: total,
            kind: 'item'
          }];
        }
      }

      const result = await generateBill(shop, {
        billId: currentBillId,
        billType: bType,
        totalAmount: total,
        subtotal: subtotalAmount,
        discountAmount: discAmt,
        taxAmount: vatAmt,
        items: billItems
      });

      // Update state with confirmed Supabase data (deduplicating in case already in local list)
      setBills(prev => (prev.some(b => b.id === result.bill.id) ? prev : [result.bill, ...prev]));
      setTotalBillsCount(prev => (bills.some(b => b.id === result.bill.id) ? prev : prev + 1));
      setShop(result.updatedShop);
      setGeneratedBill(result.bill);
      setShowQr(false);
      setSimpleAmount('0');
      setIsVat(false);
      setIsDiscount(false);
      setBasket([]);
      setIsItemizedMode(false);
      resetBasketIdempotencyKey();
    } catch (err: any) {
      console.error('Failed to generate bill in Supabase:', err);
      alert('Failed to save bill to Supabase: ' + (err.message || 'Please check your connection.'));
      // Note: We deliberately do NOT call resetBasketIdempotencyKey() here so that
      // an immediate retap reuses currentBillId, returning the committed bill if connection dropped in flight
    } finally {
      isSubmittingBillRef.current = false;
      setIsGeneratingBill(false);
    }
  }, [
    shop,
    isGeneratingBill,
    subscriptionInfo.isExpired,
    setShowUpgradeModal,
    isItemizedMode,
    basketTotal,
    itemizedDiscountAmount,
    itemizedVatAmount,
    finalItemizedTotal,
    basket,
    simpleAmountNum,
    simpleDiscountAmount,
    simpleVatAmount,
    finalSimpleTotal,
    bills,
    setShop,
    resetBasketIdempotencyKey
  ]);

  // History list: server delivers matching bills across the entire database.
  // Optimistic client matching during the 300ms debounce window.
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    if (!q || q === debouncedSearchQuery.toLowerCase()) {
      return bills;
    }
    
    return bills.filter(b => 
      String(b.bill_number).includes(q) || 
      String(b.total_amount).includes(q) || 
      formatDateTime(b.created_at).toLowerCase().includes(q) ||
      b.items.some(i => i.name.toLowerCase().includes(q))
    );
  }, [bills, historySearch, debouncedSearchQuery]);

  // Item CRUD
  const handleSaveItem = useCallback(async () => {
    let name = editItemName.trim().slice(0, 120);
    // Defense-in-depth: strip leading formula characters
    name = name.replace(/^[=+\-@\t\r%|]+/, '').trim();
    const price = Number(editItemPrice);
    if (!name || isNaN(price) || price < 0 || price > 9999999.99 || !shop) return;
    const roundedPrice = Number(price.toFixed(2));

    if (!checkIsOnline()) {
      alert('Internet connection required to modify inventory items in Supabase.');
      return;
    }

    setIsSavingItem(true);
    try {
      if (editItemId) {
        const updated = await updateItem(editItemId, { name, price: roundedPrice });
        setItems(prev => prev.map(i => i.id === editItemId ? updated : i));
        setEditItemId(null);
      } else {
        const created = await createItem(shop.id, { name, price: roundedPrice });
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
  }, [editItemName, editItemPrice, shop, editItemId]);

  const handleEditItem = useCallback((item: Item) => {
    setEditItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(String(item.price));
  }, []);

  const handleDeleteItem = useCallback(async (id: string) => {
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
  }, [editItemId]);

  const value: BillingContextType = {
    activeTab,
    setActiveTab,
    isItemizedMode,
    setIsItemizedMode: handleSetIsItemizedMode,
    simpleAmount,
    setSimpleAmount: handleSetSimpleAmount,
    handleKeypadPress,
    isVat,
    setIsVat,
    toggleVat,
    isDiscount,
    setIsDiscount,
    toggleDiscount,
    isVatEnabled,
    isDiscountEnabled,
    handleToggleVatSetting,
    handleToggleDiscountSetting,
    simpleAmountNum,
    simpleDiscountAmount,
    simpleTaxableAmount,
    simpleVatAmount,
    finalSimpleTotal,
    items,
    setItems,
    searchQuery,
    setSearchQuery,
    filteredItems,
    basket,
    addToBasket,
    updateBasketQty,
    updateBasketPrice,
    removeFromBasket,
    clearBasket,
    basketTotal,
    itemizedDiscountAmount,
    itemizedTaxableAmount,
    itemizedVatAmount,
    finalItemizedTotal,
    showCustomItemModal,
    setShowCustomItemModal,
    customItemName,
    setCustomItemName,
    customItemPrice,
    setCustomItemPrice,
    customPriceInputRef,
    openCustomItemDialog,
    handleConfirmCustomItem,
    isGeneratingBill,
    handleGenerateBill,
    generatedBill,
    setGeneratedBill,
    showQr,
    setShowQr,
    bills,
    setBills,
    historySearch,
    setHistorySearch,
    filteredHistory,
    billDetailSheet,
    setBillDetailSheet,
    historyDateFilter,
    setHistoryDateFilter: handleSetHistoryDateFilter,
    isLoadingBills,
    isLoadingMore,
    hasMoreBills,
    totalBillsCount,
    loadMoreBills,
    isExportingCsv,
    handleExportCsv,
    isSavingItem,
    editItemId,
    setEditItemId,
    editItemName,
    setEditItemName,
    editItemPrice,
    setEditItemPrice,
    handleSaveItem,
    handleEditItem,
    handleDeleteItem,
    refreshBillingData,
  };

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};
