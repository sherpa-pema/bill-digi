import { createContext } from 'react';
import type { Item, Bill, BasketItem } from '../types';

export interface BillingContextType {
  // Navigation
  activeTab: 'newBill' | 'history';
  setActiveTab: (tab: 'newBill' | 'history') => void;

  // Simple Mode State
  isItemizedMode: boolean;
  setIsItemizedMode: (val: boolean) => void;
  simpleAmount: string;
  setSimpleAmount: (val: string) => void;
  handleKeypadPress: (key: string) => void;
  isVat: boolean;
  setIsVat: (val: boolean) => void;
  toggleVat: () => void;
  isDiscount: boolean;
  setIsDiscount: (val: boolean) => void;
  toggleDiscount: () => void;
  isVatEnabled: boolean;
  isDiscountEnabled: boolean;
  handleToggleVatSetting: (enabled: boolean) => void;
  handleToggleDiscountSetting: (enabled: boolean) => void;

  // Simple Calculations
  simpleAmountNum: number;
  simpleDiscountAmount: number;
  simpleTaxableAmount: number;
  simpleVatAmount: number;
  finalSimpleTotal: number;

  // Itemized Mode State & Basket
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredItems: Item[];
  basket: BasketItem[];
  addToBasket: (item: Item) => void;
  updateBasketQty: (id: string, delta: number) => void;
  updateBasketPrice: (id: string, price: number) => void;
  removeFromBasket: (id: string) => void;
  clearBasket: () => void;

  // Itemized Calculations
  basketTotal: number;
  itemizedDiscountAmount: number;
  itemizedTaxableAmount: number;
  itemizedVatAmount: number;
  finalItemizedTotal: number;

  // Custom Item Modal State
  showCustomItemModal: boolean;
  setShowCustomItemModal: (val: boolean) => void;
  customItemName: string;
  setCustomItemName: (name: string) => void;
  customItemPrice: string;
  setCustomItemPrice: (price: string) => void;
  customPriceInputRef: React.RefObject<HTMLInputElement | null>;
  openCustomItemDialog: () => void;
  handleConfirmCustomItem: (e?: React.FormEvent) => void;

  // Generated Bill & Receipts
  isGeneratingBill: boolean;
  handleGenerateBill: () => Promise<void>;
  generatedBill: Bill | null;
  setGeneratedBill: (bill: Bill | null) => void;
  showQr: boolean;
  setShowQr: (val: boolean) => void;

  // History State
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
  historySearch: string;
  setHistorySearch: (q: string) => void;
  filteredHistory: Bill[];
  billDetailSheet: Bill | null;
  setBillDetailSheet: (bill: Bill | null) => void;

  // Manage Items State
  isSavingItem: boolean;
  editItemId: string | null;
  setEditItemId: (id: string | null) => void;
  editItemName: string;
  setEditItemName: (name: string) => void;
  editItemPrice: string;
  setEditItemPrice: (price: string) => void;
  handleSaveItem: () => Promise<void>;
  handleEditItem: (item: Item) => void;
  handleDeleteItem: (id: string) => Promise<void>;

  // Data reload for items/bills
  refreshBillingData: () => Promise<void>;
}

export const BillingContext = createContext<BillingContextType | null>(null);
