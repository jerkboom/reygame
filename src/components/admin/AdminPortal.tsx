import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  X,
  Lock,
  LayoutDashboard,
  ShoppingBag,
  Gamepad2,
  DollarSign,
  Settings,
  HelpCircle,
  Shield,
  Bell,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  LogOut,
  AlertCircle,
  Check,
  TrendingUp,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Power,
  PowerOff,
  RotateCcw,
  Archive,
  CreditCard,
  Video,
  Play,
  Tag,
  Mail,
  Activity,
  SendHorizontal,
  ExternalLink,
} from 'lucide-react';
import { Game, Order, AccountTypeConfig, FAQItem, AuditLog, AdminNotification, SiteSettings, InventoryItem } from '../../types';
import { auth, googleProvider, subscribeToOrders, subscribeToNotifications, ADMIN_EMAIL, isUserAdmin } from '../../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { InventoryTab } from './InventoryTab';
import { FAQEditorTab } from './FAQEditorTab';
import { AccountTypesTab } from './AccountTypesTab';
import { isValidYouTubeUrl } from '../../lib/youtube';

export type AdminTabType = 'overview' | 'orders' | 'games' | 'inventory' | 'exchange' | 'accounts' | 'settings' | 'faqs' | 'logs';

export interface AdminPortalProps {
  initialTab?: AdminTabType;
  isStandalone?: boolean;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ initialTab, isStandalone = true }) => {
  const {
    activeModal,
    closeModal,
    settings,
    refreshStoreData,
    formatUSD,
    formatGHS,
    isAdminLoggedIn,
    adminUser,
    setAdminLoggedIn,
    adminLogout,
  } = useStore();

  const getTabFromPath = (path: string): AdminTabType => {
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/games')) return 'games';
    if (path.includes('/inventory')) return 'inventory';
    if (path.includes('/currency')) return 'exchange';
    if (path.includes('/account-types')) return 'accounts';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/faqs')) return 'faqs';
    if (path.includes('/audit')) return 'logs';
    return 'overview';
  };

  const [activeTab, setActiveTabState] = useState<AdminTabType>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined') {
      return getTabFromPath(window.location.pathname);
    }
    return 'overview';
  });

  const handleTabChange = (tab: AdminTabType) => {
    setActiveTabState(tab);
    if (isStandalone && typeof window !== 'undefined') {
      const tabToPathMap: Record<AdminTabType, string> = {
        overview: '/admin',
        orders: '/admin/orders',
        games: '/admin/games',
        inventory: '/admin/inventory',
        exchange: '/admin/currency',
        accounts: '/admin/account-types',
        settings: '/admin/settings',
        faqs: '/admin/faqs',
        logs: '/admin/audit',
      };
      const targetPath = tabToPathMap[tab] || '/admin';
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  const setActiveTab = handleTabChange;

  useEffect(() => {
    const onPopState = () => {
      setActiveTabState(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Admin login PIN/password
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [accountTypesList, setAccountTypesList] = useState<AccountTypeConfig[]>([]);
  const [faqsList, setFaqsList] = useState<FAQItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Orders Search & Filter
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Order Fulfillment Form
  const [fulfillmentEmail, setFulfillmentEmail] = useState('');
  const [fulfillmentPassword, setFulfillmentPassword] = useState('');
  const [fulfillmentInstructions, setFulfillmentInstructions] = useState('');
  const [fulfillmentBackupCodes, setFulfillmentBackupCodes] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [fulfillmentError, setFulfillmentError] = useState('');
  const [fulfillmentSuccess, setFulfillmentSuccess] = useState('');
  const [forceAssignmentOverride, setForceAssignmentOverride] = useState(false);
  const [assignmentConflictInfo, setAssignmentConflictInfo] = useState<{
    isConflict: boolean;
    message: string;
    conflictingOrderNumber?: string;
  } | null>(null);
  const [isReleasingAccount, setIsReleasingAccount] = useState(false);

  // Game Editing / Adding
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [isNewGame, setIsNewGame] = useState(false);

  // Cover image upload
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadCoverError, setUploadCoverError] = useState('');
  const [uploadCoverSuccess, setUploadCoverSuccess] = useState('');

  // Game action confirmation modal
  const [gameActionModal, setGameActionModal] = useState<{
    game: Game;
    mode: 'deactivate' | 'delete' | 'reactivate' | 'restore' | 'archive' | 'permanent_delete';
  } | null>(null);
  const [isProcessingGameAction, setIsProcessingGameAction] = useState(false);
  const [gameActionSuccess, setGameActionSuccess] = useState('');
  const [gameActionError, setGameActionError] = useState('');
  const [gameCatalogFilter, setGameCatalogFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>('ALL');

  // Exchange Rate Setting
  const [rateInput, setRateInput] = useState<number>(settings.exchangeRateUSDToGHS);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateSuccessMessage, setRateSuccessMessage] = useState('');
  const [paymentGatewayStatus, setPaymentGatewayStatus] = useState<{
    provider: string;
    currency: string;
    configured: boolean;
    mode: 'TEST' | 'LIVE' | 'NOT_CONFIGURED';
    publicKey: string | null;
  } | null>(null);

  // Site Settings Form
  const [settingsForm, setSettingsForm] = useState<SiteSettings>({ ...settings });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; provider?: string } | null>(null);
  const [customTestEmailRecipient, setCustomTestEmailRecipient] = useState('');
  const [smtpDiagnostics, setSmtpDiagnostics] = useState<{ connection: string; authentication: string; provider: string; details?: string } | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [emailConfigStatus, setEmailConfigStatus] = useState<{
    isConfigured: boolean;
    activeProvider: string;
    senderAddress: string;
    recipientAddress: string;
    details: string;
    enabled: boolean;
  } | null>(null);
  const [allowFulfillBypass, setAllowFulfillBypass] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Sync settings when loaded or changed in context
  useEffect(() => {
    if (settings) {
      if (typeof settings.exchangeRateUSDToGHS === 'number' && settings.exchangeRateUSDToGHS > 0) {
        setRateInput(settings.exchangeRateUSDToGHS);
      }
      setSettingsForm((prev) => ({ ...prev, ...settings }));
    }
  }, [settings]);

  // Notifications Popover
  const [showNotifications, setShowNotifications] = useState(false);

  // Password visibility in fulfillment
  const [showFulfillPass, setShowFulfillPass] = useState(false);

  // Helper to ensure fresh administrator session via secure HttpOnly cookie
  const ensureAdminToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/session', { credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Helper for authenticated Admin API requests (attaches CSRF protection header)
  const getAdminHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'x-admin-csrf': '1',
    };
  }, []);

  // Load all admin data
  const fetchAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = getAdminHeaders();
      const [ordRes, anaRes, gmRes, accRes, faqRes, logRes, notRes, invRes, payRes, emRes, diagRes] = await Promise.all([
        fetch('/api/admin/orders', { headers, credentials: 'include' }),
        fetch('/api/admin/analytics', { headers, credentials: 'include' }),
        fetch('/api/games?admin=true', { headers, credentials: 'include' }),
        fetch('/api/account-types', { credentials: 'include' }),
        fetch('/api/faqs', { credentials: 'include' }),
        fetch('/api/admin/audit-logs', { headers, credentials: 'include' }),
        fetch('/api/admin/notifications', { headers, credentials: 'include' }),
        fetch('/api/inventory', { headers, credentials: 'include' }),
        fetch('/api/payment/status', { credentials: 'include' }),
        fetch('/api/admin/notifications/email-config', { headers, credentials: 'include' }),
        fetch('/api/admin/notifications/email-diagnostics', { headers, credentials: 'include' }).catch(() => null),
      ]);

      if (ordRes.ok) setOrders(await ordRes.json());
      if (anaRes.ok) setAnalytics(await anaRes.json());
      if (gmRes.ok) setGamesList(await gmRes.json());
      if (accRes.ok) setAccountTypesList(await accRes.json());
      if (faqRes.ok) setFaqsList(await faqRes.json());
      if (logRes.ok) setAuditLogs(await logRes.json());
      if (notRes.ok) setNotifications(await notRes.json());
      if (invRes.ok) setInventoryList(await invRes.json());
      if (payRes.ok) setPaymentGatewayStatus(await payRes.json());
      if (emRes.ok) setEmailConfigStatus(await emRes.json());
      if (diagRes && diagRes.ok) {
        const diagData = await diagRes.json();
        if (diagData?.verification) setSmtpDiagnostics(diagData.verification);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAdminHeaders]);

  useEffect(() => {
    if (isAdminLoggedIn) {
      ensureAdminToken().finally(() => {
        fetchAdminData();
      });
      const unsubOrders = subscribeToOrders((liveOrders) => {
        if (Array.isArray(liveOrders)) {
          setOrders(liveOrders);
        }
      });
      const unsubNotifs = subscribeToNotifications((liveNotifs) => {
        if (Array.isArray(liveNotifs)) {
          setNotifications(liveNotifs);
        }
      });
      return () => {
        unsubOrders();
        unsubNotifs();
      };
    }
  }, [isAdminLoggedIn, fetchAdminData, ensureAdminToken]);

  useEffect(() => {
    setRateInput(settings.exchangeRateUSDToGHS);
    setSettingsForm({ ...settings });
  }, [settings]);

  if (!isStandalone && activeModal !== 'admin') return null;

  // Google Sign-In Handler
  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Exchange with backend for secure HttpOnly cookie session
        const loginRes = await fetch('/api/admin/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: result.user.email }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.success) {
          setAdminLoggedIn(true, loginData.adminUser || result.user.displayName || result.user.email || 'Store Owner');
        } else {
          setLoginError(loginData.error || 'Google account not authorized for administration.');
        }
      }
    } catch (err: any) {
      console.warn('Google sign-in:', err);
      setLoginError(err.message || 'Google sign-in failed');
    }
  };

  // Login handler (exchanges admin passcode for verified admin session)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const passcode = adminKeyInput.trim();
      const loginRes = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.error || 'Invalid Administrator Passcode');
      }
      setAdminLoggedIn(true, loginData.adminUser || 'Store Administrator');
    } catch (err: any) {
      setLoginError(err.message || 'Invalid Administrator Passcode. (Try: admin)');
    }
  };

  // Order Fulfillment
  const handleVerifyPaystack = async (orderToVerify: Order) => {
    setIsReconciling(true);
    setFulfillmentError('');
    setFulfillmentSuccess('');

    try {
      const res = await fetch(`/api/admin/orders/${orderToVerify.id}/reconcile-paystack`, {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFulfillmentSuccess(data.message || `✓ Payment Verified with Paystack! Status: PAID — AWAITING FULFILLMENT.`);
        await Promise.all([fetchAdminData(), refreshStoreData()]);
        if (data.order) {
          setSelectedOrder(data.order);
        }
      } else {
        const errorMsg = data.error || data.message || 'Payment could not be verified by Paystack.';
        setFulfillmentError(`Paystack Verification: ${errorMsg}`);
      }
    } catch (err: any) {
      setFulfillmentError(err.message || 'Network error verifying transaction with Paystack.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleStartProcessing = async (orderId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: 'PROCESSING', adminUser: 'Administrator' }),
      });
      if (res.ok) {
        await fetchAdminData();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, orderStatus: 'PROCESSING' } : null));
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update order status');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFulfillSubmit = async (
    e?: React.FormEvent,
    bypassEmail = false,
    overrideConflict = false
  ) => {
    if (e) e.preventDefault();
    if (!selectedOrder) return;
    setFulfillmentError('');
    setFulfillmentSuccess('');

    if (!fulfillmentEmail.trim() || !fulfillmentPassword.trim()) {
      setFulfillmentError('Please provide account email/username and password.');
      return;
    }

    const useOverride = overrideConflict || forceAssignmentOverride;
    setIsFulfilling(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/fulfill`, {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          adminUser: 'Administrator',
          deliveryInformation: {
            accountEmail: fulfillmentEmail.trim(),
            accountPassword: fulfillmentPassword.trim(),
            setupInstructions:
              fulfillmentInstructions.trim() ||
              '1. Add user on console.\n2. Sign in with credentials.\n3. Enable Console Sharing & Offline Play.\n4. Download from Library.',
            backupCodes: fulfillmentBackupCodes.trim(),
            notes: fulfillmentNotes.trim(),
          },
          allowWithoutEmail: bypassEmail,
          allowOverride: useOverride,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFulfillmentSuccess(
          data.warning ||
            `Order #${selectedOrder.orderNumber} successfully fulfilled! Credentials email accepted for delivery to customer (${selectedOrder.customerEmail}). (Advise customer to check Inbox & Spam/Junk)`
        );
        setAllowFulfillBypass(false);
        setAssignmentConflictInfo(null);
        setForceAssignmentOverride(false);
        await Promise.all([fetchAdminData(), refreshStoreData()]);
        if (data.order) {
          setSelectedOrder(data.order);
        }
      } else {
        const errorMsg =
          data.error ||
          (data.details ? `${data.error} — ${data.details}` : 'Fulfillment failed. Please check inputs and retry.');
        setFulfillmentError(errorMsg);
        if (data.canOverride || data.isConflict || errorMsg.includes('Conflict')) {
          const match = errorMsg.match(/Order (PSG-\d+-\d+)/);
          setAssignmentConflictInfo({
            isConflict: true,
            message: errorMsg,
            conflictingOrderNumber: match ? match[1] : undefined,
          });
        }
        if (data.allowBypass) {
          setAllowFulfillBypass(true);
        }
      }
    } catch (err: any) {
      setFulfillmentError(err.message || 'Network error occurred during fulfillment.');
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleReleaseConflictingAccount = async (targetOrderNumber: string) => {
    setIsReleasingAccount(true);
    try {
      const res = await fetch(`/api/admin/orders/${targetOrderNumber}/release-account`, {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAssignmentConflictInfo(null);
        setFulfillmentError('');
        setFulfillmentSuccess(
          `✓ PSN Account was successfully released from Order ${targetOrderNumber}! The account is now unlocked. You can fulfill this order now.`
        );
        await fetchAdminData();
      } else {
        setFulfillmentError(data.error || 'Failed to release PSN account.');
      }
    } catch (err: any) {
      setFulfillmentError(err.message || 'Failed to release account.');
    } finally {
      setIsReleasingAccount(false);
    }
  };

  const handleResendDeliveryEmail = async (orderId: string) => {
    setIsResendingEmail(true);
    setFulfillmentError('');
    setFulfillmentSuccess('');

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resend-delivery-email`, {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFulfillmentSuccess(data.message || `Delivery email successfully resent to customer!`);
        await Promise.all([fetchAdminData(), refreshStoreData()]);
        if (data.order) {
          setSelectedOrder(data.order);
        }
      } else {
        setFulfillmentError(data.error || 'Failed to resend customer delivery email.');
      }
    } catch (err: any) {
      setFulfillmentError(err.message || 'Error communicating with server.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Exchange Rate update
  const handleSaveExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateInput <= 0) {
      alert('Exchange rate must be greater than 0');
      return;
    }
    setIsSavingRate(true);
    setRateSuccessMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          adminUser: 'Administrator',
          settings: {
            ...settings,
            exchangeRateUSDToGHS: Number(rateInput),
          },
        }),
      });
      if (res.ok) {
        await refreshStoreData();
        await fetchAdminData();
        setRateSuccessMessage(`Exchange rate successfully updated: $1.00 USD = GH₵ ${Number(rateInput).toFixed(2)}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update exchange rate');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRate(false);
    }
  };

  // Settings update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate YouTube URLs if tutorial section is active and URLs are present
    if (settingsForm.ps5TutorialUrl && settingsForm.ps5TutorialUrl.trim() && !isValidYouTubeUrl(settingsForm.ps5TutorialUrl)) {
      alert('PS5 Tutorial URL must be a valid YouTube link (e.g. https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID)');
      return;
    }
    if (settingsForm.ps4TutorialUrl && settingsForm.ps4TutorialUrl.trim() && !isValidYouTubeUrl(settingsForm.ps4TutorialUrl)) {
      alert('PS4 Tutorial URL must be a valid YouTube link (e.g. https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID)');
      return;
    }

    setIsSavingSettings(true);
    setSettingsSuccessMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          adminUser: 'Administrator',
          settings: settingsForm,
        }),
      });
      if (res.ok) {
        await refreshStoreData();
        await fetchAdminData();
        setSettingsSuccessMessage('Store settings successfully updated!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update store settings');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Trigger test purchase notification email (supports testing custom recipient addresses)
  const handleSendTestEmail = async (customRecipient?: string) => {
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const recipient = customRecipient || (customTestEmailRecipient.trim() ? customTestEmailRecipient.trim() : undefined);
      const res = await fetch('/api/admin/notifications/test-email', {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ recipient }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailResult({
          success: true,
          message: data.message || `Test email dispatched to ${data.recipient}!`,
          provider: data.provider,
        });
        fetchAdminData();
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || data.details || 'Failed to dispatch test notification.',
          provider: data.provider,
        });
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Network error triggering test email.',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Run live SMTP connection and authentication verification
  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const res = await fetch('/api/admin/notifications/email-diagnostics', {
        headers: getAdminHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.verification) setSmtpDiagnostics(data.verification);
        if (data?.configStatus) setEmailConfigStatus(data.configStatus);
      }
    } catch (err) {
      console.warn('Diagnostics run error:', err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  // Cover Image File Upload (Cloudinary + Admin Authentication)
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadCoverError('');
    setUploadCoverSuccess('');

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadCoverError('Invalid file type. Please upload a PNG, JPG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadCoverError('Image is too large. Max file size is 5MB.');
      return;
    }

    setIsUploadingCover(true);

    try {
      // 1. Ensure administrator session token is active and valid
      const adminToken = await ensureAdminToken();
      if (!adminToken) {
        setUploadCoverError('Your admin session has expired. Please log in again.');
        setAdminLoggedIn(false);
        setIsUploadingCover(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/admin/upload-cover', {
            method: 'POST',
            headers: getAdminHeaders(),
            credentials: 'include',
            body: JSON.stringify({
              imageBase64: base64Data,
              fileName: file.name,
              gameId: editingGame?.id,
              adminUser: 'Administrator',
            }),
          });

          if (res.status === 401) {
            setUploadCoverError('Your admin session has expired. Please log in again.');
            localStorage.removeItem('reygames_admin_token');
            setAdminLoggedIn(false);
            return;
          }

          const data = await res.json();
          if (res.ok && data.success) {
            const finalUrl = data.secureUrl || data.url;
            setEditingGame((prev) =>
              prev
                ? {
                    ...prev,
                    coverImage: finalUrl,
                    coverImageUrl: finalUrl,
                    cloudinaryPublicId: data.publicId,
                  }
                : null
            );
            setUploadCoverSuccess(`Cover image uploaded to Cloudinary successfully!`);
          } else {
            setUploadCoverError(data.error || 'Failed to upload cover image to Cloudinary.');
          }
        } catch (uploadErr: any) {
          setUploadCoverError(uploadErr.message || 'Error uploading image to server.');
        } finally {
          setIsUploadingCover(false);
        }
      };
      reader.onerror = () => {
        setUploadCoverError('Error reading selected image file.');
        setIsUploadingCover(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadCoverError(err.message || 'Unexpected error processing image.');
      setIsUploadingCover(false);
    }
  };

  // Game Save
  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame || !editingGame.title) return;

    try {
      const url = isNewGame ? '/api/games' : `/api/games/${editingGame.id}`;
      const method = isNewGame ? 'POST' : 'PUT';

      const gamePayload = {
        ...editingGame,
        coverImage: editingGame.coverImageUrl || editingGame.coverImage,
        coverImageUrl: editingGame.coverImageUrl || editingGame.coverImage,
      };

      const res = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          game: gamePayload,
          adminUser: 'Administrator',
        }),
      });

      if (res.status === 401) {
        alert('Your admin session has expired. Please log in again.');
        localStorage.removeItem('reygames_admin_token');
        setAdminLoggedIn(false);
        return;
      }

      if (res.ok) {
        setEditingGame(null);
        setIsNewGame(false);
        setGameActionSuccess(`Game "${editingGame.title}" successfully saved.`);
        await refreshStoreData();
        await fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Game order check helper
  const checkGameHasOrders = useCallback(
    (gameId: string, gameTitle: string) => {
      return orders.some(
        (o) =>
          o.gameId === gameId ||
          (Boolean(o.gameTitleSnapshot) && o.gameTitleSnapshot.trim().toLowerCase() === gameTitle.trim().toLowerCase())
      );
    },
    [orders]
  );

  // Game action confirm handler
  const handleConfirmGameAction = async () => {
    if (!gameActionModal) return;
    const { game, mode } = gameActionModal;
    setIsProcessingGameAction(true);
    setGameActionSuccess('');
    setGameActionError('');

    try {
      // 1. Ensure a fresh, validated admin authentication session
      await ensureAdminToken();
      const headers = getAdminHeaders();

      let res: Response;

      if (mode === 'deactivate') {
        res = await fetch(`/api/games/${game.id}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            game: { ...game, isActive: false },
            adminUser: 'Administrator',
          }),
        });
      } else if (mode === 'reactivate') {
        res = await fetch(`/api/games/${game.id}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            game: { ...game, isActive: true, isArchived: false },
            adminUser: 'Administrator',
          }),
        });
      } else if (mode === 'restore') {
        res = await fetch(`/api/games/${game.id}/restore`, {
          method: 'PUT',
          headers,
          credentials: 'include',
        });
      } else if (mode === 'permanent_delete') {
        res = await fetch(`/api/games/${game.id}?permanent=true`, {
          method: 'DELETE',
          headers,
          credentials: 'include',
        });
      } else {
        // mode === 'delete' or 'archive' (safe archiving)
        res = await fetch(`/api/games/${game.id}`, {
          method: 'DELETE',
          headers,
          credentials: 'include',
        });
      }

      const resData = await res.json().catch(() => ({}));

      if (res.ok && (resData.success !== false)) {
        if (mode === 'restore' || mode === 'reactivate') {
          setGameActionSuccess(`"${game.title}" restored and reactivated in public storefront catalog.`);
        } else if (mode === 'deactivate') {
          setGameActionSuccess(`"${game.title}" deactivated and hidden from public storefront.`);
        } else if (mode === 'permanent_delete') {
          setGameActionSuccess(`"${game.title}" permanently removed.`);
        } else {
          setGameActionSuccess(
            resData.message || `"${game.title}" safely archived. Historical order records preserved.`
          );
        }
        setGameActionModal(null);
        await Promise.all([refreshStoreData(), fetchAdminData()]);
      } else {
        const errorMsg = resData.error || `Server responded with status ${res.status}`;
        setGameActionError(errorMsg);
      }
    } catch (err: any) {
      console.error('Game action error:', err);
      setGameActionError(err.message || 'An unexpected error occurred while communicating with the server.');
    } finally {
      setIsProcessingGameAction(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== 'ALL' && o.orderStatus !== orderStatusFilter && o.paymentStatus !== orderStatusFilter) {
      return false;
    }
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.gameTitleSnapshot.toLowerCase().includes(q) ||
        o.paystackReference.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleMarkAllNotificationsRead = async () => {
    try {
      const res = await fetch('/api/admin/notifications/read-all', {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (n: AdminNotification) => {
    if (!n.read) {
      try {
        await fetch(`/api/admin/notifications/${n.id}/read`, {
          method: 'POST',
          headers: getAdminHeaders(),
          credentials: 'include',
        });
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      } catch (err) {
        console.error(err);
      }
    }
    if (n.orderId) {
      setActiveTab('orders');
      const ord = orders.find((o) => o.id === n.orderId || o.orderNumber === n.orderId);
      if (ord) {
        setSelectedOrder(ord);
        setFulfillmentEmail('');
        setFulfillmentPassword('');
        setFulfillmentInstructions('');
        setFulfillmentBackupCodes('');
        setFulfillmentNotes('');
        setFulfillmentError('');
        setFulfillmentSuccess('');
      }
      setShowNotifications(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchAdminData(), refreshStoreData()]);
  };

  const handleLogout = async () => {
    await adminLogout();
  };

  return (
    <div
      className={
        isStandalone
          ? 'min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white'
          : 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-hidden text-xs'
      }
    >
      <div
        className={
          isStandalone
            ? 'w-full flex-1 flex flex-col overflow-hidden text-xs'
            : 'relative w-full max-w-6xl h-[94vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200'
        }
      >
        
        {/* Top Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                {settings.storeName} — Admin Management Console
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Dashboard
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage games, prices, exchange rate, and fulfill customer orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminLoggedIn && (
              <>
                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 relative cursor-pointer"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifs > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {unreadNotifs}
                      </span>
                    )}
                  </button>

                  {/* Popover */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-30 p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-white text-xs">Notifications</span>
                        <div className="flex items-center gap-2">
                          {unreadNotifs > 0 && (
                            <button
                              onClick={handleMarkAllNotificationsRead}
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                            >
                              Mark all read
                            </button>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">{notifications.length} alerts</span>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1.5">
                        {notifications.length === 0 ? (
                          <div className="text-center py-4 text-slate-500 text-xs">No alerts yet</div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-2.5 rounded-lg border text-[11px] space-y-1 cursor-pointer transition-colors ${
                                !n.read
                                  ? 'bg-blue-950/40 border-blue-800/60 hover:bg-blue-900/40'
                                  : 'bg-slate-900 border-slate-800/80 hover:bg-slate-850'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`font-semibold ${!n.read ? 'text-blue-300' : 'text-slate-200'}`}>
                                  {n.title}
                                </span>
                                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
                              </div>
                              <div className="text-slate-400 text-[10px] line-clamp-2">{n.message}</div>
                              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono pt-1">
                                <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                                {n.orderId && <span className="text-blue-400 hover:underline">View Order →</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                  title="Sign out of Administrator Console"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </>
            )}

            {isStandalone ? (
              <a
                href="/"
                className="text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1.5 text-xs transition border border-slate-800 ml-1"
                title="View Public Storefront"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Storefront</span>
              </a>
            ) : (
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Auth Gate if not logged in */}
        {!isAdminLoggedIn ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Administrator Access</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Enter your administrator passcode to access store controls.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Sign in with Google (Store Owner)</span>
              </button>

              <div className="relative flex items-center justify-center">
                <span className="h-px bg-slate-800 w-full" />
                <span className="px-2 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900 shrink-0">
                  Or use Passcode
                </span>
                <span className="h-px bg-slate-800 w-full" />
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="password"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="Enter Passcode (e.g. admin)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-center text-sm font-mono focus:outline-none focus:border-amber-500"
                />

                {loginError && (
                  <div className="text-red-400 bg-red-500/10 p-2 rounded-lg text-xs">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Sign In to Admin Dashboard
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Logged In Admin Interface with Nav & Sub-screens */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-56 bg-slate-950/80 border-r border-slate-800 p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto shrink-0">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'orders'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Orders</span>
                </span>
                {orders.filter((o) => o.orderStatus === 'AWAITING_FULFILLMENT').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                    {orders.filter((o) => o.orderStatus === 'AWAITING_FULFILLMENT').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('games')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'games'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Games Catalog</span>
              </button>

              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'inventory'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  <span>Inventory Pool</span>
                </span>
                {inventoryList.filter((i) => i.status === 'available').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                    {inventoryList.filter((i) => i.status === 'available').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('exchange')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'exchange'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Currency & Rate</span>
              </button>

              <button
                onClick={() => setActiveTab('accounts')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'accounts'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Account Types</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Site Settings</span>
              </button>

              <button
                onClick={() => setActiveTab('faqs')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'faqs'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>FAQ Editor</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold transition-all shrink-0 ${
                  activeTab === 'logs'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Audit Trail</span>
              </button>
            </div>

            {/* Main Content Pane */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-900">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Store Analytics & Revenue</h3>
                      <p className="text-slate-400 text-xs">
                        Real-time breakdown of Ghana Paystack collections and USD catalog valuation.
                      </p>
                    </div>
                  </div>

                  {/* Revenue Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                        Today's Revenue
                      </div>
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        GH₵ {(analytics?.today?.revenueGHS || 0).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Catalog: ${(analytics?.today?.catalogUSD || 0).toFixed(2)} USD • {analytics?.today?.ordersCount || 0} orders
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                        This Week's Revenue
                      </div>
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        GH₵ {(analytics?.week?.revenueGHS || 0).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Catalog: ${(analytics?.week?.catalogUSD || 0).toFixed(2)} USD • {analytics?.week?.ordersCount || 0} orders
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                        Awaiting Fulfillment
                      </div>
                      <div className="text-xl font-black text-amber-400 font-mono">
                        {analytics?.statusCounts?.awaitingFulfillment || 0}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Paid orders waiting for account credentials
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                        Total Lifetime Revenue
                      </div>
                      <div className="text-xl font-black text-blue-400 font-mono">
                        GH₵ {(analytics?.lifetime?.totalRevenueGHS || 0).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Catalog: ${(analytics?.lifetime?.totalCatalogUSD || 0).toFixed(2)} USD • {analytics?.lifetime?.ordersCount || 0} paid
                      </div>
                    </div>
                  </div>

                  {/* Inventory Status Banner */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">PSN Credential Inventory Pool</div>
                        <div className="text-[11px] text-slate-400">
                          {inventoryList.filter((i) => i.status === 'available').length} available in stock •{' '}
                          {inventoryList.filter((i) => i.status === 'reserved').length} reserved for checkout •{' '}
                          {inventoryList.filter((i) => i.status === 'delivered').length} delivered
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {inventoryList.filter((i) => i.status === 'available').length < 3 && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Low Stock
                        </span>
                      )}
                      <button
                        onClick={() => setActiveTab('inventory')}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-700 text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Manage Inventory Pool →
                      </button>
                    </div>
                  </div>

                  {/* Active Orders Queue */}
                  <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                        Recent Orders Queue
                      </h4>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
                      >
                        View All Orders →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="pb-2">Order #</th>
                            <th className="pb-2">Customer</th>
                            <th className="pb-2">Game & Console</th>
                            <th className="pb-2">Account Type</th>
                            <th className="pb-2">Amount (GHS)</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {orders.slice(0, 6).map((ord) => (
                            <tr key={ord.id} className="hover:bg-slate-900/50">
                              <td className="py-2.5 font-mono text-blue-400 font-bold">
                                {ord.orderNumber}
                              </td>
                              <td className="py-2.5 text-slate-300">
                                <div>{ord.customerName}</div>
                                <div className="text-slate-500 text-[10px]">{ord.customerPhone}</div>
                              </td>
                              <td className="py-2.5 text-white">
                                {ord.gameTitleSnapshot} ({ord.console})
                              </td>
                              <td className="py-2.5 text-slate-400">{ord.accountTypeSnapshot}</td>
                              <td className="py-2.5 font-mono font-bold">
                                <span className={ord.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-slate-400'}>
                                  GH₵ {ord.amountGHS.toFixed(2)}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    ord.orderStatus === 'FULFILLED'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : ord.orderStatus === 'AWAITING_FULFILLMENT'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : ord.paymentStatus === 'PAID'
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {ord.paymentStatus === 'PAID'
                                    ? (ord.orderStatus === 'AWAITING_FULFILLMENT'
                                        ? 'PAID — ACCOUNT REQUIRED'
                                        : ord.orderStatus.replace(/_/g, ' '))
                                    : 'PENDING PAYMENT'}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedOrder(ord);
                                    setActiveTab('orders');
                                  }}
                                  className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2.5 py-1 rounded text-[10px] font-semibold"
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ORDERS MANAGEMENT & FULFILLMENT */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white">Order Fulfillment & Management</h3>
                      <p className="text-slate-400 text-xs">
                        Inspect paid orders, prepare credentials, and deliver setup instructions to customer tracking pages.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          placeholder="Search order #, customer, phone..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
                        />
                      </div>

                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-semibold"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="AWAITING_FULFILLMENT">Awaiting Fulfillment</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="DELIVERY_FAILED">Delivery Failed</option>
                        <option value="FULFILLED">Fulfilled</option>
                        <option value="PENDING_PAYMENT">Pending Payment</option>
                      </select>
                    </div>
                  </div>

                  {/* Order Details & Fulfillment Drawer/Modal */}
                  {selectedOrder && (
                    <div className="bg-slate-950 border-2 border-blue-500/50 rounded-2xl p-5 space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-xs font-bold text-blue-400 font-mono">
                            {selectedOrder.orderNumber}
                          </span>
                          <h4 className="text-base font-black text-white">
                            {selectedOrder.gameTitleSnapshot} ({selectedOrder.console} • {selectedOrder.accountTypeSnapshot})
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(null)}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                        <div>
                          <div className="text-slate-400 text-[10px] uppercase flex items-center justify-between">
                            <span>Customer</span>
                            {selectedOrder.isGoogleAccount ? (
                              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">
                                Google User
                              </span>
                            ) : (
                              <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                Guest
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-white text-xs">{selectedOrder.customerName}</div>
                          <div className="text-slate-400 text-[11px]">{selectedOrder.customerEmail}</div>
                          <div className="text-emerald-400 font-mono text-[11px]">{selectedOrder.customerPhone}</div>
                        </div>

                        <div>
                          <div className="text-slate-400 text-[10px] uppercase">Financials</div>
                          <div className="text-slate-200">
                            Price: {formatUSD(selectedOrder.originalPriceUSD ?? selectedOrder.priceUSD)} USD
                          </div>
                          {selectedOrder.discountStatus === 'APPLIED' && (
                            <div className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              <span>Google 1st-Order: -{formatUSD(selectedOrder.discountUSD ?? 1.0)}</span>
                            </div>
                          )}
                          <div className="text-slate-400">Rate: $1 = GH₵ {selectedOrder.exchangeRate.toFixed(2)}</div>
                          {selectedOrder.paymentStatus === 'PAID' ? (
                            <div className="font-mono text-emerald-400 font-bold">Amount Paid: GH₵ {selectedOrder.amountGHS.toFixed(2)}</div>
                          ) : (
                            <div className="font-mono text-amber-400 font-bold">Amount Due: GH₵ {selectedOrder.amountGHS.toFixed(2)}</div>
                          )}
                        </div>

                        <div>
                          <div className="text-slate-400 text-[10px] uppercase">Status & Paystack</div>
                          <div className={`font-semibold ${selectedOrder.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {selectedOrder.paymentStatus === 'PAID'
                              ? (selectedOrder.orderStatus === 'AWAITING_FULFILLMENT'
                                  ? 'PAID — AWAITING FULFILLMENT'
                                  : selectedOrder.orderStatus.replace(/_/g, ' '))
                              : 'PENDING PAYMENT'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 truncate" title={selectedOrder.paystackReference}>
                            Ref: {selectedOrder.paystackReference}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(selectedOrder.createdAt).toLocaleString()}
                          </div>

                          {selectedOrder.paymentStatus !== 'PAID' && selectedOrder.paystackReference && (
                            <button
                              type="button"
                              onClick={() => handleVerifyPaystack(selectedOrder)}
                              disabled={isReconciling}
                              className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                              <span>{isReconciling ? 'Checking Paystack...' : 'Verify Payment with Paystack'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Fulfillment Action Form or Fulfilled / Reserved Credentials View */}
                      {selectedOrder.orderStatus !== 'FULFILLED' && selectedOrder.orderStatus !== 'DELIVERY_FAILED' ? (
                        <form onSubmit={handleFulfillSubmit} className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                          {selectedOrder.paymentStatus !== 'PAID' && (
                            <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <strong>Fulfillment Locked: Payment Status is PENDING PAYMENT</strong>
                                <p className="text-[11px] text-slate-300">
                                  Credentials cannot be fulfilled to the customer until payment is verified by Paystack.
                                  {selectedOrder.paystackReference ? (
                                    <> Click the <strong>"Verify Payment with Paystack"</strong> button above to check Paystack and confirm this order.</>
                                  ) : (
                                    <> Waiting for customer to complete checkout.</>
                                  )}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs flex items-center gap-1.5">
                              <KeyRound className="w-4 h-4 text-emerald-400" />
                              Prepare & Fulfill Account Credentials
                            </span>

                            {selectedOrder.orderStatus === 'AWAITING_FULFILLMENT' && (
                              <button
                                type="button"
                                onClick={() => handleStartProcessing(selectedOrder.id)}
                                disabled={isProcessing}
                                className="bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              >
                                {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
                                Mark As Processing
                              </button>
                            )}
                          </div>

                          {/* Matching inventory suggestion (handles both exclusive and shared accounts) */}
                          {(() => {
                            const matchingInv = inventoryList.find(
                              (inv) =>
                                (inv.status === 'available' ||
                                  inv.assignedOrderId === selectedOrder.id ||
                                  (inv.usageMode === 'shared' && (inv.assignments?.length || 0) < (inv.maxAssignments || 2))) &&
                                inv.gameId === selectedOrder.gameId &&
                                inv.console === selectedOrder.console &&
                                inv.accountTypeId === selectedOrder.accountTypeId
                            );
                            if (matchingInv) {
                              const isShared = matchingInv.usageMode === 'shared';
                              const activeCount = matchingInv.assignments?.length || 0;
                              const capacity = matchingInv.maxAssignments || 2;
                              return (
                                <div className="bg-blue-950/40 border border-blue-800/60 p-2.5 rounded-lg flex items-center justify-between">
                                  <div className="text-[11px] text-blue-200">
                                    <strong className="text-white">Matching Inventory Available:</strong>{' '}
                                    <span className="font-mono text-blue-300">{matchingInv.accountEmail}</span>
                                    {isShared && (
                                      <span className="ml-2 text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                        Shared Account ({activeCount} / {capacity} slots filled)
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFulfillmentEmail(matchingInv.accountEmail);
                                      setFulfillmentPassword(matchingInv.accountPassword);
                                      if (matchingInv.backupCodes) setFulfillmentBackupCodes(matchingInv.backupCodes);
                                      if (matchingInv.notes || matchingInv.additionalNotes) {
                                        setFulfillmentNotes(matchingInv.notes || matchingInv.additionalNotes || '');
                                      }
                                    }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer"
                                  >
                                    Autofill
                                  </button>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Account Assignment Conflict Resolution Banner */}
                          {(assignmentConflictInfo?.isConflict || fulfillmentError.includes('Conflict')) && (
                            <div className="bg-amber-950/40 border border-amber-500/50 p-3 rounded-xl space-y-2.5">
                              <div className="flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs">
                                  <div className="font-bold text-amber-200">
                                    PSN Account Assignment Conflict Detected
                                  </div>
                                  <div className="text-slate-300 leading-relaxed text-[11px]">
                                    {assignmentConflictInfo?.message || fulfillmentError}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-amber-900/40 flex flex-wrap items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-[11px] text-amber-200 font-medium cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={forceAssignmentOverride}
                                    onChange={(e) => setForceAssignmentOverride(e.target.checked)}
                                    className="rounded border-amber-500/50 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                  />
                                  <span>Admin Override: I confirm credentials are reset/verified for this account</span>
                                </label>

                                <div className="flex items-center gap-2">
                                  {assignmentConflictInfo?.conflictingOrderNumber && (
                                    <button
                                      type="button"
                                      disabled={isReleasingAccount}
                                      onClick={() => handleReleaseConflictingAccount(assignmentConflictInfo.conflictingOrderNumber!)}
                                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors"
                                    >
                                      {isReleasingAccount ? 'Releasing...' : `Release from Order ${assignmentConflictInfo.conflictingOrderNumber}`}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleFulfillSubmit(undefined, false, true)}
                                    disabled={isFulfilling}
                                    className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors shadow"
                                  >
                                    Authorize Override & Fulfill
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {fulfillmentError && !assignmentConflictInfo?.isConflict && !fulfillmentError.includes('Conflict') && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-lg text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{fulfillmentError}</span>
                            </div>
                          )}

                          {fulfillmentSuccess && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2.5 rounded-lg text-xs flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>{fulfillmentSuccess}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-slate-300 font-medium block mb-1">
                                PSN Account Email / Username <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                value={fulfillmentEmail}
                                onChange={(e) => setFulfillmentEmail(e.target.value)}
                                placeholder="e.g. ps5.ea26.slot1@vaultgh.com"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="text-slate-300 font-medium block mb-1">
                                Account Password <span className="text-red-400">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type={showFulfillPass ? 'text' : 'password'}
                                  required
                                  value={fulfillmentPassword}
                                  onChange={(e) => setFulfillmentPassword(e.target.value)}
                                  placeholder="Password for customer login"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs pr-8 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowFulfillPass(!showFulfillPass)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                >
                                  {showFulfillPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-slate-300 font-medium block mb-1">
                              Setup Instructions
                            </label>
                            <textarea
                              rows={3}
                              value={fulfillmentInstructions}
                              onChange={(e) => setFulfillmentInstructions(e.target.value)}
                              placeholder="1. Create user on console. 2. Login with credentials. 3. Activate Primary / Console Sharing..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-slate-300 font-medium block mb-1">
                                Backup 2FA Codes (Optional)
                              </label>
                              <input
                                type="text"
                                value={fulfillmentBackupCodes}
                                onChange={(e) => setFulfillmentBackupCodes(e.target.value)}
                                placeholder="e.g. 4819-2091, 5519-2041"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-slate-300 font-medium block mb-1">
                                Internal Notes (Admin-Only • Never sent to customer)
                              </label>
                              <input
                                type="text"
                                value={fulfillmentNotes}
                                onChange={(e) => setFulfillmentNotes(e.target.value)}
                                placeholder="e.g. Verified license active on slot 1"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          {emailConfigStatus && !emailConfigStatus.isConfigured && (
                            <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg text-[11px] text-amber-200 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <strong>Email Delivery Not Configured:</strong> No email credentials (e.g. Gmail App Password or Resend Key) have been set up in environment variables yet.
                                You can configure email delivery in Settings, or fulfill now to save credentials directly to the customer's portal.
                              </div>
                            </div>
                          )}

                          <div className="bg-slate-900 border border-blue-500/40 p-3.5 rounded-xl text-xs space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" />
                                <span>DELIVER TO:</span>
                              </div>
                              {emailConfigStatus?.isConfigured && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded border border-emerald-500/30">
                                  Provider: {emailConfigStatus.activeProvider}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-200">
                              <div>Customer: <strong className="text-white">{selectedOrder.customerName}</strong></div>
                              <div>Email: <strong className="text-blue-300 font-mono">{selectedOrder.customerEmail}</strong></div>
                            </div>
                            <div className="text-[11px] text-amber-300/90 pt-1.5 border-t border-slate-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Credentials will be emailed to: <strong className="text-white font-mono">{selectedOrder.customerEmail}</strong></span>
                            </div>
                          </div>

                          {allowFulfillBypass && (
                            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl space-y-2">
                              <div className="text-xs text-red-300 font-semibold flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" />
                                Customer delivery email could not be sent
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                You can fulfill this order now without sending an email. Credentials will be securely saved into the customer's order history and account portal. You can resend the delivery email at any time.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleFulfillSubmit(undefined, true)}
                                disabled={isFulfilling}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow disabled:opacity-50"
                              >
                                {isFulfilling ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving to Customer Account...</span>
                                  </>
                                ) : (
                                  <>
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>Fulfill Anyway (Save to Customer Account)</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={isFulfilling || selectedOrder.paymentStatus !== 'PAID'}
                              title={selectedOrder.paymentStatus !== 'PAID' ? 'Cannot fulfill order: Payment is PENDING_PAYMENT' : undefined}
                              className={`font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-2 shadow ${
                                selectedOrder.paymentStatus === 'PAID'
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              } disabled:opacity-50`}
                            >
                              {isFulfilling ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Delivering Email & Fulfilling Order...</span>
                                </>
                              ) : (
                                <>
                                  <SendHorizontal className="w-4 h-4" />
                                  <span>Send to Customer & Mark as Fulfilled</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className={`p-4 rounded-xl space-y-3 ${
                          selectedOrder.orderStatus === 'DELIVERY_FAILED'
                            ? 'bg-rose-950/20 border border-rose-500/40'
                            : 'bg-emerald-950/20 border border-emerald-500/30'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-2 font-bold text-xs ${
                              selectedOrder.orderStatus === 'DELIVERY_FAILED' ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {selectedOrder.orderStatus === 'DELIVERY_FAILED' ? (
                                <>
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span>Account Reserved & Assigned — Delivery Email Pending (Retry Available)</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  <span>Order is Fulfilled — Credentials Active</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {selectedOrder.orderStatus === 'DELIVERY_FAILED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedOrder.deliveryInformation) {
                                      setFulfillmentEmail(selectedOrder.deliveryInformation.accountEmail);
                                      setFulfillmentPassword(selectedOrder.deliveryInformation.accountPassword);
                                      setFulfillmentBackupCodes(selectedOrder.deliveryInformation.backupCodes || '');
                                      setFulfillmentNotes(selectedOrder.deliveryInformation.notes || '');
                                      setFulfillmentInstructions(selectedOrder.deliveryInformation.setupInstructions || '');
                                    }
                                    setSelectedOrder({ ...selectedOrder, orderStatus: 'PROCESSING' });
                                  }}
                                  className="text-[11px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                                >
                                  Re-edit Credentials
                                </button>
                              )}
                              <div className="text-[10px] text-slate-400 font-mono">
                                Fulfilled at:{' '}
                                {selectedOrder.deliveryInformation?.fulfilledAt
                                  ? new Date(selectedOrder.deliveryInformation.fulfilledAt).toLocaleString()
                                  : 'Completed'}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase text-slate-400 font-bold">Delivered PSN Account</span>
                                {selectedOrder.deliveryInformation?.isReleased ? (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    Released / Unlocked
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleReleaseConflictingAccount(selectedOrder.orderNumber)}
                                    disabled={isReleasingAccount}
                                    className="text-[10px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                                  >
                                    {isReleasingAccount ? 'Releasing...' : 'Release Account'}
                                  </button>
                                )}
                              </div>
                              <div className="font-mono text-emerald-300 font-bold text-xs select-all">
                                {selectedOrder.deliveryInformation?.accountEmail}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-slate-400 font-bold">Password</div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-white text-xs select-all">
                                  {showFulfillPass
                                    ? selectedOrder.deliveryInformation?.accountPassword
                                    : '••••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowFulfillPass(!showFulfillPass)}
                                  className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                  {showFulfillPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {selectedOrder.deliveryInformation?.setupInstructions && (
                            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                              <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">
                                Setup Instructions Provided:
                              </div>
                              <pre className="font-sans whitespace-pre-wrap text-slate-300">
                                {selectedOrder.deliveryInformation.setupInstructions}
                              </pre>
                            </div>
                          )}

                          {/* Customer Email Delivery Status & Retry / Resend Action */}
                          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-400" />
                                <span className="font-bold text-white text-xs">Customer Email Delivery Status:</span>
                                {(() => {
                                  const status = selectedOrder.deliveryEmailStatus || selectedOrder.deliveryInformation?.deliveryEmailStatus || 'PENDING';
                                  if (status === 'SENT' || status === 'ACCEPTED') {
                                    return (
                                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        ✓ EMAIL ACCEPTED FOR DELIVERY
                                      </span>
                                    );
                                  } else if (status === 'DELIVERED') {
                                    return (
                                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        ✓ DELIVERED
                                      </span>
                                    );
                                  } else if (status === 'SENDING') {
                                    return (
                                      <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        SENDING...
                                      </span>
                                    );
                                  } else if (status === 'BOUNCED') {
                                    return (
                                      <span className="bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        EMAIL BOUNCED
                                      </span>
                                    );
                                  } else if (status === 'FAILED') {
                                    return (
                                      <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        DELIVERY FAILED
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        PENDING DISPATCH
                                      </span>
                                    );
                                  }
                                })()}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleResendDeliveryEmail(selectedOrder.id)}
                                disabled={isResendingEmail}
                                className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                              >
                                {isResendingEmail ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Sending Email...</span>
                                  </>
                                ) : (
                                  <>
                                    <SendHorizontal className="w-3.5 h-3.5" />
                                    <span>Resend Delivery Email</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                              <div>
                                Recipient: <span className="text-white font-mono">{selectedOrder.customerEmail}</span>
                              </div>
                              {selectedOrder.deliveryEmailSentAt && (
                                <div>
                                  Accepted At: <span className="text-slate-300">{new Date(selectedOrder.deliveryEmailSentAt).toLocaleString()}</span>
                                </div>
                              )}
                              {selectedOrder.deliveryEmailProvider && (
                                <div>
                                  Provider: <span className="text-blue-300 font-mono">{selectedOrder.deliveryEmailProvider}</span>
                                </div>
                              )}
                              {selectedOrder.deliveryEmailMessageId && (
                                <div>
                                  Message ID: <span className="text-slate-300 font-mono text-[10px]">{selectedOrder.deliveryEmailMessageId}</span>
                                </div>
                              )}
                              {selectedOrder.deliveryEmailAttempts && (
                                <div>
                                  Attempts: <span className="text-slate-300 font-mono">{selectedOrder.deliveryEmailAttempts}</span>
                                </div>
                              )}
                            </div>

                            <div className="p-2.5 bg-blue-950/25 border border-blue-900/40 rounded-lg text-[11px] text-blue-200/90 leading-relaxed">
                              ℹ️ <strong>Deliverability Note:</strong> SMTP provider accepted the recipient for delivery. Acceptance by the mail server confirms message transmission; whether it lands in the primary inbox or Spam/Junk/Promotions depends on the recipient's mail provider. Advise customer to check Spam/Junk if not immediately visible.
                            </div>

                            {selectedOrder.deliveryEmailError && (
                              <div className="bg-red-950/40 border border-red-900/60 p-2 rounded text-[11px] text-red-300 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span>Error: {selectedOrder.deliveryEmailError}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Orders Table */}
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                            <th className="p-3">Order Number</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Game & Console</th>
                            <th className="p-3">Account Type</th>
                            <th className="p-3">GHS Paid</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredOrders.map((ord) => (
                            <tr key={ord.id} className="hover:bg-slate-900/40">
                              <td className="p-3 font-mono font-bold text-blue-400">
                                {ord.orderNumber}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{ord.customerName}</span>
                                  {ord.isGoogleAccount && (
                                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-bold">
                                      Google
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px]">{ord.customerPhone}</div>
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-slate-200">{ord.gameTitleSnapshot}</span>
                                <span className="ml-1 text-[10px] text-blue-400 font-bold">[{ord.console}]</span>
                              </td>
                              <td className="p-3 text-slate-400">
                                {ord.accountTypeSnapshot}
                              </td>
                              <td className="p-3 font-mono font-bold">
                                <div className={ord.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-slate-400'}>
                                  GH₵ {ord.amountGHS.toFixed(2)}
                                </div>
                                {ord.discountStatus === 'APPLIED' && (
                                  <div className="text-[10px] text-emerald-400 font-sans font-semibold flex items-center gap-0.5">
                                    <Tag className="w-2.5 h-2.5" />
                                    <span>-$1 Promo</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="space-y-1">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      ord.orderStatus === 'FULFILLED'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : ord.orderStatus === 'AWAITING_FULFILLMENT'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : ord.paymentStatus === 'PAID'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : 'bg-slate-700 text-slate-300'
                                    }`}
                                  >
                                    {ord.paymentStatus === 'PAID'
                                      ? (ord.orderStatus === 'AWAITING_FULFILLMENT'
                                          ? 'PAID — ACCOUNT REQUIRED'
                                          : ord.orderStatus.replace(/_/g, ' '))
                                      : 'PENDING PAYMENT'}
                                  </span>

                                  {ord.orderStatus === 'FULFILLED' && (
                                    <div className="flex items-center gap-1 text-[10px]">
                                      {ord.deliveryEmailStatus === 'FAILED' ? (
                                        <span className="text-red-400 font-semibold flex items-center gap-0.5">
                                          <AlertCircle className="w-2.5 h-2.5" />
                                          Email Failed
                                        </span>
                                      ) : (
                                        <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                          <Mail className="w-2.5 h-2.5" />
                                          Email Sent
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => setSelectedOrder(ord)}
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Inspect & Fulfill
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GAMES CATALOG MANAGEMENT */}
              {activeTab === 'games' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Games Catalog Manager</h3>
                      <p className="text-slate-400 text-xs">
                        Create games, toggle PS4/PS5 availability, edit prices, and update cover images.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setIsNewGame(true);
                        setEditingGame({
                          id: '',
                          title: '',
                          slug: '',
                          coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
                          description: '',
                          genre: 'Action',
                          publisher: 'PlayStation',
                          ps4Available: true,
                          ps5Available: true,
                          isActive: true,
                          isFeatured: false,
                          sortOrder: gamesList.length + 1,
                          accountPrices: {
                            'primary-shared': 15.00,
                            'primary-non-sharing': 22.00,
                            'secondary': 11.00,
                            'full-private': 35.00,
                          },
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Game
                    </button>
                  </div>

                  {/* Editing or Adding Game Modal / Form */}
                  {editingGame && (
                    <form onSubmit={handleSaveGame} className="bg-slate-950 p-5 rounded-2xl border-2 border-blue-500/40 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="font-bold text-white text-sm">
                          {isNewGame ? 'Create New PlayStation Game' : `Edit: ${editingGame.title}`}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingGame(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-300 font-medium block mb-1">Game Title</label>
                          <input
                            type="text"
                            required
                            value={editingGame.title}
                            onChange={(e) => setEditingGame({ ...editingGame, title: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">Genre</label>
                          <input
                            type="text"
                            required
                            value={editingGame.genre}
                            onChange={(e) => setEditingGame({ ...editingGame, genre: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                          />
                        </div>
                      </div>

                      {/* Cover Image Upload & URL */}
                      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                        <label className="text-slate-300 font-medium block text-xs">Cover Image</label>
                        
                        <div className="flex flex-col sm:flex-row gap-3 items-start">
                          {/* Live Thumbnail Preview */}
                          <div className="w-20 h-24 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative">
                            {editingGame.coverImage ? (
                              <img
                                src={editingGame.coverImage}
                                alt="Cover preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
                                }}
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-slate-600" />
                            )}
                            {isUploadingCover && (
                              <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-2 w-full">
                            {/* File Upload Button */}
                            <div className="flex items-center gap-2">
                              <label className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors">
                                <Upload className="w-3.5 h-3.5" />
                                <span>{isUploadingCover ? 'Uploading...' : 'Upload Image File'}</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/webp"
                                  disabled={isUploadingCover}
                                  onChange={handleCoverUpload}
                                  className="hidden"
                                />
                              </label>
                              <span className="text-[10px] text-slate-400">PNG, JPG, or WEBP (Max 5MB)</span>
                            </div>

                            {uploadCoverSuccess && (
                              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>{uploadCoverSuccess}</span>
                              </div>
                            )}

                            {uploadCoverError && (
                              <div className="text-[11px] text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>{uploadCoverError}</span>
                              </div>
                            )}

                              {/* Direct URL input */}
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">Or paste direct image URL:</span>
                              <input
                                type="url"
                                required
                                value={editingGame.coverImage}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditingGame({ ...editingGame, coverImage: val, coverImageUrl: val });
                                }}
                                placeholder="https://res.cloudinary.com/... or https://..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={editingGame.description}
                          onChange={(e) => setEditingGame({ ...editingGame, description: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                        />
                      </div>

                      {/* Console and Feature Toggles */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 p-3 rounded-xl">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={editingGame.ps5Available}
                            onChange={(e) => setEditingGame({ ...editingGame, ps5Available: e.target.checked })}
                          />
                          <span>PS5 Available</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={editingGame.ps4Available}
                            onChange={(e) => setEditingGame({ ...editingGame, ps4Available: e.target.checked })}
                          />
                          <span>PS4 Available</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={editingGame.isFeatured}
                            onChange={(e) => setEditingGame({ ...editingGame, isFeatured: e.target.checked })}
                          />
                          <span>Featured Game</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={editingGame.isActive}
                            onChange={(e) => setEditingGame({ ...editingGame, isActive: e.target.checked })}
                          />
                          <span>Active in Catalog</span>
                        </label>
                      </div>

                      {/* Custom USD Prices per Account Type */}
                      <div className="space-y-2">
                        <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px] block">
                          Catalog Prices in USD ($)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Primary Shared ($)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={editingGame.accountPrices['primary-shared'] ?? 14}
                              onChange={(e) =>
                                setEditingGame({
                                  ...editingGame,
                                  accountPrices: {
                                    ...editingGame.accountPrices,
                                    'primary-shared': Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Primary Non-Sharing ($)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={editingGame.accountPrices['primary-non-sharing'] ?? 20}
                              onChange={(e) =>
                                setEditingGame({
                                  ...editingGame,
                                  accountPrices: {
                                    ...editingGame.accountPrices,
                                    'primary-non-sharing': Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Secondary ($)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={editingGame.accountPrices['secondary'] ?? 10}
                              onChange={(e) =>
                                setEditingGame({
                                  ...editingGame,
                                  accountPrices: {
                                    ...editingGame.accountPrices,
                                    secondary: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Full Private ($)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={editingGame.accountPrices['full-private'] ?? 35}
                              onChange={(e) =>
                                setEditingGame({
                                  ...editingGame,
                                  accountPrices: {
                                    ...editingGame.accountPrices,
                                    'full-private': Number(e.target.value),
                                  },
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingGame(null)}
                          className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl"
                        >
                          Save Game to Catalog
                        </button>
                      </div>
                    </form>
                  )}

                  {gameActionSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>{gameActionSuccess}</span>
                      </div>
                      <button
                        onClick={() => setGameActionSuccess('')}
                        className="text-emerald-400/60 hover:text-emerald-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Filter Pills for Game Catalog */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {(
                      [
                        { id: 'ALL', label: 'All Games', count: gamesList.length },
                        {
                          id: 'ACTIVE',
                          label: 'Active in Store',
                          count: gamesList.filter((g) => g.isActive !== false && !g.isArchived).length,
                        },
                        {
                          id: 'INACTIVE',
                          label: 'Inactive',
                          count: gamesList.filter((g) => !g.isActive && !g.isArchived).length,
                        },
                        {
                          id: 'ARCHIVED',
                          label: 'Archived',
                          count: gamesList.filter((g) => Boolean(g.isArchived)).length,
                        },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setGameCatalogFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                          gameCatalogFilter === f.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/80 font-mono">
                          {f.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Games Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {gamesList
                      .filter((g) => {
                        const isArchived = Boolean(g.isArchived);
                        const isActive = g.isActive !== false && !isArchived;
                        const isInactive = !g.isActive && !isArchived;
                        if (gameCatalogFilter === 'ACTIVE') return isActive;
                        if (gameCatalogFilter === 'INACTIVE') return isInactive;
                        if (gameCatalogFilter === 'ARCHIVED') return isArchived;
                        return true;
                      })
                      .map((g) => {
                        const isArchived = Boolean(g.isArchived);
                        const isActive = g.isActive !== false && !isArchived;
                        const orderCount = orders.filter(
                          (o) =>
                            o.gameId === g.id ||
                            (Boolean(o.gameTitleSnapshot) &&
                              o.gameTitleSnapshot.trim().toLowerCase() === g.title.trim().toLowerCase())
                        ).length;

                        return (
                          <div
                            key={g.id}
                            className={`bg-slate-950 p-3 rounded-xl border transition-all ${
                              isArchived
                                ? 'border-purple-500/40 bg-purple-950/10'
                                : isActive
                                ? 'border-slate-800 hover:border-slate-700'
                                : 'border-amber-500/30 opacity-75'
                            } flex gap-3`}
                          >
                            <img
                              src={g.coverImage}
                              alt={g.title}
                              className="w-16 h-20 object-cover rounded-lg shrink-0 border border-slate-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
                              }}
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="font-bold text-white text-xs truncate" title={g.title}>
                                  {g.title}
                                </h4>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    isArchived
                                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                      : isActive
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  {isArchived ? 'ARCHIVED' : isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-[10px]">
                                {g.ps5Available && <span className="text-blue-400 font-bold">PS5</span>}
                                {g.ps4Available && <span className="text-indigo-400 font-bold">PS4</span>}
                                <span className="text-slate-500">• {g.genre}</span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-emerald-400 font-bold">
                                  ${(g.accountPrices?.['primary-shared'] || 12).toFixed(2)} USD
                                </span>
                                {orderCount > 0 && (
                                  <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    {orderCount} {orderCount === 1 ? 'order' : 'orders'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                                <button
                                  onClick={() => {
                                    setIsNewGame(false);
                                    setEditingGame({ ...g });
                                  }}
                                  className="text-blue-400 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>

                                {isArchived ? (
                                  <>
                                    <button
                                      onClick={() => setGameActionModal({ game: g, mode: 'restore' })}
                                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[10px] cursor-pointer font-medium"
                                      title="Restore game to public storefront"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Restore
                                    </button>
                                    {orderCount === 0 && (
                                      <button
                                        onClick={() => setGameActionModal({ game: g, mode: 'permanent_delete' })}
                                        className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[10px] cursor-pointer ml-auto"
                                        title="Permanently remove from database (0 orders)"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() =>
                                        setGameActionModal({
                                          game: g,
                                          mode: isActive ? 'deactivate' : 'reactivate',
                                        })
                                      }
                                      className={`${
                                        isActive
                                          ? 'text-amber-400 hover:text-amber-300'
                                          : 'text-emerald-400 hover:text-emerald-300'
                                      } flex items-center gap-1 text-[10px] cursor-pointer`}
                                    >
                                      {isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                                      {isActive ? 'Deactivate' : 'Activate'}
                                    </button>

                                    <button
                                      onClick={() => setGameActionModal({ game: g, mode: 'delete' })}
                                      className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[10px] cursor-pointer ml-auto"
                                      title="Remove from storefront (safely archives if orders exist)"
                                    >
                                      <Archive className="w-3 h-3" /> Remove / Archive
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Game Action Confirmation Modal */}
              {gameActionModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          gameActionModal.mode === 'restore' || gameActionModal.mode === 'reactivate'
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}
                      >
                        {gameActionModal.mode === 'restore' ? (
                          <RotateCcw className="w-5 h-5" />
                        ) : gameActionModal.mode === 'reactivate' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm">
                          {gameActionModal.mode === 'delete'
                            ? 'Remove / Archive Game'
                            : gameActionModal.mode === 'restore'
                            ? 'Restore Game to Storefront'
                            : gameActionModal.mode === 'deactivate'
                            ? 'Deactivate Game'
                            : gameActionModal.mode === 'permanent_delete'
                            ? 'Permanently Delete Game'
                            : 'Reactivate Game'}
                        </h4>

                        {/* Game Target Info Card */}
                        <div className="mt-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                          <img
                            src={gameActionModal.game.coverImage}
                            alt={gameActionModal.game.title}
                            className="w-10 h-12 object-cover rounded-lg shrink-0 border border-slate-800"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white text-xs truncate">
                              {gameActionModal.game.title}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {gameActionModal.game.genre} •{' '}
                              {gameActionModal.game.ps5Available ? 'PS5' : ''}{' '}
                              {gameActionModal.game.ps4Available ? 'PS4' : ''}
                            </div>
                          </div>
                        </div>

                        {/* Explanatory details based on action mode and order history */}
                        <div className="mt-3 text-xs text-slate-300 space-y-2">
                          {gameActionModal.mode === 'delete' && (
                            <>
                              {checkGameHasOrders(gameActionModal.game.id, gameActionModal.game.title) ? (
                                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                                  <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                                    <Shield className="w-3.5 h-3.5 shrink-0" />
                                    <span>Historical customer orders exist</span>
                                  </div>
                                  <p className="text-[11px] leading-relaxed">
                                    To protect customer order histories, receipts, and fulfillment tracking, this game
                                    will be <strong>safely archived</strong> and immediately removed from the public
                                    storefront catalog. You can restore it at any time.
                                  </p>
                                </div>
                              ) : (
                                <p className="leading-relaxed text-slate-300">
                                  This game will be <strong>safely archived</strong> and removed from the public
                                  storefront catalog. All catalog data remains preserved in your Admin Portal, and you
                                  can restore it at any time.
                                </p>
                              )}
                            </>
                          )}

                          {gameActionModal.mode === 'restore' && (
                            <p className="leading-relaxed text-slate-300">
                              Restoring &ldquo;{gameActionModal.game.title}&rdquo; will immediately make it active and
                              visible in the public storefront for customers to browse and purchase.
                            </p>
                          )}

                          {gameActionModal.mode === 'deactivate' && (
                            <p className="leading-relaxed text-slate-300">
                              &ldquo;{gameActionModal.game.title}&rdquo; will be temporarily hidden from the public
                              storefront without archiving.
                            </p>
                          )}

                          {gameActionModal.mode === 'reactivate' && (
                            <p className="leading-relaxed text-slate-300">
                              &ldquo;{gameActionModal.game.title}&rdquo; will be reactivated and visible in the public
                              storefront catalog.
                            </p>
                          )}

                          {gameActionModal.mode === 'permanent_delete' && (
                            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200">
                              <p className="text-[11px] leading-relaxed">
                                <strong>Warning:</strong> This game has 0 historical customer orders and will be
                                permanently removed from the database. This action cannot be undone.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Error Alert Display inside Modal */}
                        {gameActionError && (
                          <div className="mt-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                            <span>{gameActionError}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        disabled={isProcessingGameAction}
                        onClick={() => {
                          setGameActionModal(null);
                          setGameActionError('');
                        }}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingGameAction}
                        onClick={handleConfirmGameAction}
                        className={`${
                          gameActionModal.mode === 'restore' || gameActionModal.mode === 'reactivate'
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-red-600 hover:bg-red-500'
                        } disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer`}
                      >
                        {isProcessingGameAction ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {gameActionModal.mode === 'delete'
                            ? 'Confirm Remove / Archive'
                            : gameActionModal.mode === 'restore'
                            ? 'Confirm Restore to Catalog'
                            : gameActionModal.mode === 'deactivate'
                            ? 'Confirm Deactivation'
                            : gameActionModal.mode === 'permanent_delete'
                            ? 'Confirm Permanent Delete'
                            : 'Confirm Reactivation'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: INVENTORY POOL */}
              {activeTab === 'inventory' && (
                <InventoryTab
                  inventoryList={inventoryList}
                  gamesList={gamesList}
                  accountTypesList={accountTypesList}
                  orders={orders}
                  getAdminHeaders={getAdminHeaders}
                  onRefresh={fetchAdminData}
                  onSelectOrder={(order) => {
                    setActiveTab('orders');
                    setSelectedOrder(order);
                  }}
                />
              )}

              {/* TAB 4: CURRENCY & EXCHANGE RATE */}
              {activeTab === 'exchange' && (
                <div className="max-w-xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white">Ghana Currency & Exchange Rate</h3>
                    <p className="text-slate-400 text-xs">
                      All catalog prices remain in USD ($). At Paystack checkout, payments are calculated using this exchange rate.
                    </p>
                  </div>

                  <form onSubmit={handleSaveExchangeRate} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    {rateSuccessMessage && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{rateSuccessMessage}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-slate-300 font-medium block">
                        USD to Ghana Cedi (GHS) Rate ($1 = GH₵)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">$1.00 USD =</span>
                        <input
                          type="number"
                          step="0.05"
                          min="1"
                          required
                          value={rateInput}
                          onChange={(e) => setRateInput(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-lg font-black text-emerald-400 font-mono focus:outline-none focus:border-blue-500 w-36"
                        />
                        <span className="text-base font-bold text-slate-300">GHS</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1">
                      <div className="text-slate-400 font-medium">Conversion Preview at Current Rate:</div>
                      <div className="flex justify-between text-slate-300">
                        <span>$15.00 game checkout:</span>
                        <strong className="text-emerald-400 font-mono">GH₵ {(15 * rateInput).toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>$20.00 game checkout:</span>
                        <strong className="text-emerald-400 font-mono">GH₵ {(20 * rateInput).toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>$40.00 game checkout:</span>
                        <strong className="text-emerald-400 font-mono">GH₵ {(40 * rateInput).toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      Last updated by: <strong>{settings.exchangeRateUpdatedBy}</strong> on{' '}
                      {new Date(settings.exchangeRateLastUpdated).toLocaleString()}
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingRate}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingRate && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{isSavingRate ? 'Updating Rate...' : 'Update Store Exchange Rate'}</span>
                    </button>
                  </form>

                  {/* Paystack Payment Gateway Integration Card */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-bold text-white text-sm">Paystack Gateway Configuration</h4>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          paymentGatewayStatus?.configured
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {paymentGatewayStatus?.configured
                          ? `ACTIVE (${paymentGatewayStatus.mode})`
                          : 'NOT CONFIGURED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Payment Provider</span>
                        <span className="font-bold text-white">Paystack</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Settlement Currency</span>
                        <span className="font-bold text-emerald-400 font-mono">GHS (Ghana Cedi)</span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Environment Mode</span>
                        <span className="font-bold text-blue-400 font-mono">
                          {paymentGatewayStatus?.mode || 'NOT_CONFIGURED'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {paymentGatewayStatus?.configured ? (
                        <>
                          Paystack is ready to process payments. All checkout amounts are locked in GHS and verified against Paystack receipts upon completion. Secret keys are kept safe on the backend.
                        </>
                      ) : (
                        <>
                          To accept real payments via Ghana MTN MoMo, Telecel Cash, and Cards, set{' '}
                          <code className="text-emerald-400 font-mono">PAYSTACK_SECRET_KEY</code> in your server environment settings.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 5: ACCOUNT TYPES */}
              {activeTab === 'accounts' && (
                <AccountTypesTab
                  accountTypesList={accountTypesList}
                  getAdminHeaders={getAdminHeaders}
                  onRefresh={fetchAdminData}
                  formatUSD={formatUSD}
                />
              )}

              {/* TAB 6: SITE SETTINGS */}
              {activeTab === 'settings' && (
                <div className="max-w-xl space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Store Information & Content</h3>
                    <p className="text-slate-400 text-xs">
                      Update store title, WhatsApp support number, announcements, and delivery messages without code.
                    </p>
                  </div>

                  <form onSubmit={handleSaveSettings} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    {settingsSuccessMessage && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{settingsSuccessMessage}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Store Name</label>
                        <input
                          type="text"
                          value={settingsForm.storeName || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Logo Text Brand</label>
                        <input
                          type="text"
                          value={settingsForm.logoText || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, logoText: e.target.value })}
                          placeholder="e.g. ReyGames"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Hero Banner Title</label>
                        <input
                          type="text"
                          value={settingsForm.bannerTitle || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, bannerTitle: e.target.value })}
                          placeholder="e.g. Instant PlayStation Games in Ghana"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Hero Banner Subtitle</label>
                        <input
                          type="text"
                          value={settingsForm.bannerSubtitle || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, bannerSubtitle: e.target.value })}
                          placeholder="Sub-headline under the hero title"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Support WhatsApp Number</label>
                        <input
                          type="text"
                          value={settingsForm.supportWhatsApp}
                          onChange={(e) => setSettingsForm({ ...settingsForm, supportWhatsApp: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Support Email</label>
                        <input
                          type="email"
                          value={settingsForm.supportEmail}
                          onChange={(e) => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Top Announcement Bar</label>
                      <input
                        type="text"
                        value={settingsForm.announcement}
                        onChange={(e) => setSettingsForm({ ...settingsForm, announcement: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Delivery Time Notice</label>
                      <textarea
                        rows={2}
                        value={settingsForm.deliveryMessage}
                        onChange={(e) => setSettingsForm({ ...settingsForm, deliveryMessage: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Footer Notice / Disclaimer</label>
                      <input
                        type="text"
                        value={settingsForm.footerText || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, footerText: e.target.value })}
                        placeholder="e.g. ReyGames Ghana — All PlayStation trademarks belong to Sony Interactive Entertainment Inc."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>

                    {/* TUTORIAL VIDEOS SETTINGS */}
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Video className="w-4 h-4 text-blue-400" />
                            <h4 className="text-sm font-bold text-white">Homepage Tutorial Videos</h4>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">
                            Manage the PS5 and PS4 setup tutorial videos displayed on the homepage.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settingsForm.showTutorialVideos !== false}
                            onChange={(e) => setSettingsForm({ ...settingsForm, showTutorialVideos: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          <span className="ml-2 text-xs font-medium text-slate-300">
                            {settingsForm.showTutorialVideos !== false ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>
                      </div>

                      {/* Section Heading & Subtitle */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/50 p-3.5 rounded-xl border border-slate-800">
                        <div>
                          <label className="text-slate-300 font-medium block mb-1">Section Title</label>
                          <input
                            type="text"
                            value={settingsForm.tutorialSectionTitle ?? 'How to Set Up Your PSN Account'}
                            onChange={(e) => setSettingsForm({ ...settingsForm, tutorialSectionTitle: e.target.value })}
                            placeholder="How to Set Up Your PSN Account"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-slate-300 font-medium block mb-1">Section Subtitle</label>
                          <input
                            type="text"
                            value={settingsForm.tutorialSectionSubtitle ?? 'Need help setting up your PlayStation account? Watch our quick PS4 or PS5 tutorial before getting started.'}
                            onChange={(e) => setSettingsForm({ ...settingsForm, tutorialSectionSubtitle: e.target.value })}
                            placeholder="Need help setting up your PlayStation account? Watch our quick PS4 or PS5 tutorial before getting started."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                          />
                        </div>
                      </div>

                      {/* PS5 Tutorial Card Config */}
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-white text-slate-950 text-[10px] font-black uppercase">
                              PS5
                            </span>
                            <span className="text-xs font-bold text-white">PS5 Setup Tutorial Card</span>
                          </div>
                          {settingsForm.ps5TutorialUrl && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isValidYouTubeUrl(settingsForm.ps5TutorialUrl)
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {isValidYouTubeUrl(settingsForm.ps5TutorialUrl) ? 'Valid YouTube Link' : 'Invalid YouTube Link'}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-300 font-medium block mb-1">PS5 Tutorial Title</label>
                            <input
                              type="text"
                              value={settingsForm.ps5TutorialTitle ?? 'PS5 Account Setup'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, ps5TutorialTitle: e.target.value })}
                              placeholder="PS5 Account Setup"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-slate-300 font-medium block mb-1">PS5 YouTube Video URL</label>
                            <input
                              type="text"
                              value={settingsForm.ps5TutorialUrl ?? 'https://youtu.be/xiz5uyCTjBk'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, ps5TutorialUrl: e.target.value })}
                              placeholder="https://youtu.be/xiz5uyCTjBk"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">PS5 Card Description</label>
                          <textarea
                            rows={2}
                            value={settingsForm.ps5TutorialDesc ?? 'Learn how to add and set up your PSN account on PS5.'}
                            onChange={(e) => setSettingsForm({ ...settingsForm, ps5TutorialDesc: e.target.value })}
                            placeholder="Learn how to add and set up your PSN account on PS5."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                          />
                        </div>
                      </div>

                      {/* PS4 Tutorial Card Config */}
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black uppercase">
                              PS4
                            </span>
                            <span className="text-xs font-bold text-white">PS4 Setup Tutorial Card</span>
                          </div>
                          {settingsForm.ps4TutorialUrl && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isValidYouTubeUrl(settingsForm.ps4TutorialUrl)
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {isValidYouTubeUrl(settingsForm.ps4TutorialUrl) ? 'Valid YouTube Link' : 'Invalid YouTube Link'}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-300 font-medium block mb-1">PS4 Tutorial Title</label>
                            <input
                              type="text"
                              value={settingsForm.ps4TutorialTitle ?? 'PS4 Account Setup'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, ps4TutorialTitle: e.target.value })}
                              placeholder="PS4 Account Setup"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-slate-300 font-medium block mb-1">PS4 YouTube Video URL</label>
                            <input
                              type="text"
                              value={settingsForm.ps4TutorialUrl ?? 'https://youtu.be/TmaGY511fxA'}
                              onChange={(e) => setSettingsForm({ ...settingsForm, ps4TutorialUrl: e.target.value })}
                              placeholder="https://youtu.be/TmaGY511fxA"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-slate-300 font-medium block mb-1">PS4 Card Description</label>
                          <textarea
                            rows={2}
                            value={settingsForm.ps4TutorialDesc ?? 'Learn how to add and set up your PSN account on PS4.'}
                            onChange={(e) => setSettingsForm({ ...settingsForm, ps4TutorialDesc: e.target.value })}
                            placeholder="Learn how to add and set up your PSN account on PS4."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* PROMOTION SETTINGS: FIRST PURCHASE GOOGLE DISCOUNT */}
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-sm font-bold text-white">Google First-Purchase Discount ($1.00 Off)</h4>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">
                            Give first-time customers who sign in with their Google account $1.00 off their first game order.
                          </p>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settingsForm.firstPurchaseDiscountEnabled !== false}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                firstPurchaseDiscountEnabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-300 font-medium block mb-1">Discount Amount (USD)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <input
                                type="number"
                                step="0.25"
                                min="0.5"
                                max="10"
                                value={settingsForm.firstPurchaseDiscountAmountUSD ?? 1.0}
                                onChange={(e) =>
                                  setSettingsForm({
                                    ...settingsForm,
                                    firstPurchaseDiscountAmountUSD: parseFloat(e.target.value) || 1.0,
                                  })
                                }
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-slate-300 font-medium block mb-1">Promotion Rule</label>
                            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                              Calculated <strong>authoritatively server-side</strong>. Applied only once per verified Google account upon successful payment.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* INSTANT ADMIN EMAIL NOTIFICATIONS */}
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-bold text-white">Instant Purchase & Delivery Email Engine</h4>
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">
                            Handles both customer credential delivery upon fulfillment and immediate admin purchase alerts.
                          </p>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settingsForm.adminNotificationEmailEnabled !== false}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                adminNotificationEmailEnabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Provider Status Card */}
                      <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <SendHorizontal className="w-3.5 h-3.5 text-blue-400" />
                            Configured Email Provider:
                          </span>
                          {emailConfigStatus?.isConfigured ? (
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              ACTIVE: {emailConfigStatus.activeProvider}
                            </span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              NO CREDENTIALS SET
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {emailConfigStatus?.details || 'Checking email configuration status...'}
                        </p>

                        {!emailConfigStatus?.isConfigured && (
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-[11px] text-slate-400">
                            <div className="font-bold text-slate-200">How to activate real email delivery:</div>
                            <div className="space-y-1 pl-1">
                              <div>
                                <strong className="text-amber-300">Option 1 (Recommended — Gmail App Password):</strong>
                                <br />
                                1. Enable 2-Step Verification on your Google Account ({settingsForm.adminNotificationEmail || 'oforir74444@gmail.com'}).
                                <br />
                                2. Generate a 16-character App Password at <span className="font-mono text-blue-300">myaccount.google.com/apppasswords</span>.
                                <br />
                                3. Add <span className="font-mono text-emerald-400">GMAIL_APP_PASSWORD</span> in Settings.
                              </div>
                              <div className="pt-1">
                                <strong className="text-amber-300">Option 2 (Resend API):</strong>
                                <br />
                                Create a free account on <span className="font-mono text-blue-300">resend.com</span> and set <span className="font-mono text-emerald-400">RESEND_API_KEY</span>.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div>
                          <label className="text-slate-300 font-medium block mb-1">
                            Admin Notification Recipient Email
                          </label>
                          <input
                            type="email"
                            value={settingsForm.adminNotificationEmail || ''}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                adminNotificationEmail: e.target.value,
                              })
                            }
                            placeholder="oforir74444@gmail.com"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            The administrator email address where purchase notifications are sent instantly upon payment verification.
                          </p>
                        </div>

                        {/* Live SMTP Diagnostics & Custom Test Email Dispatch */}
                        <div className="pt-3 border-t border-slate-800/80 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                <span>SMTP Connection & Authentication Diagnostics</span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Verify live TLS connection and credentials with Google SMTP (smtp.gmail.com:465).
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRunDiagnostics}
                              disabled={isRunningDiagnostics}
                              className="bg-slate-800 hover:bg-slate-700 text-blue-300 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                              <span>{isRunningDiagnostics ? 'Verifying...' : 'Verify SMTP Live'}</span>
                            </button>
                          </div>

                          {smtpDiagnostics && (
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1">
                              <div className="flex items-center gap-4 flex-wrap">
                                <div>
                                  Connection:{' '}
                                  <span className={`font-bold ${smtpDiagnostics.connection === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {smtpDiagnostics.connection}
                                  </span>
                                </div>
                                <div>
                                  Authentication:{' '}
                                  <span className={`font-bold ${smtpDiagnostics.authentication === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {smtpDiagnostics.authentication}
                                  </span>
                                </div>
                                <div>
                                  Provider: <span className="text-blue-300 font-mono">{smtpDiagnostics.provider}</span>
                                </div>
                              </div>
                              {smtpDiagnostics.details && (
                                <div className="text-slate-400 font-mono text-[10px] pt-1">
                                  {smtpDiagnostics.details}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-2">
                            <div className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" />
                              <span>Test Real Recipient Delivery (Multi-Domain Testing)</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              Send a real diagnostic email to any recipient address (Gmail, Outlook, Yahoo) to verify SMTP acceptance:
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="email"
                                value={customTestEmailRecipient}
                                onChange={(e) => setCustomTestEmailRecipient(e.target.value)}
                                placeholder="Enter recipient email (e.g. customer@gmail.com)"
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => handleSendTestEmail()}
                                disabled={isSendingTestEmail}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                              >
                                {isSendingTestEmail ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                <span>{isSendingTestEmail ? 'Sending...' : 'Send Test Email'}</span>
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              Leave blank to test with the default Admin Notification address (<span className="text-slate-300 font-mono">{settingsForm.adminNotificationEmail || 'oforir74444@gmail.com'}</span>).
                            </p>
                          </div>
                        </div>

                        {testEmailResult && (
                          <div
                            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                              testEmailResult.success
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {testEmailResult.success ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 shrink-0" />
                            )}
                            <span>{testEmailResult.message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingSettings && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{isSavingSettings ? 'Saving Settings...' : 'Save Store Settings'}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 7: FAQ EDITOR */}
              {activeTab === 'faqs' && (
                <FAQEditorTab
                  faqsList={faqsList}
                  getAdminHeaders={getAdminHeaders}
                  onRefresh={fetchAdminData}
                />
              )}

              {/* TAB 8: AUDIT LOGS */}
              {activeTab === 'logs' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-white">System & Administrative Audit Log</h3>
                    <p className="text-slate-400 text-xs">
                      Permanent chronological tracking of price updates, exchange rate changes, and fulfillment actions.
                    </p>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="divide-y divide-slate-800 text-xs">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="p-3 hover:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <span className="font-bold text-blue-400 mr-2">[{log.action}]</span>
                            <span className="text-slate-200">{log.details}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono shrink-0">
                            By {log.adminUser} • {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
