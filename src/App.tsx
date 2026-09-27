import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { GameCatalog } from './components/GameCatalog';
import { TutorialVideosSection } from './components/TutorialVideosSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { FAQSection } from './components/FAQSection';
import { Footer } from './components/Footer';
import { GameDetailModal } from './components/GameDetailModal';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackingView } from './components/OrderTrackingView';
import { TermsModal } from './components/TermsModal';
import { MyGamesModal } from './components/MyGamesModal';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { AdminRouter } from './components/admin/AdminRouter';

import { PaymentCallback } from './components/PaymentCallback';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeModal, setTrackingOrder } = useStore();
  const [isPaymentCallback, setIsPaymentCallback] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    return path.includes('/payment/callback') || params.has('reference') || params.has('trxref');
  });

  const [paymentNotice, setPaymentNotice] = React.useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const reason = params.get('reason') || params.get('error');

    if (payment === 'confirmed') {
      return {
        type: 'success',
        title: 'Payment Confirmed!',
        message: 'Your payment was verified. Your order is queued for instant digital fulfillment.',
      };
    }
    if (payment === 'failed') {
      return {
        type: 'error',
        title: 'Payment Unsuccessful',
        message: reason === 'order_not_found'
          ? 'Order could not be matched. If funds were deducted, please message our WhatsApp support immediately.'
          : 'Payment could not be completed. You can try checkout again or choose another payment method.',
      };
    }
    if (payment === 'abandoned') {
      return {
        type: 'warning',
        title: 'Checkout Incomplete',
        message: 'You exited before completing payment. You can select your game and try again anytime.',
      };
    }
    if (payment === 'mismatch') {
      return {
        type: 'error',
        title: 'Security Verification Alert',
        message: 'Payment amount mismatch detected. Please contact our support team on WhatsApp for verification.',
      };
    }
    return null;
  });

  // Check URL query parameters for direct order tracking: ?order=PSG-XXXXX&token=XXXXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const token = params.get('token');
    if (orderId) {
      setTrackingOrder(orderId, token || '');
    }
  }, [setTrackingOrder]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Announcement Bar */}
      <AnnouncementBar />

      {/* Post-Payment Status Notification Banner */}
      {paymentNotice && (
        <div
          className={`border-b px-4 py-2.5 flex items-center justify-between text-xs transition-colors ${
            paymentNotice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : paymentNotice.type === 'warning'
              ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
              : 'bg-red-950/80 border-red-500/40 text-red-200'
          }`}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {paymentNotice.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : paymentNotice.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>
                <strong className="font-semibold">{paymentNotice.title}: </strong>
                {paymentNotice.message}
              </span>
            </div>
            <button
              onClick={() => setPaymentNotice(null)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1">
        <HeroBanner />
        <GameCatalog />
        <TutorialVideosSection />
        <HowItWorksSection />
        <FAQSection />
      </main>

      {/* Footer */}
      <Footer />

      {/* Floating Quick WhatsApp Action */}
      <WhatsAppFloatingButton />

      {/* Dynamic Modals */}
      {isPaymentCallback && <PaymentCallback onClose={() => setIsPaymentCallback(false)} />}
      {activeModal === 'gameDetail' && <GameDetailModal />}
      {activeModal === 'checkout' && <CheckoutModal />}
      {activeModal === 'trackOrder' && <OrderTrackingView />}
      {activeModal === 'terms' && <TermsModal />}
      {activeModal === 'myGames' && <MyGamesModal />}
    </div>
  );
};

export default function App() {
  const [currentPath, setCurrentPath] = React.useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  return (
    <StoreProvider>
      {isAdminRoute ? <AdminRouter /> : <MainLayout />}
    </StoreProvider>
  );
}
