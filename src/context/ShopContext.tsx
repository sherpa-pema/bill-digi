import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Shop } from '../types';
import { checkIsOnline, fetchShop, createInitialShop, updateShop, getSubscriptionInfo } from '../lib/dbService';
import { signOutBusiness, getActiveUser, isUserAdmin, checkIsAdminServerSide } from '../lib/authService';
import { ShopContext, type ShopContextType } from './shopContextDef';

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
      return window.location.pathname.startsWith('/admin') || window.location.hash.includes('admin');
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

  // Route Listener
  useEffect(() => {
    const handleLocationChange = () => {
      const onAdmin = window.location.pathname.startsWith('/admin') || window.location.hash.includes('admin');
      setIsAdminView(onAdmin);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
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
          if (
            typeof window !== 'undefined' &&
            !window.location.hash.includes('admin') &&
            !window.location.pathname.startsWith('/admin')
          ) {
            window.location.hash = 'admin';
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
        if (typeof window !== 'undefined') {
          window.location.hash = 'admin';
        }
      } else {
        setIsAdminView(false);
        if (
          typeof window !== 'undefined' &&
          (window.location.hash.includes('admin') || window.location.pathname.startsWith('/admin'))
        ) {
          window.location.hash = '';
          if (window.location.pathname.startsWith('/admin')) {
            window.history.pushState(null, '', '/');
          }
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
      window.location.hash = '';
      if (window.location.pathname.startsWith('/admin')) {
        window.history.pushState(null, '', '/');
      }
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
    saveShopSettings,
    signOut,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};
