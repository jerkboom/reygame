import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  X,
  Gamepad2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  LogOut,
  ShoppingBag,
  Sparkles,
  Play,
  HelpCircle,
} from 'lucide-react';
import { Order } from '../types';

export const MyGamesModal: React.FC = () => {
  const {
    currentUser,
    myGames,
    isLoadingMyGames,
    fetchMyGames,
    closeModal,
    openModal,
    setTrackingOrder,
    logoutCustomer,
    settings,
    formatUSD,
    formatGHS,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'ALL' | 'FULFILLED' | 'IN_PROGRESS'>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 text-white">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Customer Account Required</h2>
            <p className="text-sm text-slate-400 mt-1.5">
              Sign in with your Google account to access your private game library, digital delivery credentials, and purchase history.
            </p>
          </div>
          <button
            onClick={() => closeModal()}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePasswordVisibility = (orderId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMyGames(currentUser);
    setIsRefreshing(false);
  };

  const fulfilledGames = myGames.filter((o) => o.orderStatus === 'FULFILLED');
  const inProgressGames = myGames.filter((o) => o.orderStatus !== 'FULFILLED' && o.orderStatus !== 'CANCELLED');

  const filteredGames = myGames.filter((order) => {
    if (activeTab === 'FULFILLED') return order.orderStatus === 'FULFILLED';
    if (activeTab === 'IN_PROGRESS') return order.orderStatus !== 'FULFILLED' && order.orderStatus !== 'CANCELLED';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white shrink-0">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  My Games & Private Purchases
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Verified Account
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                Logged in as <span className="text-slate-200 font-medium">{currentUser.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingMyGames}
              className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Refresh Purchases"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoadingMyGames ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => logoutCustomer()}
              className="text-xs text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Sign Out of Customer Account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              onClick={closeModal}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            All Purchases ({myGames.length})
          </button>
          <button
            onClick={() => setActiveTab('FULFILLED')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'FULFILLED'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Ready to Play ({fulfilledGames.length})
          </button>
          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Fulfilling Delivery ({inProgressGames.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoadingMyGames && myGames.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-medium">Loading your verified games & credentials...</p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                <Gamepad2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {activeTab === 'ALL'
                    ? 'No Games in Your Vault Yet'
                    : activeTab === 'FULFILLED'
                    ? 'No Fulfilled Games Yet'
                    : 'No Orders Currently In Progress'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  {activeTab === 'ALL'
                    ? 'Games you purchase with this Google account will automatically appear here with private 24/7 access to your PSN account credentials and setup guides.'
                    : 'Once your orders are verified and fulfilled by our team, their credentials will immediately unlock here.'}
                </p>
              </div>

              {activeTab === 'ALL' && (
                <button
                  onClick={() => {
                    closeModal();
                    const el = document.getElementById('games');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Browse Game Catalog</span>
                </button>
              )}
            </div>
          ) : (
            filteredGames.map((order) => {
              const isFulfilled = order.orderStatus === 'FULFILLED';
              const isAwaiting = order.orderStatus === 'AWAITING_FULFILLMENT' || order.orderStatus === 'PAID';
              const isProcessing = order.orderStatus === 'PROCESSING';
              const isPendingPayment = order.orderStatus === 'PENDING_PAYMENT';
              const delivery = order.deliveryInformation;
              const isPassRevealed = Boolean(revealedPasswords[order.id]);

              return (
                <div
                  key={order.id}
                  className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-700/80 transition-colors"
                >
                  {/* Card Top: Game Snapshot & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      {order.gameCoverSnapshot ? (
                        <img
                          src={order.gameCoverSnapshot}
                          alt={order.gameTitleSnapshot}
                          className="w-14 h-18 sm:w-16 sm:h-20 rounded-xl object-cover border border-slate-800 shadow-md shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-14 h-18 sm:w-16 sm:h-20 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                          <Gamepad2 className="w-6 h-6 text-slate-600" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              order.console === 'PS5'
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {order.console}
                          </span>
                          <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                            {order.accountTypeSnapshot || 'Digital Account'}
                          </span>
                          {order.discountStatus === 'APPLIED' && (
                            <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> $1.00 Off Applied
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                          {order.gameTitleSnapshot}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
                          <span>
                            Order:{' '}
                            <button
                              onClick={() => handleCopy(order.orderNumber, `ord_${order.id}`)}
                              className="text-slate-300 hover:text-white inline-flex items-center gap-1 font-semibold underline decoration-dotted"
                              title="Click to copy Order #"
                            >
                              {order.orderNumber}
                              {copiedKey === `ord_${order.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500" />
                              )}
                            </button>
                          </span>
                          <span>•</span>
                          <span className="text-slate-300 font-semibold font-sans">
                            {formatGHS(order.amountGHS)}
                          </span>
                          <span>•</span>
                          <span className="font-sans text-[11px] text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="sm:text-right shrink-0">
                      {isFulfilled ? (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Ready to Play</span>
                        </div>
                      ) : isProcessing ? (
                        <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold">
                          <Clock className="w-4 h-4 animate-spin text-blue-400" />
                          <span>Processing Account</span>
                        </div>
                      ) : isAwaiting ? (
                        <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>Awaiting Fulfillment</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-medium">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          <span>Payment Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery & Credentials Section */}
                  {isFulfilled && delivery ? (
                    <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 space-y-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            PlayStation Login Credentials
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-medium">
                          Fulfillment Complete
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* PSN Email */}
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                          <div className="overflow-hidden pr-2">
                            <span className="text-[10px] text-slate-400 font-medium block">
                              PlayStation Account Email / ID
                            </span>
                            <span className="text-xs font-mono font-semibold text-white truncate block">
                              {delivery.accountEmail || 'Contact support'}
                            </span>
                          </div>
                          {delivery.accountEmail && (
                            <button
                              onClick={() => handleCopy(delivery.accountEmail, `email_${order.id}`)}
                              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
                              title="Copy PSN Email"
                            >
                              {copiedKey === `email_${order.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* PSN Password */}
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                          <div className="overflow-hidden pr-2">
                            <span className="text-[10px] text-slate-400 font-medium block">
                              Password
                            </span>
                            <span className="text-xs font-mono font-semibold text-white tracking-wider truncate block">
                              {isPassRevealed ? delivery.accountPassword : '••••••••••••'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => togglePasswordVisibility(order.id)}
                              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                              title={isPassRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isPassRevealed ? (
                                <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </button>
                            {delivery.accountPassword && (
                              <button
                                onClick={() => handleCopy(delivery.accountPassword, `pass_${order.id}`)}
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                title="Copy Password"
                              >
                                {copiedKey === `pass_${order.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Backup Code (if available) */}
                      {delivery.backupCodes && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              2FA Backup / Verification Code
                            </span>
                            <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
                              {delivery.backupCodes}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(delivery.backupCodes!, `code_${order.id}`)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
                            title="Copy 2FA Code"
                          >
                            {copiedKey === `code_${order.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Instructions & Warnings */}
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1.5">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                          <span>PlayStation Setup Instructions:</span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          {delivery.setupInstructions ||
                            '1. Add user on your console using the credentials above. 2. Go to Game Library and begin downloading. 3. Play according to your account type rules (Primary vs Secondary).'}
                        </p>
                        <p className="text-[10px] text-amber-400/90 font-medium">
                          ⚠️ Security Reminder: Do NOT alter login credentials, email, or security settings on shared accounts. Violations result in automatic account revocation.
                        </p>
                      </div>

                      {/* Video Tutorial Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <a
                          href={
                            order.console === 'PS5'
                              ? settings.ps5TutorialUrl || '#setup-tutorials'
                              : settings.ps4TutorialUrl || '#setup-tutorials'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          <Play className="w-3.5 h-3.5 text-red-500 fill-current" />
                          <span>Watch {order.console} Setup Video Tutorial</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </a>

                        <button
                          onClick={() => setTrackingOrder(order.id, order.secureToken)}
                          className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <span>View Full Receipt</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* In Progress Box */
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold">
                        <Clock className="w-4 h-4" />
                        <span>Credentials Being Provisioned by Delivery Team</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Your account credentials are being prepared securely and will automatically unlock right here as soon as fulfillment is verified (usually within 5–15 minutes).
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <a
                          href={`https://wa.me/${settings.supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%2C%20I%20placed%20order%20${encodeURIComponent(order.orderNumber)}%20for%20${encodeURIComponent(order.gameTitleSnapshot)}.%20Please%20expedite%20fulfillment.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Delivery Expedite ({order.orderNumber})</span>
                        </a>

                        <button
                          onClick={() => setTrackingOrder(order.id, order.secureToken)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          Track Receipt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>End-to-end customer isolation: only you can view games linked to this Google ID.</span>
          </div>
          <button
            onClick={closeModal}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            Back to Catalog
          </button>
        </div>

      </div>
    </div>
  );
};
