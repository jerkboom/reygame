import React, { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Search, MessageCircle } from 'lucide-react';
import { FAQItem } from '../types';
import { initialFAQs } from '../data/initialData';
import { useStore } from '../context/StoreContext';
import { subscribeToFAQs } from '../lib/firebase';

export const FAQSection: React.FC = () => {
  const { settings } = useStore();
  const [faqs, setFaqs] = useState<FAQItem[]>(initialFAQs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [faqSearch, setFaqSearch] = useState('');

  useEffect(() => {
    fetch('/api/faqs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setFaqs(data);
          if (data.length > 0 && !openId) {
            setOpenId(data[0].id);
          }
        }
      })
      .catch(() => {});

    // Also subscribe to Firestore realtime
    const unsub = subscribeToFAQs((liveFaqs) => {
      if (Array.isArray(liveFaqs)) {
        setFaqs(liveFaqs);
        if (liveFaqs.length > 0 && !openId) {
          setOpenId(liveFaqs[0].id);
        }
      }
    });

    return () => unsub();
  }, []);

  const filteredFaqs = faqs.filter((item) => {
    if (!item.isActive) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (faqSearch.trim()) {
      const q = faqSearch.toLowerCase();
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-white">
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" />
          Frequently Asked Questions
        </div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
          Everything You Need to Know
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Clear answers about console sharing, account types, Paystack checkout, and support warranty.
        </p>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
          {['all', 'general', 'accounts', 'payment', 'warranty'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition-all ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'All Questions' : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={faqSearch}
            onChange={(e) => setFaqSearch(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div
              key={faq.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
              >
                <span className="font-bold text-sm text-slate-100">
                  {faq.question}
                </span>
                <span className="p-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/50 whitespace-pre-line animate-in fade-in duration-150">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}

        {filteredFaqs.length === 0 && (
          <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800 text-xs">
            No matching FAQ questions found. Need direct help?
          </div>
        )}
      </div>

      {/* Bottom Still Have Questions CTA */}
      <div className="mt-8 p-5 bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900/60 border border-blue-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h4 className="text-sm font-bold text-white">Have a specific question?</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Our team is available 7 days a week on WhatsApp to assist Ghanaian gamers.
          </p>
        </div>

        {settings.supportWhatsApp ? (
          <a
            href={`https://wa.me/${settings.supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%2C%20I%20have%20a%20question%20before%20ordering`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Ask on WhatsApp</span>
          </a>
        ) : (
          <span className="text-xs text-slate-500 italic">Support contact available once configured</span>
        )}
      </div>
    </section>
  );
};
