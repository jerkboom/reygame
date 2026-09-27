import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Game, SiteSettings, AccountTypeConfig, Order, ConsoleType } from '../types';
import { initialSiteSettings, initialAccountTypes, initialGames } from '../data/initialData';
import {
  auth,
  isUserAdmin,
  signInWithGoogleAccount,
  signOutAccount,
  getCurrentUserIdToken,
  subscribeToSiteSettings,
  subscribeToGames,
  subscribeToAccountTypes,
} from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface StoreContextType {
  settings: SiteSettings;
  games: Game[];
  accountTypes: AccountTypeConfig[];
  selectedGame: Game | null;
  selectedConsole: ConsoleType;
  selectedAccountType: AccountTypeConfig | null;
  activeModal: 'gameDetail' | 'checkout' | 'terms' | 'trackOrder' | 'admin' | 'myGames' | null;
  searchQuery: string;
  selectedGenre: string;
  selectedConsoleFilter: 'ALL' | 'PS5' | 'PS4';
  activeOrder: Order | null;
  trackingOrderId: string | null;
  trackingToken: string | null;
  isAdminLoggedIn: boolean;
  adminUser: string;
  isLoading: boolean;

  // Google Customer Auth, Private Purchases & First-Purchase Promotion State
  currentUser: User | null;
  myGames: Order[];
  isLoadingMyGames: boolean;
  fetchMyGames: (userOverride?: User | null) => Promise<Order[]>;
  userEligibility: {
    eligible: boolean;
    discountUSD: number;
    hasChecked: boolean;
    loading: boolean;
  };
  checkEligibility: (userOverride?: User | null) => Promise<{ eligible: boolean; discountUSD: number }>;
  loginWithGoogle: () => Promise<User | null>;
  logoutCustomer: () => Promise<void>;
  adminLogout: () => Promise<void>;
  openMyGames: () => void;
  
  // Actions
  setSearchQuery: (q: string) => void;
  setSelectedGenre: (g: string) => void;
  setSelectedConsoleFilter: (c: 'ALL' | 'PS5' | 'PS4') => void;
  openGameDetail: (game: Game) => void;
  setSelectedConsole: (c: ConsoleType) => void;
  setSelectedAccountType: (acc: AccountTypeConfig | null) => void;
  openCheckout: (game?: Game, consoleType?: ConsoleType, accType?: AccountTypeConfig) => void;
  openModal: (modal: 'gameDetail' | 'checkout' | 'terms' | 'trackOrder' | 'admin' | 'myGames' | null) => void;
  closeModal: () => void;
  setTrackingOrder: (orderId: string, token: string) => void;
  setActiveOrder: (order: Order | null) => void;
  setAdminLoggedIn: (logged: boolean, user?: string) => void;
  refreshStoreData: () => Promise<void>;
  
  // Currency helpers
  formatUSD: (val: number) => string;
  formatGHS: (val: number) => string;
  convertToGHS: (usdPrice: number, customRate?: number) => number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(initialSiteSettings);
  const [games, setGames] = useState<Game[]>(initialGames);
  const [accountTypes, setAccountTypes] = useState<AccountTypeConfig[]>(initialAccountTypes);
  
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedConsole, setSelectedConsole] = useState<ConsoleType>('PS5');
  const [selectedAccountType, setSelectedAccountType] = useState<AccountTypeConfig | null>(null);
  const [activeModal, setActiveModal] = useState<'gameDetail' | 'checkout' | 'terms' | 'trackOrder' | 'admin' | 'myGames' | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('ALL');
  const [selectedConsoleFilter, setSelectedConsoleFilter] = useState<'ALL' | 'PS5' | 'PS4'>('ALL');

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState('Administrator');
  const [isLoading, setIsLoading] = useState(false);

  // Customer Auth & First-Purchase Discount State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [myGames, setMyGames] = useState<Order[]>([]);
  const [isLoadingMyGames, setIsLoadingMyGames] = useState(false);
  const [userEligibility, setUserEligibility] = useState<{
    eligible: boolean;
    discountUSD: number;
    hasChecked: boolean;
    loading: boolean;
  }>({
    eligible: false,
    discountUSD: 0,
    hasChecked: false,
    loading: false,
  });

  const fetchMyGames = useCallback(async (userOverride?: User | null): Promise<Order[]> => {
    const targetUser = userOverride !== undefined ? userOverride : auth.currentUser;
    if (!targetUser) {
      setMyGames([]);
      return [];
    }

    try {
      setIsLoadingMyGames(true);
      const token = await targetUser.getIdToken();
      const res = await fetch('/api/customer/my-games', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setMyGames(data.orders);
          return data.orders;
        }
      }
    } catch (err) {
      console.warn('Error fetching customer games:', err);
    } finally {
      setIsLoadingMyGames(false);
    }
    return [];
  }, []);

  const checkEligibility = useCallback(async (userOverride?: User | null) => {
    const targetUser = userOverride !== undefined ? userOverride : auth.currentUser;
    if (!targetUser) {
      setUserEligibility({ eligible: false, discountUSD: 0, hasChecked: true, loading: false });
      return { eligible: false, discountUSD: 0 };
    }

    try {
      setUserEligibility((prev) => ({ ...prev, loading: true }));
      const token = await targetUser.getIdToken();
      const res = await fetch('/api/promotions/check-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (res.ok) {
        const data = await res.json();
        const eligible = Boolean(data.eligible);
        const discountUSD = data.discountUSD ?? (eligible ? (settings.firstPurchaseDiscountAmountUSD ?? 1.00) : 0);
        const nextState = { eligible, discountUSD, hasChecked: true, loading: false };
        setUserEligibility(nextState);
        return { eligible, discountUSD };
      }
    } catch (err) {
      console.warn('Error checking promo eligibility:', err);
    }
    setUserEligibility({ eligible: false, discountUSD: 0, hasChecked: true, loading: false });
    return { eligible: false, discountUSD: 0 };
  }, [settings.firstPurchaseDiscountAmountUSD]);

  const loginWithGoogle = async (): Promise<User | null> => {
    try {
      const user = await signInWithGoogleAccount();
      setCurrentUser(user);
      await Promise.all([
        checkEligibility(user),
        fetchMyGames(user),
      ]);
      return user;
    } catch (err: any) {
      console.warn('Google sign-in error:', err.message);
      throw err;
    }
  };

  const logoutCustomer = async (): Promise<void> => {
    try {
      await signOutAccount();
    } catch (err) {
      console.warn('Google sign-out error:', err);
    } finally {
      setCurrentUser(null);
      setMyGames([]);
      setActiveOrder(null);
      setTrackingOrderId(null);
      setTrackingToken(null);
      setUserEligibility({ eligible: false, discountUSD: 0, hasChecked: true, loading: false });
      setActiveModal((prev) => (prev === 'myGames' || prev === 'trackOrder' ? null : prev));
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('order');
      cleanUrl.searchParams.delete('token');
      cleanUrl.searchParams.delete('view');
      window.history.pushState({}, '', cleanUrl.pathname);
    }
  };

  const adminLogout = async (): Promise<void> => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-admin-csrf': '1',
        },
      });
    } catch (err) {
      console.warn('Admin logout api call note:', err);
    }
    localStorage.removeItem('reygames_admin_token');
    setIsAdminLoggedIn(false);
    setAdminUser('Administrator');
    window.location.href = '/admin/login';
  };

  const openMyGames = () => {
    setActiveModal('myGames');
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'my-games');
    window.history.pushState({}, '', newUrl.toString());
  };

  // Fetch live store settings & games from server API
  const refreshStoreData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [settingsRes, gamesRes, accountsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/games'),
        fetch('/api/account-types'),
      ]);

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings(s);
      }
      if (gamesRes.ok) {
        const g = await gamesRes.json();
        if (Array.isArray(g)) {
          setGames(g);
        }
      }
      if (accountsRes.ok) {
        const a = await accountsRes.json();
        if (Array.isArray(a) && a.length > 0) {
          setAccountTypes(a);
        }
      }
    } catch (err) {
      console.warn('Using local store state (API fetch fallback):', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStoreData();
  }, [refreshStoreData]);

  // Firestore Realtime Subscriptions for seamless instant updates
  useEffect(() => {
    const unsubSettings = subscribeToSiteSettings((liveSettings) => {
      if (liveSettings) {
        setSettings((prev) => ({ ...prev, ...liveSettings }));
      }
    });

    const unsubGames = subscribeToGames((liveGames) => {
      if (Array.isArray(liveGames)) {
        setGames(liveGames);
      }
    });

    const unsubAccounts = subscribeToAccountTypes((liveAccounts) => {
      if (Array.isArray(liveAccounts) && liveAccounts.length > 0) {
        setAccountTypes(liveAccounts);
      }
    });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        checkEligibility(user);
        fetchMyGames(user);
      } else {
        setMyGames([]);
        setUserEligibility({ eligible: false, discountUSD: 0, hasChecked: true, loading: false });
      }
    });

    return () => {
      unsubSettings();
      unsubGames();
      unsubAccounts();
      unsubAuth();
    };
  }, [fetchMyGames]);

  // Check and verify active admin session on mount via secure HttpOnly cookie
  useEffect(() => {
    // Clean up any legacy localStorage token
    localStorage.removeItem('reygames_admin_token');

    fetch('/api/admin/session', {
      credentials: 'include',
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('No active or valid admin session');
      })
      .then((data) => {
        if (data.authenticated) {
          setIsAdminLoggedIn(true);
          setAdminUser(data.adminUser || 'Store Administrator');
        } else {
          setIsAdminLoggedIn(false);
        }
      })
      .catch(() => {
        setIsAdminLoggedIn(false);
      });
  }, []);

  // Check URL parameters for direct order viewing or views, e.g. /?view=my-games or /?order=ord_xxx&token=yyy
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    const tokenParam = params.get('token');
    const viewParam = params.get('view');

    if (viewParam === 'my-games') {
      setActiveModal('myGames');
    } else if (orderParam && tokenParam) {
      setTrackingOrderId(orderParam);
      setTrackingToken(tokenParam);
      setActiveModal('trackOrder');
    }
  }, []);

  const openGameDetail = (game: Game) => {
    setSelectedGame(game);
    // Auto-select preferred console based on game availability
    const prefConsole = game.ps5Available ? 'PS5' : 'PS4';
    setSelectedConsole(prefConsole);
    
    // Auto-select first active account type
    const defaultAcc = accountTypes.find(a => a.isActive) || accountTypes[0];
    setSelectedAccountType(defaultAcc || null);
    setActiveModal('gameDetail');
  };

  const openCheckout = (game?: Game, consoleType?: ConsoleType, accType?: AccountTypeConfig) => {
    if (game) setSelectedGame(game);
    if (consoleType) setSelectedConsole(consoleType);
    if (accType) setSelectedAccountType(accType);
    setActiveModal('checkout');
  };

  const openModal = (modal: 'gameDetail' | 'checkout' | 'terms' | 'trackOrder' | 'admin' | 'myGames' | null) => {
    setActiveModal(modal);
    if (modal === 'myGames') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('view', 'my-games');
      window.history.pushState({}, '', newUrl.toString());
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    const cleanUrl = new URL(window.location.href);
    if (cleanUrl.searchParams.get('view') === 'my-games') {
      cleanUrl.searchParams.delete('view');
      window.history.pushState({}, '', cleanUrl.toString());
    }
  };

  const setTrackingOrder = (orderId: string, token: string) => {
    setTrackingOrderId(orderId);
    setTrackingToken(token);
    setActiveModal('trackOrder');
    // Update browser URL query without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('order', orderId);
    newUrl.searchParams.set('token', token);
    window.history.pushState({}, '', newUrl.toString());
  };

  const setAdminLoggedIn = (logged: boolean, user = 'Administrator') => {
    setIsAdminLoggedIn(logged);
    setAdminUser(user);
  };

  // Currency Helpers
  const formatUSD = (val: number) => {
    return `$${val.toFixed(2)}`;
  };

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toFixed(2)}`;
  };

  const convertToGHS = (usdPrice: number, customRate?: number) => {
    const rate = customRate ?? settings.exchangeRateUSDToGHS;
    return Math.round(usdPrice * rate * 100) / 100;
  };

  return (
    <StoreContext.Provider
      value={{
        settings,
        games,
        accountTypes,
        selectedGame,
        selectedConsole,
        selectedAccountType,
        activeModal,
        searchQuery,
        selectedGenre,
        selectedConsoleFilter,
        activeOrder,
        trackingOrderId,
        trackingToken,
        isAdminLoggedIn,
        adminUser,
        isLoading,
        currentUser,
        myGames,
        isLoadingMyGames,
        fetchMyGames,
        userEligibility,
        checkEligibility,
        loginWithGoogle,
        logoutCustomer,
        adminLogout,
        openMyGames,
        setSearchQuery,
        setSelectedGenre,
        setSelectedConsoleFilter,
        openGameDetail,
        setSelectedConsole,
        setSelectedAccountType,
        openCheckout,
        openModal,
        closeModal,
        setTrackingOrder,
        setActiveOrder,
        setAdminLoggedIn,
        refreshStoreData,
        formatUSD,
        formatGHS,
        convertToGHS,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
