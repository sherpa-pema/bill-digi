import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Shop, Item, Bill } from '../types';
import { getSubscriptionInfo } from '../lib/dbService';

export interface AuthSuccessPayload {
  mode: 'login' | 'register';
  user?: User | null;
  shop?: Shop;
  items?: Item[];
  bills?: Bill[];
}

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
  authUser: User | null;
  setAuthUser: React.Dispatch<React.SetStateAction<User | null>>;
  subscriptionInfo: ReturnType<typeof getSubscriptionInfo>;
  loadCloudData: (forcedShop?: Shop) => Promise<{ user: User | null; shop: Shop | null }>;

  // Admin routing
  serverIsAdmin: boolean;
  isAdminView: boolean;
  setIsAdminView: (val: boolean) => void;

  // App-level Modals / Overlays
  showAuthScreen: boolean;
  setShowAuthScreen: (val: boolean) => void;
  authInitialMode: 'login' | 'register';
  setAuthInitialMode: (mode: 'login' | 'register') => void;
  handleAuthSuccess: (authData: AuthSuccessPayload) => void;

  isSetupMode: boolean;
  setIsSetupMode: (val: boolean) => void;
  isEditingShop: boolean;
  setIsEditingShop: (val: boolean) => void;
  openShopSettings: () => void;

  showUpgradeModal: boolean;
  setShowUpgradeModal: (val: boolean) => void;

  showItemsModal: boolean;
  setShowItemsModal: (val: boolean) => void;

  // Theme & Appearance
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  toggleDarkMode: () => void;

  // Actions
  saveShopSettings: (shopData: Partial<Shop>) => Promise<Shop>;
  signOut: () => Promise<void>;
}

export const ShopContext = createContext<ShopContextType | null>(null);
