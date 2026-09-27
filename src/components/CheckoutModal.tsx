import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
  X,
  ShieldCheck,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  UserCheck,
  LogOut,
  Tag,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Order } from '../types';

export const CheckoutModal: React.FC = () => {
  const {
    selectedGame,
    selectedConsole,
    selectedAccountType,
    closeModal,
    openModal,
    formatUSD,
    formatGHS,
    convertToGHS,
    settings,
    currentUser,
    userEligibility,
    loginWithGoogle,
    logoutCustomer,
    checkEligibility,
  } = useStore();

  // Mode: 'GOOGLE' or 'GUEST'
  const [checkoutMode, setCheckoutMode] = useState<'GOOGLE' | 'GUEST'>(
    currentUser ? 'GOOGLE' : 'GOOGLE'
  );

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync Google user profile details when currentUser changes and mode is GOOGLE
  useEffect(() => {
    if (currentUser && checkoutMode === 'GOOGLE') {
      if (currentUser.displayName && !customerName) {
        setCustomerName(currentUser.displayName);
      }
      if (currentUser.email) {
        setCustomerEmail(currentUser.email);
      }
    }
  }, [currentUser, checkoutMode]);

  // When opening or switching to Google mode while user is signed in, recheck eligibility
  useEffect(() => {
    if (currentUser && checkoutMode === 'GOOGLE') {
      checkEligibility(currentUser);
    }
  }, [currentUser, checkoutMode, checkEligibility]);

  if (!selectedGame || !selectedAccountType) return null;

  const originalPriceUSD =
    selectedGame.accountPrices[selectedAccountType.id as keyof typeof selectedGame.accountPrices] ??
    selectedAccountType.defaultPriceUSD;

  const promoEnabled = settings.firstPurchaseDiscountEnabled !== false;
  const promoDiscountAmountUSD = settings.firstPurchaseDiscountAmountUSD ?? 1.0;

  // Determine if discount applies
  const isGoogleAccountSelected = checkoutMode === 'GOOGLE' && Boolean(currentUser);
  const isDiscountEligible =
    isGoogleAccountSelected &&
    promoEnabled &&
    userEligibility.hasChecked &&
    userEligibility.eligible;

  const discountUSD = isDiscountEligible
    ? Math.min(originalPriceUSD, userEligibility.discountUSD || promoDiscountAmountUSD)
    : 0;

  const finalPriceUSD = Math.max(0, originalPriceUSD - discountUSD);
  const amountGHS = convertToGHS(finalPriceUSD);

  const handleGoogleSignInClick = async () => {
    try {
      setErrorMessage('');
      setIsSigningInGoogle(true);
      const user = await loginWithGoogle();
      if (user) {
        setCheckoutMode('GOOGLE');
        if (user.displayName) setCustomerName(user.displayName);
        if (user.email) setCustomerEmail(user.email);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || 'Failed to sign in with Google. You can continue as Guest.');
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleSwitchToGuest = () => {
    setCheckoutMode('GUEST');
    setErrorMessage('');
  };

  const handleSwitchToGoogle = () => {
    setCheckoutMode('GOOGLE');
    setErrorMessage('');
    if (currentUser) {
      if (currentUser.displayName) setCustomerName(currentUser.displayName);
      if (currentUser.email) setCustomerEmail(currentUser.email);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (checkoutMode === 'GOOGLE' && !currentUser) {
      setErrorMessage('Please click "Sign in with Google" or choose "Continue as Guest".');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Please enter your WhatsApp or mobile phone number for PlayStation digital delivery.');
      return;
    }
    if (!termsAccepted) {
      setErrorMessage('You must read and accept the PlayStation Account Terms & Conditions to proceed.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Get Firebase ID token if authenticated with Google
      let idToken: string | undefined = undefined;
      if (checkoutMode === 'GOOGLE' && currentUser) {
        try {
          idToken = await currentUser.getIdToken();
        } catch (tokenErr) {
          console.warn('Failed to retrieve fresh Google ID token:', tokenErr);
        }
      }

      // Step 1: Server-side order creation (authoritative price lock and reference generation)
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          gameId: selectedGame.id,
          console: selectedConsole,
          accountTypeId: selectedAccountType.id,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          termsAccepted: true,
          isGoogleAccount: checkoutMode === 'GOOGLE' && Boolean(currentUser),
          idToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.error || 'Failed to initialize order on server.');
      }

      const order: Order = data.order;

      // Step 2: Initialize Paystack transaction server-side
      const clientOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const paystackRes = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          secureToken: order.secureToken,
          clientOrigin,
        }),
      });

      const paystackData = await paystackRes.json();

      if (!paystackRes.ok || !paystackData.success || !paystackData.data?.authorization_url) {
        throw new Error(
          paystackData.error ||
            paystackData.message ||
            'Unable to initialize Paystack payment gateway. Please check server settings or try again.'
        );
      }

      // Step 3: Redirect customer directly to Paystack's official checkout page
      window.location.href = paystackData.data.authorization_url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Unable to start payment. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Paystack Secure Checkout</h2>
              <p className="text-xs text-slate-400">Instant digital game delivery in Ghana</p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitOrder} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* CHECKOUT CHOICE: CONTINUE WITH GOOGLE VS CONTINUE AS GUEST */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Choose Checkout Method</span>
              {promoEnabled && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3" /> $1.00 Off with Google
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option A: Google Account */}
              <button
                type="button"
                onClick={handleSwitchToGoogle}
                className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  checkoutMode === 'GOOGLE'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg shadow-blue-950/50'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span className="font-bold text-xs">Continue with Google</span>
                  </div>
                  {checkoutMode === 'GOOGLE' && (
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  )}
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold">
                  Get $1.00 OFF first purchase
                </div>
              </button>

              {/* Option B: Guest Checkout */}
              <button
                type="button"
                onClick={handleSwitchToGuest}
                className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  checkoutMode === 'GUEST'
                    ? 'bg-slate-800/80 border-slate-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-xs">Continue as Guest</span>
                  {checkoutMode === 'GUEST' && (
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Standard catalog price
                </div>
              </button>
            </div>
          </div>

          {/* GOOGLE AUTHENTICATION STATE CARD (When Google Mode Selected) */}
          {checkoutMode === 'GOOGLE' && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3.5 space-y-2.5">
              {!currentUser ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sign in to claim your $1.00 discount</span>
                    </div>
                    <p className="text-[11px] text-blue-200/80">
                      Sign in with your Google account to automatically apply $1.00 off your first purchase.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={isSigningInGoogle}
                    className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-900 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all shrink-0 disabled:opacity-50"
                  >
                    {isSigningInGoogle ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                    )}
                    <span>{isSigningInGoogle ? 'Signing in...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0 overflow-hidden">
                        {currentUser.photoURL ? (
                          <img
                            src={currentUser.photoURL}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          currentUser.displayName?.[0] || 'G'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                          <span>{currentUser.displayName || 'Google Customer'}</span>
                          <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={logoutCustomer}
                      className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Switch</span>
                    </button>
                  </div>

                  {/* Promo Status Feedback */}
                  {userEligibility.loading ? (
                    <div className="text-[11px] text-blue-300 flex items-center gap-1.5 pt-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking promotion eligibility...</span>
                    </div>
                  ) : isDiscountEligible ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <div className="text-xs">
                        <strong>$1.00 First-Purchase Discount Applied!</strong>{' '}
                        <span className="text-emerald-400">
                          Enjoy $1 off your very first PlayStation game order.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0 text-slate-400" />
                      <div className="text-[11px]">
                        Welcome back! You have already redeemed your first-purchase discount on this Google account. Continuing at standard catalog price.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order Summary Box */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Order Summary
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Locked Rate
              </span>
            </div>

            <div className="flex justify-between items-start gap-3">
              <div>
                <h4 className="font-bold text-white text-sm leading-tight">{selectedGame.title}</h4>
                <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                  <span>Platform:</span>
                  <span className="text-blue-400 font-semibold">{selectedConsole}</span>
                  <span>•</span>
                  <span>Account:</span>
                  <span className="text-slate-200 font-semibold">{selectedAccountType.name}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-base font-black text-white">{formatUSD(finalPriceUSD)}</span>
                {discountUSD > 0 && (
                  <span className="block text-[11px] text-slate-500 line-through">
                    {formatUSD(originalPriceUSD)}
                  </span>
                )}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5 text-slate-300">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Catalog Display Price (USD):</span>
                <span>{formatUSD(originalPriceUSD)}</span>
              </div>

              {discountUSD > 0 && (
                <div className="flex justify-between text-[11px] text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    First-Purchase Google Discount:
                  </span>
                  <span>-{formatUSD(discountUSD)}</span>
                </div>
              )}

              {discountUSD > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-white">
                  <span className="text-slate-300">Final Price (USD):</span>
                  <span>{formatUSD(finalPriceUSD)}</span>
                </div>
              )}

              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Store Exchange Rate:</span>
                <span className="font-mono text-blue-400 font-medium">
                  $1.00 USD = GH₵ {settings.exchangeRateUSDToGHS.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800/50">
                <span>Total Amount to Pay (GHS):</span>
                <span className="text-emerald-400 font-mono text-base font-black">
                  {formatGHS(amountGHS)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Details Form */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Customer Contact Information
            </div>

            <div className="space-y-1">
              <label htmlFor="checkout-name" className="text-slate-300 font-medium block">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                id="checkout-name"
                type="text"
                required
                disabled={isSubmitting}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g., Kwame Mensah"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="checkout-email" className="text-slate-300 font-medium block">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  disabled={isSubmitting || (checkoutMode === 'GOOGLE' && Boolean(currentUser?.email))}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g., kwame@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-500">
                  Paystack receipt and tracking link will be sent here.
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="checkout-phone" className="text-slate-300 font-medium block">
                  WhatsApp / Mobile Number <span className="text-red-400">*</span>
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  disabled={isSubmitting}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g., 024 123 4567"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-500">
                  Used by our team to deliver PlayStation login details.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Acceptance */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                id="checkout-terms-checkbox"
                type="checkbox"
                disabled={isSubmitting}
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-slate-300 text-xs leading-relaxed">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openModal('terms');
                  }}
                  className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                >
                  PlayStation Account Terms & Conditions
                </button>{' '}
                and understand the rules for <strong>{selectedAccountType.name}</strong> accounts.
              </span>
            </label>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              id="pay-with-paystack-btn"
              type="submit"
              disabled={isSubmitting || !termsAccepted || (checkoutMode === 'GOOGLE' && !currentUser)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Redirecting to Paystack...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Pay GH₵ {amountGHS.toFixed(2)} with Paystack</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" />
                Official Paystack Gateway
              </span>
              <span>•</span>
              <span>MTN Mobile Money</span>
              <span>•</span>
              <span>Telecel Cash</span>
              <span>•</span>
              <span>Visa / Mastercard</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
