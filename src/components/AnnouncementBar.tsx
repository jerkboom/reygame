import React from 'react';
import { useStore } from '../context/StoreContext';
import { ShieldCheck, ArrowRightLeft } from 'lucide-react';

export const AnnouncementBar: React.FC = () => {
  const { settings } = useStore();

  return (
    <aside aria-label="Store Announcement" id="announcement-bar" className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-slate-100 text-xs py-2 px-4 border-b border-indigo-500/20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3 mr-1" /> Verified Paystack Merchant
          </span>
          <span className="font-medium tracking-wide text-slate-200">
            {settings.announcement}
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px] bg-black/40 px-3 py-1 rounded-md border border-white/5">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
            <span className="text-slate-400">Exchange Rate:</span>
            <span className="font-semibold text-white">
              $1.00 USD = GH₵ {settings.exchangeRateUSDToGHS.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
