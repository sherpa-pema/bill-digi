import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Shop } from '../types';
import { checkIsOnline, fetchShop, createInitialShop, updateShop, getSubscriptionInfo } from '../lib/dbService';
import { signOutBusiness, getActiveUser, isUserAdmin, checkIsAdminServerSide } from '../lib/authService';
import { ShopContext, type ShopContextType } from './shopContextDef';
import { normalizeAdminRoute, isAdminRoute, navigateToAdmin, navigateToPOS, subscribeToRouteChanges } from '../lib/navigation';

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(checkIsOnline());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);

  // Admin Route View State
  const [isAdminView, setIsAdminView] = useState(() => {
    if (typeof window !== 'undefined') {
      normalizeAdminRoute();
      return isAdminRoute();
    }
    return false;
  });

  // Modal / Screen View States
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [isEditingShop, setIsEditingShop] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);

  // Subscription Details
  const subscriptionInfo = useMemo(() => getSubscriptionInfo(shop), [shop]);

  // Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('sanobill_theme');
      if (savedTheme === 'dark') return true;
      if (savedTheme === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Synchronize documentElement class with dark mode state
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sanobill_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  }, []);

  // Route Listener
  useEffect(() => {
    return subscribeToRouteChanges(setIsAdminView);
  }, []);

  // Load shop & auth data directly from Supabase
  const loadCloudData = useCallback(
    async (forcedShop?: Shop) => {
      if (!checkIsOnline()) {
        setIsOnline(false);
        setIsLoadingData(false);
        setLoadError('No internet connection. DigiBill requires an active online connection to load data from Supabase.');
        return { user: null, shop: null };
      }

      setLoadError(null);
      try {
        let activeShop = forcedShop || shop;
        const user = await getActiveUser();
        setAuthUser(user);

        if (!activeShop) {
          if (!user) {
            setShop(null);
            setAuthInitialMode('login');
            setShowAuthScreen(true);
            setIsLoadingData(false);
            return { user: null, shop: null };
          }

          let loadedShop = await fetchShop(user.id);
          if (!loadedShop) {
            loadedShop = await createInitialShop(user.id);
          }
          activeShop = loadedShop;
          setShop(activeShop);
        }

        const serverIsAdmin = user ? await checkIsAdminServerSide() : false;
        if (serverIsAdmin || isUserAdmin(user) || isUserAdmin(activeShop)) {
          setIsAdminView(true);
          if (typeof window !== 'undefined' && !isAdminRoute()) {
            navigateToAdmin();
          }
        }

        return { user, shop: activeShop };
      } catch (err: any) {
        console.error('Error loading shop data from Supabase:', err);
        setLoadError(err.message || 'Failed to load data from Supabase cloud.');
        return { user: null, shop: null };
      } finally {
        setIsLoadingData(false);
      }
    },
    [shop]
  );

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

  const openShopSettings = useCallback(() => {
    setIsEditingShop(true);
    setIsSetupMode(true);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (!checkIsOnline()) {
      alert('Internet connection required to refresh data from Supabase.');
      return;
    }
    await loadCloudData();
  }, [loadCloudData]);

  const handleAuthSuccess = useCallback(
    async (authData: {
      mode: 'login' | 'register';
      data: Record<string, string>;
      user?: any;
      shop?: Shop;
      items?: any[];
      bills?: any[];
    }) => {
      if (authData.user) {
        setAuthUser(authData.user);
      }
      if (authData.shop) {
        setShop(authData.shop);
      }

      let isAdmin = isUserAdmin(authData.user) || isUserAdmin(authData.shop);
      if (!isAdmin && authData.user) {
        isAdmin = await checkIsAdminServerSide();
      }

      if (isAdmin) {
        setIsAdminView(true);
        if (typeof window !== 'undefined' && !isAdminRoute()) {
          navigateToAdmin();
        }
      } else {
        setIsAdminView(false);
        if (typeof window !== 'undefined' && isAdminRoute()) {
          navigateToPOS();
        }
      }

      setShowAuthScreen(false);
      void loadCloudData(authData.shop);
    },
    [loadCloudData]
  );

  const saveShopSettings = useCallback(
    async (shopData: Partial<Shop>): Promise<Shop> => {
      if (!shop) throw new Error('No active shop');
      const updatedShopData: Shop = {
        ...shop,
        ...shopData,
        updated_at: new Date().toISOString(),
      };
      const savedShop = await updateShop(updatedShopData);
      setShop(savedShop);
      return savedShop;
    },
    [shop]
  );

  const signOut = useCallback(async () => {
    await signOutBusiness();
    setAuthUser(null);
    setShop(null);
    setIsAdminView(false);
    if (typeof window !== 'undefined') {
      navigateToPOS();
    }
    setIsSetupMode(false);
    setIsEditingShop(false);
    setAuthInitialMode('login');
    setShowAuthScreen(true);
  }, []);

  const value: ShopContextType = {
    isOnline,
    isLoadingData,
    loadError,
    feedbackMessage,
    setFeedbackMessage,
    handleManualRefresh,
    shop,
    setShop,
    authUser,
    setAuthUser,
    subscriptionInfo,
    loadCloudData,
    isAdminView,
    setIsAdminView,
    showAuthScreen,
    setShowAuthScreen,
    authInitialMode,
    setAuthInitialMode,
    handleAuthSuccess,
    isSetupMode,
    setIsSetupMode,
    isEditingShop,
    setIsEditingShop,
    openShopSettings,
    showUpgradeModal,
    setShowUpgradeModal,
    showItemsModal,
    setShowItemsModal,
    isDarkMode,
    setIsDarkMode,
    toggleDarkMode,
    saveShopSettings,
    signOut,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};
