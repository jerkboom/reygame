import React, { useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Info, Gamepad2 } from 'lucide-react';
import { ConsoleType, AccountTypeConfig } from '../types';

export const GameDetailModal: React.FC = () => {
  const {
    selectedGame,
    selectedConsole,
    setSelectedConsole,
    selectedAccountType,
    setSelectedAccountType,
    accountTypes,
    closeModal,
    openCheckout,
    openModal,
    formatUSD,
    formatGHS,
    convertToGHS,
    settings,
  } = useStore();

  useEffect(() => {
    if (selectedGame) {
      // If current console is not available for this game, switch to available one
      if (selectedConsole === 'PS5' && !selectedGame.ps5Available && selectedGame.ps4Available) {
        setSelectedConsole('PS4');
      } else if (selectedConsole === 'PS4' && !selectedGame.ps4Available && selectedGame.ps5Available) {
        setSelectedConsole('PS5');
      }
    }
  }, [selectedGame, selectedConsole, setSelectedConsole]);

  if (!selectedGame) return null;

  // Determine current USD price for active account type
  const currentPriceUSD = selectedAccountType
    ? (selectedGame.accountPrices[selectedAccountType.id as keyof typeof selectedGame.accountPrices] ?? selectedAccountType.defaultPriceUSD)
    : 15.0;

  const currentPriceGHS = convertToGHS(currentPriceUSD);

  const handleContinue = () => {
    if (!selectedAccountType) return;
    openCheckout(selectedGame, selectedConsole, selectedAccountType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Gamepad2 className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                {selectedGame.title}
              </h2>
              <p className="text-xs text-slate-400">
                Select Console & Account Type
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Game Summary Snippet */}
          <div className="flex flex-col sm:flex-row gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <img
              src={selectedGame.coverImage}
              alt={selectedGame.title}
              referrerPolicy="no-referrer"
              className="w-full sm:w-28 h-32 sm:h-24 object-cover rounded-lg shrink-0 border border-slate-800"
            />
            <div className="flex-1 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px] border border-blue-500/20">
                  {selectedGame.genre}
                </span>
                {selectedGame.publisher && (
                  <span className="text-slate-400 font-medium">
                    {selectedGame.publisher}
                  </span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed pt-1">
                {selectedGame.description}
              </p>
            </div>
          </div>

          {/* Step 1: Choose Console */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                Choose Console Platform
              </label>
              <span className="text-[11px] text-slate-400">
                Only supported console versions shown
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {selectedGame.ps5Available && (
                <button
                  type="button"
                  onClick={() => setSelectedConsole('PS5')}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    selectedConsole === 'PS5'
                      ? 'bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm font-black">PlayStation 5</div>
                    <div className="text-[11px] text-slate-400">Next-gen PS5 version</div>
                  </div>
                  {selectedConsole === 'PS5' && (
                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                  )}
                </button>
              )}

              {selectedGame.ps4Available && (
                <button
                  type="button"
                  onClick={() => setSelectedConsole('PS4')}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    selectedConsole === 'PS4'
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm font-black">PlayStation 4</div>
                    <div className="text-[11px] text-slate-400">PS4 standard version</div>
                  </div>
                  {selectedConsole === 'PS4' && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Choose Account Type */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                Choose Account Type & Sharing Option
              </label>
              <button
                onClick={() => openModal('terms')}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline"
              >
                Detailed Rules Guide
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accountTypes.map((acc) => {
                const isSelected = selectedAccountType?.id === acc.id;
                const priceUSD = selectedGame.accountPrices[acc.id as keyof typeof selectedGame.accountPrices] ?? acc.defaultPriceUSD;
                const priceGHS = convertToGHS(priceUSD);

                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountType(acc)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Badge */}
                    {acc.badge && (
                      <span className="absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow">
                        {acc.badge}
                      </span>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {acc.name}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1.5 py-1">
                        <span className="text-xl font-black text-white">
                          {formatUSD(priceUSD)}
                        </span>
                        <span className="text-xs font-semibold text-emerald-400 font-mono">
                          ({formatGHS(priceGHS)})
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {acc.description}
                      </p>
                    </div>

                    {/* Quick highlight feature */}
                    <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] flex items-center justify-between">
                      <span className="text-slate-400">
                        {acc.canChangeCredentials ? 'Full Credentials Ownership' : 'Play on Personal Profile'}
                      </span>
                      {isSelected ? (
                        <span className="text-blue-400 font-bold flex items-center gap-1">
                          Selected <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-slate-500">Select</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Account Rules Preview (Source-accurate) */}
          {selectedAccountType && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  Key Usage Rules for {selectedAccountType.name}
                </span>
                <span className="text-[10px] text-amber-400 font-medium">
                  Official Store Guidelines
                </span>
              </div>

              <ul className="text-xs text-slate-300 space-y-1.5 pl-1">
                {selectedAccountType.rules.slice(0, 4).map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Footer Checkout Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
          <div>
            <div className="text-[11px] text-slate-400">
              Checkout Total ({selectedConsole} • {selectedAccountType?.name})
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {formatUSD(currentPriceUSD)}
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                = {formatGHS(currentPriceGHS)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ($1 = GH₵{settings.exchangeRateUSDToGHS.toFixed(2)})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={closeModal}
              className="w-1/3 sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              id="continue-to-checkout-btn"
              onClick={handleContinue}
              disabled={!selectedAccountType}
              className="flex-1 sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-transform transform active:scale-95"
            >
              <span>Continue to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
