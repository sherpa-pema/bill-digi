import { createContext } from 'react';
import type { Shop } from '../types';
import { getSubscriptionInfo } from '../lib/dbService';

export interface ShopContextType {
  // Network & Loading
  isOnline: boolean;
  isLoadingData: boolean;
  loadError: string | null;
  feedbackMessage: string | null;
  setFeedbackMessage: (msg: string | null) => void;
  handleManualRefresh: () => Promise<void>;

  // Shop & Auth
  shop: Shop | null;
  setShop: React.Dispatch<React.SetStateAction<Shop | null>>;
  authUser: any;
  setAuthUser: React.Dispatch<React.SetStateAction<any>>;
  subscriptionInfo: ReturnType<typeof getSubscriptionInfo>;
  loadCloudData: (forcedShop?: Shop) => Promise<{ user: any; shop: Shop | null }>;

  // Admin routing
  isAdminView: boolean;
  setIsAdminView: (val: boolean) => void;

  // App-level Modals / Overlays
  showAuthScreen: boolean;
  setShowAuthScreen: (val: boolean) => void;
  authInitialMode: 'login' | 'register';
  setAuthInitialMode: (mode: 'login' | 'register') => void;
  handleAuthSuccess: (authData: {
    mode: 'login' | 'register';
    data: Record<string, string>;
    user?: any;
    shop?: Shop;
    items?: any[];
    bills?: any[];
  }) => void;

  isSetupMode: boolean;
  setIsSetupMode: (val: boolean) => void;
  isEditingShop: boolean;
  setIsEditingShop: (val: boolean) => void;
  openShopSettings: () => void;

  showUpgradeModal: boolean;
  setShowUpgradeModal: (val: boolean) => void;

  showItemsModal: boolean;
  setShowItemsModal: (val: boolean) => void;

  // Actions
  saveShopSettings: (shopData: Partial<Shop>) => Promise<Shop>;
  signOut: () => Promise<void>;
}

export const ShopContext = createContext<ShopContextType | null>(null);
