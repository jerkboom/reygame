import React from 'react';
import { useStore } from '../context/StoreContext';
import { MessageCircle } from 'lucide-react';

export const WhatsAppFloatingButton: React.FC = () => {
  const { settings } = useStore();
  const cleanNumber = (settings.supportWhatsApp || '').replace(/[^0-9]/g, '');

  if (!cleanNumber) {
    return null;
  }

  return (
    <aside aria-label="Support Contact" className="fixed bottom-6 right-6 z-40">
      <a
        href={`https://wa.me/${cleanNumber}?text=Hello%20${encodeURIComponent(settings.storeName)}%2C%20I%20need%20assistance`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 rounded-full shadow-2xl shadow-emerald-600/30 transition-all transform hover:scale-105"
        title="Chat with Store Support on WhatsApp"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-100" />
        </span>
        <MessageCircle className="w-5 h-5 text-white" />
        <span className="text-xs hidden sm:inline-block font-semibold">
          WhatsApp Support
        </span>
      </a>
    </aside>
  );
};
