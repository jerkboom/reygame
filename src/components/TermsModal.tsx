import React from 'react';
import { useStore } from '../context/StoreContext';
import { X, ShieldAlert, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';

export const TermsModal: React.FC = () => {
  const { activeModal, closeModal, settings } = useStore();

  if (activeModal !== 'terms') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 text-xs">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                PlayStation Account Rules & Terms of Service
              </h2>
              <p className="text-xs text-slate-400">
                Official Guidelines for Primary, Secondary & Sharing Options
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-300 leading-relaxed flex-1">
          
          {/* Disclaimer Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold block text-amber-300">
                Independent Digital Gaming Storefront Notice
              </span>
              <p className="text-amber-200/90 leading-relaxed">
                {settings.storeName} is an independent digital game and account provider. This store is neither endorsed, authorized, nor affiliated with Sony Interactive Entertainment Inc. or PlayStation. All registered trademarks belong to their respective owners.
              </p>
            </div>
          </div>

          {/* Section 1: Primary Account Rules */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              1. Primary Account Rules & Guidelines
            </h3>
            <ul className="space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Play on Your Personal Account:</strong> You can play the purchased game directly on your own personal PlayStation profile/account with your own PSN ID, trophies, and online saves.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Do Not Change Account Credentials:</strong> You must not change any account information, including email, password, online ID, or security details.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Single Console Rule:</strong> Do not log in to the provided account on multiple consoles.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Do Not Modify Security:</strong> Do not disable Two-Factor Authentication (2FA) or attempt to alter account recovery settings.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Console Generation Strictness:</strong> PS4 accounts must not be installed or activated on PS5 consoles.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Hardware / Console Changes:</strong> Contact store support before repairing, replacing, selling your console, changing the hard drive, or transferring data.</span>
              </li>
            </ul>
          </div>

          {/* Section 2: Secondary Account Rules */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              2. Secondary Account Rules & Guidelines
            </h3>
            <ul className="space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span><strong>Do Not Activate as Primary:</strong> Keep the account inactive as Primary on your console (Console Sharing & Offline Play must remain disabled).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span><strong>Play Through the Provided Profile:</strong> Launch and play the game directly through the provided account profile.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span><strong>Internet Connection Required:</strong> An active internet connection is required on your console while playing secondary accounts.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span><strong>No Modifications:</strong> Do not change email, password, online ID, or security information.</span>
              </li>
            </ul>
          </div>

          {/* Section 3: Sharing Options & Full Private */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              3. Sharing Options & Full Private Ownership
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <strong className="text-white block mb-1">Primary — Shared</strong>
                <p className="text-[11px] text-slate-400">
                  Shared between two players. One uses the Primary console activation, allowing you to play on your personal account.
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <strong className="text-white block mb-1">Primary — Non-Sharing</strong>
                <p className="text-[11px] text-slate-400">
                  Solo dedicated usage of the Primary option. Exclusively one customer uses the console slot.
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <strong className="text-white block mb-1">Full Private</strong>
                <p className="text-[11px] text-slate-400">
                  Full private access. As stated in our source guidelines, the customer is permitted to change the email and password to their own credentials.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: General Installation Rules */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              4. Installation Best Practices
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300">
              <li>Do not sign out of the provided profile after initial game installation.</li>
              <li>Do not log in to the account as a "Guest" user.</li>
              <li>If you experience a temporary lock, try reactivating the account license in console settings or contact our support team.</li>
              <li>Do not delete the profile from your console after installation.</li>
            </ul>
          </div>

          {/* Section 5: Warranty & Guarantees */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              5. Warranty & Support Claims
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              All digital orders are covered under our store support warranty subject strictly to adherence to the terms and usage guidelines above. Our warranty is subject to these Terms & Conditions and applicable PlayStation/Sony platform policies. We do not advertise or make an absolute official Sony-backed guarantee.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={closeModal}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl text-xs"
          >
            I Understand & Agree
          </button>
        </div>

      </div>
    </div>
  );
};
