import React from 'react';
import { useStore } from '../context/StoreContext';
import { Gamepad2, ShieldCheck, Mail, MessageCircle, Lock } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings, openModal } = useStore();

  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-xs pt-12 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="text-base font-black tracking-tight text-white">
                {settings.storeName}
              </span>
            </div>
            <p className="text-slate-400 max-w-sm leading-relaxed text-xs">
              Ghana-focused digital gaming storefront providing accessible PS4 & PS5 digital games priced in USD and seamlessly settled in GHS via Paystack.
            </p>
            <div className="text-[11px] text-slate-500 leading-relaxed max-w-md pt-1">
              Disclaimer: {settings.storeName} is an independent digital game seller. Not affiliated with, endorsed by, or authorized by Sony Interactive Entertainment Inc. PlayStation, PS4, and PS5 are trademarks of Sony Interactive Entertainment Inc.
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Store Navigation
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a href="#games" className="hover:text-white transition-colors">Available Games</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#setup-tutorials" className="hover:text-white transition-colors">Setup Guides & Videos</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">FAQs & Support</a>
              </li>
              <li>
                <button onClick={() => openModal('terms')} className="hover:text-white transition-colors">
                  Account Rules & Terms
                </button>
              </li>
              <li>
                <button onClick={() => openModal('trackOrder')} className="hover:text-white text-blue-400 transition-colors">
                  Track Your Order
                </button>
              </li>
            </ul>
          </div>

          {/* Support & Admin */}
          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
              Customer Support
            </h4>
            <div className="space-y-2 text-xs">
              {settings.supportWhatsApp && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>{settings.supportWhatsApp}</span>
                </div>
              )}
              {settings.supportEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span>{settings.supportEmail}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Payment Channels & Copyright */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verified Ghana Paystack Gateway:
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono">MTN MoMo</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono">Telecel Cash</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono">Visa / Mastercard</span>
          </div>

          <div>
            © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};
