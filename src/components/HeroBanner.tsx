import React from 'react';
import { useStore } from '../context/StoreContext';
import { Gamepad2, ArrowDown, DollarSign, Clock, Smartphone, FileText } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const { settings, openModal } = useStore();

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white pt-12 pb-18 sm:pt-16 sm:pb-22 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
      {/* Background ambient lighting accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-40 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 text-center space-y-7 sm:space-y-8">
        {/* Category Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-wide">
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>PS5 & PS4 Digital Games in Ghana</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight sm:leading-tight max-w-4xl mx-auto text-white">
          {settings.bannerTitle || 'Play More. Pay Less in Ghana.'}
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
          {settings.bannerSubtitle || 'Get verified PS4 & PS5 digital games priced in USD, converted transparently at checkout to GHS with Ghana Paystack.'}
        </p>

        {/* Quick Selling Value Badges (3 Balanced Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto text-left pt-2">
          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all rounded-2xl p-4 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span>USD Store Prices</span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Fair global pricing from $10.00
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all rounded-2xl p-4 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span>Ghana Paystack</span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              MTN MoMo, Telecel & Cards
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all rounded-2xl p-4 shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span>~30 Min Delivery</span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Fast account setup & support
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <a
            href="#games"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 text-sm"
          >
            Browse Available Games
            <ArrowDown className="w-4 h-4" />
          </a>

          <a
            href="#how-it-works"
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
          >
            How It Works
          </a>

          <button
            onClick={() => openModal('terms')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4 font-medium transition-colors cursor-pointer px-2 py-1"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Read Account Rules & PSN Guide</span>
          </button>
        </div>
      </div>
    </section>
  );
};

