import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { auth } from '../lib/firebase';
import {
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  MessageCircle,
  Mail,
  RefreshCw,
  AlertCircle,
  Gamepad2,
  KeyRound,
  FileText,
  Sparkles,
  Unlock,
  Tag,
  Lock,
} from 'lucide-react';
import { Order } from '../types';

export const OrderTrackingView: React.FC = () => {
  const { trackingOrderId, trackingToken, closeModal, settings, formatUSD, currentUser, openMyGames } = useStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [is403Error, setIs403Error] = useState(false);
  
  // Manual lookup inputs if none in URL
  const [manualOrderId, setManualOrderId] = useState(trackingOrderId || '');
  const [manualToken, setManualToken] = useState(trackingToken || '');
  const [unlockEmailOrToken, setUnlockEmailOrToken] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // Copy helpers
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [passwordRevealed, setPasswordRevealed] = useState(false);

  const fetchOrder = useCallback(async (id: string, tokenOrEmail: string = '', silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      setIs403Error(false);
      setUnlockError('');

      const cleanId = id.trim().replace(/^#/, '');
      const cleanParam = tokenOrEmail.trim();

      let url = `/api/orders/${encodeURIComponent(cleanId)}`;
      const params = new URLSearchParams();
      if (cleanParam) {
        if (cleanParam.includes('@')) {
          params.set('email', cleanParam);
        } else {
          params.set('token', cleanParam);
        }
      }
      const qs = params.toString();
      if (qs) {
        url += `?${qs}`;
      }

      const headers: Record<string, string> = {};
      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch (e) {
          // fallback
        }
      }

      const res = await fetch(url, { headers });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setIs403Error(true);
          throw new Error('Access Denied (403 Forbidden): This order belongs to a different customer account. You cannot view purchases from other accounts.');
        }
        throw new Error(data.error || 'Unable to retrieve order. Please verify your order number.');
      }

      setOrder(data);
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Error loading order tracking information.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (trackingOrderId) {
      fetchOrder(trackingOrderId, trackingToken || '');
    } else {
      setLoading(false);
    }
  }, [trackingOrderId, trackingToken, fetchOrder]);

  // Periodic status poll while order is awaiting fulfillment so the customer automatically sees when fulfilled
  useEffect(() => {
    if (!order || order.orderStatus === 'FULFILLED' || order.orderStatus === 'CANCELLED' || order.orderStatus === 'REFUNDED') {
      return;
    }
    const interval = setInterval(() => {
      fetchOrder(order.id, order.secureToken || manualToken || '', true);
    }, 15000);

    return () => clearInterval(interval);
  }, [order, manualToken, fetchOrder]);

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderId.trim()) return;
    fetchOrder(manualOrderId.trim(), manualToken.trim());
  };

  const handleUnlockCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !unlockEmailOrToken.trim()) return;
    setLoading(true);
    setUnlockError('');
    try {
      await fetchOrder(order.id, unlockEmailOrToken.trim());
    } catch (err: any) {
      setUnlockError(err.message || 'Incorrect email or security token.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusStepIndex = (status: Order['orderStatus']) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 0;
      case 'PAID':
        return 1;
      case 'AWAITING_FULFILLMENT':
        return 2;
      case 'PROCESSING':
        return 3;
      case 'FULFILLED':
        return 4;
      default:
        return 2;
    }
  };

  const steps = [
    { label: 'Order Created', desc: 'Order details recorded' },
    { label: 'Payment Confirmed', desc: 'Verified via Paystack' },
    { label: 'Awaiting Fulfillment', desc: 'Queued for setup' },
    { label: 'Preparing Account', desc: 'Generating credentials' },
    { label: 'Account Ready', desc: 'Available for play' },
  ];

  const currentStep = order ? getStatusStepIndex(order.orderStatus) : 0;
  const isFulfilled = order?.orderStatus === 'FULFILLED';

  // Format WhatsApp number using settings
  const rawWhatsApp = settings.supportWhatsApp || '';
  const cleanWhatsAppDigits = rawWhatsApp.replace(/[^0-9]/g, '');
  let formattedWhatsApp = cleanWhatsAppDigits;
  if (cleanWhatsAppDigits.length === 10 && cleanWhatsAppDigits.startsWith('0')) {
    formattedWhatsApp = `233${cleanWhatsAppDigits.slice(1)}`;
  }
  const isWhatsAppConfigured = Boolean(formattedWhatsApp && formattedWhatsApp.length >= 8);

  const whatsAppContactUrl = isWhatsAppConfigured && order
    ? `https://wa.me/${formattedWhatsApp}?text=${encodeURIComponent(
        `Hello ${settings.storeName || 'PlayVault'}, I need assistance with Order #${order.orderNumber} (${order.gameTitleSnapshot})`
      )}`
    : '#';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 text-xs">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Digital Order Tracking
              </h2>
              <p className="text-xs text-slate-400">
                {order ? `Order #${order.orderNumber}` : 'Look up your PlayStation order status'}
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* If no order loaded, show manual search form */}
          {!order && (
            <div className="space-y-4 max-w-md mx-auto py-6">
              <div className="text-center space-y-1">
                <Gamepad2 className="w-10 h-10 text-blue-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Find Your Order</h3>
                <p className="text-slate-400 text-xs">
                  Enter your order number to track preparation and fulfillment progress in real time.
                </p>
              </div>

              <form onSubmit={handleManualLookup} className="space-y-3.5 bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 shadow-xl">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Order Number
                  </label>
                  <input
                    type="text"
                    required
                    value={manualOrderId}
                    onChange={(e) => setManualOrderId(e.target.value)}
                    placeholder="e.g. #PSG-20260921-5553 or PSG-20260921-5553"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Paste your order number from checkout or WhatsApp.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium block">
                      Email Address or Security Token <span className="text-slate-500 font-normal text-[10px]">(Optional)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="e.g. your email or security token"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Optional to track status; entering your email allows credentials to unlock immediately when ready.
                  </p>
                </div>

                {error && (
                  <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
                    is403Error
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {is403Error ? (
                        <Lock className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                      )}
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold text-white">
                          {is403Error ? 'Account Security Notice (403 Forbidden)' : 'Lookup Error'}
                        </p>
                        <p className="leading-relaxed text-slate-300">{error}</p>
                      </div>
                    </div>
                    {is403Error && currentUser && (
                      <button
                        type="button"
                        onClick={() => openMyGames()}
                        className="mt-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>Go to My Games</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Searching...' : 'Track Order Status'}</span>
                </button>
              </form>
            </div>
          )}

          {/* When Order is Loaded */}
          {order && (
            <>
              {/* Top Dynamic Order Number & Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-xs font-medium">Order Number:</span>
                  <span className="font-mono font-bold text-white text-xs sm:text-sm bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700">
                    #{order.orderNumber}
                  </span>
                  <button
                    onClick={() => {
                      setOrder(null);
                      setManualOrderId('');
                      setManualToken('');
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-1 cursor-pointer transition-colors"
                  >
                    Track another order
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Status:
                  </span>
                  <span
                    className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 border ${
                      isFulfilled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {!isFulfilled && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping inline-block" />}
                    {isFulfilled ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                    <span>{order.orderStatus === 'AWAITING_FULFILLMENT' ? 'AWAITING FULFILLMENT' : order.orderStatus.replace(/_/g, ' ')}</span>
                  </span>

                  <button
                    onClick={() => fetchOrder(order.id, order.secureToken || manualToken || '')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-1 cursor-pointer"
                    title="Refresh order status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Prominent 30-Minute Estimated Delivery Callout (When awaiting fulfillment) */}
              {!isFulfilled && (
                <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/50 to-blue-950/60 border-2 border-blue-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-xl shadow-blue-950/40">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
                      <Clock className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider font-bold text-blue-300">
                        Fulfillment Timeline
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-white">
                        Estimated delivery: <span className="text-blue-400 underline decoration-blue-400/50 decoration-2 underline-offset-4">Within 30 minutes</span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-right">
                    <span className="text-[11px] text-slate-400">Digital Delivery</span>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Email & WhatsApp
                    </span>
                  </div>
                </div>
              )}

              {/* Exact Post-Payment Customer Communication Message */}
              {!isFulfilled ? (
                <div className="bg-slate-950 rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-3.5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <span>Payment received successfully!</span>
                        <span className="text-lg">🎉</span>
                      </h3>
                      
                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                        Your order has been received and we are now preparing your PlayStation account details and setup instructions.
                      </p>

                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                        You will receive your account credentials through the email address you provided at checkout or via WhatsApp.
                      </p>

                      <p className="text-blue-300 font-semibold text-xs sm:text-sm">
                        Your order should be ready within 30 minutes.
                      </p>

                      <p className="text-slate-400 text-xs leading-relaxed">
                        You can simply wait for our message, or contact us directly on WhatsApp if you need assistance.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Dynamically changed message when Admin fulfills the order */
                <div className="bg-emerald-950/30 rounded-2xl p-5 sm:p-6 border-2 border-emerald-500/50 space-y-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <span>🎉 Your PlayStation Account is Ready & Fulfilled!</span>
                      </h3>
                      <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed">
                        Your PlayStation account credentials and step-by-step setup instructions are available below. We have also dispatched details to your email ({order.customerEmail}) and WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* WHAT HAPPENS NEXT? Section */}
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>WHAT HAPPENS NEXT?</span>
                  </h4>
                  <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    {isFulfilled ? 'Delivery Completed ✓' : 'Expected delivery: Within 30 minutes.'}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                      ✓
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>1. Payment Confirmed</span>
                        <span className="text-emerald-400">✓</span>
                      </div>
                      <p className="text-slate-400 text-xs">
                        Your payment has been successfully received.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                    isFulfilled
                      ? 'bg-slate-900/60 border-slate-800/80'
                      : 'bg-blue-950/25 border-blue-500/30'
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                      isFulfilled
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-blue-600 text-white ring-2 ring-blue-500/40'
                    }`}>
                      {isFulfilled ? '✓' : '2'}
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <div className="font-bold text-white text-xs flex items-center gap-2">
                        <span>2. Preparing Your Account</span>
                        {!isFulfilled ? (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">
                            In Progress
                          </span>
                        ) : (
                          <span className="text-emerald-400">✓</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs">
                        {isFulfilled
                          ? 'PlayStation account details and setup instructions have been prepared.'
                          : 'We are preparing your PlayStation account details and setup instructions.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-start gap-3 p-3 rounded-xl border ${
                    isFulfilled
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-900/60 border-slate-800/80'
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                      isFulfilled
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {isFulfilled ? '✓' : '3'}
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        <span>3. Account Delivered</span>
                        {isFulfilled && <span className="text-emerald-400">✓</span>}
                      </div>
                      <p className="text-slate-400 text-xs">
                        {isFulfilled
                          ? 'Your account credentials and setup instructions are revealed below and sent to your email/WhatsApp.'
                          : 'We will send your account credentials to the email you provided or contact you through WhatsApp.'}
                      </p>
                    </div>
                  </div>
                </div>

                {!isFulfilled && (
                  <div className="pt-1 text-center sm:text-left text-xs font-semibold text-blue-300 flex items-center justify-center sm:justify-start gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Expected delivery: Within 30 minutes.</span>
                  </div>
                )}
              </div>

              {/* Fulfillment Pipeline Stepper Bar */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Order Pipeline
                  </span>
                  <span className="text-xs font-mono font-semibold text-blue-400">
                    Status: {order.orderStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2 relative">
                  {steps.map((step, idx) => {
                    const isDone = currentStep >= idx;
                    const isCurrent = currentStep === idx;

                    return (
                      <div key={idx} className="flex flex-col items-center text-center space-y-1.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] border transition-all ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : isCurrent
                              ? 'bg-blue-600 border-blue-400 text-white ring-2 ring-blue-500/40'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                        </div>
                        <div className="text-[10px] font-bold text-slate-200 line-clamp-1">
                          {step.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Purchased Product Snapshot Details */}
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white text-xs">
                      {order.gameTitleSnapshot}
                    </span>
                  </div>
                  <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30">
                    {order.console}
                  </span>
                </div>

                <div className={`grid grid-cols-2 ${order.discountStatus === 'APPLIED' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3 text-[11px]`}>
                  <div>
                    <span className="text-slate-500 block">Account Tier</span>
                    <strong className="text-slate-200">{order.accountTypeSnapshot}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Catalog Price</span>
                    <strong className="text-slate-200">
                      {formatUSD(order.originalPriceUSD ?? order.priceUSD)}
                    </strong>
                  </div>
                  {order.discountStatus === 'APPLIED' && (
                    <div>
                      <span className="text-emerald-400 block font-semibold flex items-center gap-1">
                        <Tag className="w-3 h-3" /> 1st-Order Promo
                      </span>
                      <strong className="text-emerald-300 font-bold">
                        -{formatUSD(order.discountUSD ?? 1.0)}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block">Paid Amount</span>
                    <strong className="text-emerald-400 font-mono">GH₵ {order.amountGHS.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Paystack Ref</span>
                    <strong className="text-slate-300 font-mono text-[10px] truncate block" title={order.paystackReference}>
                      {order.paystackReference}
                    </strong>
                  </div>
                </div>
              </div>

              {/* FULFILLED ACCOUNT CREDENTIALS (Protected: Only rendered when fulfilled) */}
              {isFulfilled && !order.deliveryInformation && (
                <div className="bg-amber-950/20 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <KeyRound className="w-4 h-4" />
                    <span>PlayStation Account Credentials Ready!</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Your digital PlayStation account credentials and setup guide are ready. To view and copy your login details, enter the email address used during checkout:
                  </p>
                  <form onSubmit={handleUnlockCredentials} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      value={unlockEmailOrToken}
                      onChange={(e) => setUnlockEmailOrToken(e.target.value)}
                      placeholder="e.g. your checkout email address"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{loading ? 'Verifying...' : 'Unlock Credentials'}</span>
                    </button>
                  </form>
                  {unlockError && (
                    <div className="text-red-400 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{unlockError}</span>
                    </div>
                  )}
                </div>
              )}

              {isFulfilled && order.deliveryInformation && (
                <div className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <KeyRound className="w-4 h-4" />
                      <span>PlayStation Account Credentials</span>
                    </div>
                    <span className="text-[10px] text-emerald-300 font-mono">
                      Fulfilled {new Date(order.deliveryInformation.fulfilledAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Username / Email */}
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px] block">
                      Account Email / Login ID
                    </label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-mono text-white text-xs select-all flex-1">
                        {order.deliveryInformation.accountEmail}
                      </span>
                      <button
                        onClick={() => copyToClipboard(order.deliveryInformation!.accountEmail, 'email')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'email' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px] block">
                      Account Password
                    </label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-mono text-white text-xs select-all flex-1">
                        {passwordRevealed ? order.deliveryInformation.accountPassword : '••••••••••••••••'}
                      </span>
                      <button
                        onClick={() => setPasswordRevealed(!passwordRevealed)}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer"
                        title={passwordRevealed ? 'Hide Password' : 'Show Password'}
                      >
                        {passwordRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(order.deliveryInformation!.accountPassword, 'pass')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'pass' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'pass' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Backup 2FA Codes if present */}
                  {order.deliveryInformation.backupCodes && (
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[11px] block">
                        Backup Verification Codes (2FA)
                      </label>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-white text-xs select-all">
                        {order.deliveryInformation.backupCodes}
                      </div>
                    </div>
                  )}

                  {/* Setup Instructions */}
                  <div className="space-y-1 pt-1">
                    <label className="text-slate-400 text-[11px] flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      Step-by-Step Setup Instructions
                    </label>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-line text-xs font-mono">
                      {order.deliveryInformation.setupInstructions}
                    </div>
                  </div>

                  {order.deliveryInformation.notes && (
                    <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <strong>Admin Note:</strong> {order.deliveryInformation.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Clear Contact Option: "Need help or want to contact us?" */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="font-bold text-white text-sm">
                    Need help or want to contact us?
                  </div>
                  <div className="text-slate-400 text-xs max-w-sm">
                    Our customer support is standing by on WhatsApp to assist with setup or questions regarding your order.
                  </div>
                </div>

                {isWhatsAppConfigured ? (
                  <a
                    href={whatsAppContactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Contact us on WhatsApp</span>
                  </a>
                ) : (
                  <div className="w-full sm:w-auto text-amber-300 bg-amber-500/10 border border-amber-500/25 px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 text-center">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Please configure WhatsApp in Site Settings</span>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
