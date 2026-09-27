import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  MessageCircle,
  ShieldCheck,
  Gamepad2,
  Lock,
} from 'lucide-react';
import { Order } from '../types';

interface PaymentCallbackProps {
  onClose?: () => void;
}

export const PaymentCallback: React.FC<PaymentCallbackProps> = ({ onClose }) => {
  const { setTrackingOrder, openMyGames, currentUser, settings } = useStore();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'verifying' | 'success' | 'pending' | 'failed'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [reference, setReference] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference') || params.get('trxref');
    const orderId = params.get('orderId');
    const token = params.get('token');

    if (!ref) {
      setStatus('failed');
      setErrorMessage('No payment reference found in the callback URL.');
      setLoading(false);
      return;
    }

    setReference(ref);

    let isMounted = true;

    async function verifyPayment() {
      try {
        setLoading(true);
        setStatus('verifying');
        setErrorMessage('');

        const response = await fetch(`/api/paystack/verify/${encodeURIComponent(ref!)}`);
        const data = await response.json();

        if (!isMounted) return;

        if (response.ok && data.success && (data.status === 'success' || data.status === 'already_paid')) {
          setStatus('success');
          setOrder(data.order);
        } else if (data.status === 'pending') {
          setStatus('pending');
          setErrorMessage(
            data.message ||
              'Payment verification is pending. Please do not make another payment. Your order will update automatically.'
          );
          if (data.order) setOrder(data.order);
        } else {
          setStatus('failed');
          setErrorMessage(
            data.message ||
              data.error ||
              'Payment was not completed. If you were charged, please contact customer support.'
          );
          if (data.order) setOrder(data.order);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error verifying payment:', err);
        setStatus('failed');
        setErrorMessage('We encountered an error verifying your payment with the server.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verifyPayment();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleTrackOrder = () => {
    if (order) {
      // Clear URL query parameters cleanly
      window.history.replaceState({}, document.title, window.location.pathname);
      setTrackingOrder(order.id, order.secureToken);
      if (onClose) onClose();
    }
  };

  const handleViewMyGames = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    openMyGames();
    if (onClose) onClose();
  };

  const handleReturnToStore = () => {
    window.history.replaceState({}, document.title, '/');
    if (onClose) {
      onClose();
    } else {
      window.location.href = '/';
    }
  };

  const supportWhatsAppUrl = `https://wa.me/${(settings.supportWhatsApp || '233500000000').replace(
    /[^0-9]/g,
    ''
  )}?text=${encodeURIComponent(
    `Hello ReyGames, I need help with payment reference: ${reference || 'N/A'}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 text-xs">
        
        {/* Verifying State */}
        {loading && status === 'verifying' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Verifying Paystack Payment</h3>
              <p className="text-slate-400 text-xs max-w-xs mx-auto">
                Securely verifying your transaction with Paystack. Please do not close or refresh this window.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Reference: {reference}
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && status === 'success' && order && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-black text-white">PAYMENT SUCCESSFUL</h3>
                <p className="text-slate-400 text-xs">
                  Your order has been received and verified.
                </p>
              </div>
            </div>

            {/* Order Details Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                  Order Number
                </span>
                <span className="font-mono font-bold text-blue-400 text-sm">
                  {order.orderNumber}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Game:</span>
                  <span className="font-bold text-white text-right">{order.gameTitleSnapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Platform:</span>
                  <span className="text-slate-200">{order.console} • {order.accountTypeSnapshot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    GH₵ {order.amountGHS.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Status:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" /> PAID
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Order Status:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[10px]">
                    AWAITING FULFILLMENT
                  </span>
                </div>
              </div>

              {/* Delivery Estimate Message */}
              <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-300 bg-blue-950/30 border border-blue-500/20 p-3.5 rounded-xl flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5">
                  <div className="font-bold text-white text-xs">
                    Estimated delivery: <span className="text-blue-400">Within 30 minutes</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    We are preparing your PlayStation account details and setup instructions. You will receive them via email or WhatsApp.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {(order.customerGoogleUid || order.customerType === 'GOOGLE' || currentUser) && (
                <button
                  id="view-my-games-callback-btn"
                  onClick={handleViewMyGames}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>View in My Games Vault</span>
                </button>
              )}

              <button
                id="track-order-callback-btn"
                onClick={handleTrackOrder}
                className="w-full bg-slate-800 hover:bg-slate-750 text-white font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>Track Order Receipt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleReturnToStore}
                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 font-medium py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Return to Game Store
              </button>
            </div>
          </div>
        )}

        {/* Pending Verification State */}
        {!loading && status === 'pending' && (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Payment Verification Pending</h3>
              <p className="text-slate-300 text-xs max-w-sm mx-auto leading-relaxed">
                {errorMessage ||
                  'Payment verification is pending. Please do not make another payment. Your order will update automatically.'}
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-1.5 font-mono text-slate-400">
              <div>Reference: <span className="text-slate-200">{reference}</span></div>
              {order && <div>Order: <span className="text-slate-200">{order.orderNumber}</span></div>}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-check Verification Status</span>
              </button>

              <button
                onClick={handleReturnToStore}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                Return to Store
              </button>
            </div>
          </div>
        )}

        {/* Failed / Abandoned State */}
        {!loading && status === 'failed' && (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Payment Was Not Completed</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                {errorMessage || 'We could not verify your payment with Paystack.'}
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-left text-[11px] text-slate-400 space-y-1">
              <div>If money was deducted from your mobile wallet or card, please keep this reference handy:</div>
              <div className="font-mono text-slate-200 font-bold">{reference || 'N/A'}</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleReturnToStore}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-sm cursor-pointer transition-colors"
              >
                Back to Game Catalog
              </button>

              <a
                href={supportWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors block text-center"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact WhatsApp Support</span>
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
