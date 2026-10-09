import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Shop } from '../types';
import { checkIsOnline, fetchShop, createInitialShop, updateShop, getSubscriptionInfo } from '../lib/dbService';
import { signOutBusiness, getActiveUser, checkIsAdminServerSide, subscribeToAuthState } from '../lib/authService';
import { ShopContext, type ShopContextType, type AuthSuccessPayload } from './shopContextDef';
import { normalizeAdminRoute, isAdminRoute, navigateToAdmin, navigateToPOS, subscribeToRouteChanges } from '../lib/navigation';

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(checkIsOnline());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [shop, setShop] = useState<Shop | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [serverIsAdmin, setServerIsAdmin] = useState<boolean>(false);

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
        await Promise.resolve();
        setIsOnline(false);
        setIsLoadingData(false);
        setLoadError('No internet connection. DigiBill requires an active online connection to load data from Supabase.');
        return { user: null, shop: null };
      }

      try {
        let activeShop = forcedShop || shop;
        const user = await getActiveUser();
        setLoadError(null);
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

        const verifiedAdmin = user ? await checkIsAdminServerSide() : false;
        setServerIsAdmin(verifiedAdmin);
        if (verifiedAdmin) {
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleOnline = () => {
      setIsOnline(true);
      setFeedbackMessage('Back online. Reconnecting to Supabase...');
      void loadCloudData();
      timer = setTimeout(() => {
        if (isMounted) setFeedbackMessage(null);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setFeedbackMessage('Connection lost. You are currently offline.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCloudData]);

  // Track active user ID to avoid redundant re-fetches
  const activeUserIdRef = useRef<string | null>(null);

  // Subscribe to Supabase Auth lifecycle events (reactive session management)
  useEffect(() => {
    let isMounted = true;

    const subscription = subscribeToAuthState(async (event, session) => {
      if (!isMounted) return;

      const user = session?.user ?? null;

      if (event === 'SIGNED_OUT' || !user) {
        activeUserIdRef.current = null;
        setAuthUser(null);
        setShop(null);
        setServerIsAdmin(false);
        setIsAdminView(false);
        setAuthInitialMode('login');
        setShowAuthScreen(true);
        setIsLoadingData(false);
        if (typeof window !== 'undefined' && isAdminRoute()) {
          navigateToPOS();
        }
        return;
      }

      setAuthUser(user);

      // If user session changed or not yet loaded, load shop and admin status
      if (activeUserIdRef.current !== user.id) {
        activeUserIdRef.current = user.id;

        if (!checkIsOnline()) {
          setIsOnline(false);
          setIsLoadingData(false);
          setLoadError('No internet connection. DigiBill requires an active online connection to load data from Supabase.');
          return;
        }

        try {
          setIsLoadingData(true);
          let loadedShop = await fetchShop(user.id);
          if (!loadedShop) {
            loadedShop = await createInitialShop(user.id);
          }
          if (!isMounted) return;
          setShop(loadedShop);

          const verifiedAdmin = await checkIsAdminServerSide();
          if (!isMounted) return;
          setServerIsAdmin(verifiedAdmin);
          if (verifiedAdmin) {
            setIsAdminView(true);
            if (typeof window !== 'undefined' && !isAdminRoute()) {
              navigateToAdmin();
            }
          }
          setShowAuthScreen(false);
        } catch (err: any) {
          if (!isMounted) return;
          console.error('Error loading shop data from Supabase on auth state change:', err);
          setLoadError(err.message || 'Failed to load data from Supabase cloud.');
        } finally {
          if (isMounted) {
            setIsLoadingData(false);
          }
        }
      } else {
        setIsLoadingData(false);
        setShowAuthScreen(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
    async (authData: AuthSuccessPayload) => {
      if (authData.user) {
        setAuthUser(authData.user);
        activeUserIdRef.current = authData.user.id;
      }
      if (authData.shop) {
        setShop(authData.shop);
      }

      let verifiedAdmin = false;
      if (authData.user) {
        verifiedAdmin = await checkIsAdminServerSide();
      }
      setServerIsAdmin(verifiedAdmin);

      if (verifiedAdmin) {
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
    activeUserIdRef.current = null;
    await signOutBusiness();
    setAuthUser(null);
    setShop(null);
    setServerIsAdmin(false);
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
    serverIsAdmin,
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
