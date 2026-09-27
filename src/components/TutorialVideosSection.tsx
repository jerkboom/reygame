import React from 'react';
import { useStore } from '../context/StoreContext';
import { getYouTubeEmbedUrl } from '../lib/youtube';
import { Play, Sparkles, CheckCircle2, Tv, Gamepad, HelpCircle, FileText } from 'lucide-react';

export const TutorialVideosSection: React.FC = () => {
  const { settings, openModal } = useStore();

  // If disabled by administrator in Admin Settings, do not render
  if (settings.showTutorialVideos === false) {
    return null;
  }

  // Fallbacks to user-provided specifications
  const sectionTitle = settings.tutorialSectionTitle || 'How to Set Up Your PSN Account';
  const sectionSubtitle =
    settings.tutorialSectionSubtitle ||
    'Need help setting up your PlayStation account? Watch our quick PS4 or PS5 tutorial before getting started.';

  const ps5Title = settings.ps5TutorialTitle || 'PS5 Account Setup';
  const ps5Url = settings.ps5TutorialUrl || 'https://youtu.be/xiz5uyCTjBk';
  const ps5Desc = settings.ps5TutorialDesc || 'Learn how to add and set up your PSN account on PS5.';
  const ps5EmbedUrl = getYouTubeEmbedUrl(ps5Url);

  const ps4Title = settings.ps4TutorialTitle || 'PS4 Account Setup';
  const ps4Url = settings.ps4TutorialUrl || 'https://youtu.be/TmaGY511fxA';
  const ps4Desc = settings.ps4TutorialDesc || 'Learn how to add and set up your PSN account on PS4.';
  const ps4EmbedUrl = getYouTubeEmbedUrl(ps4Url);

  return (
    <section
      id="setup-tutorials"
      className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950/80 border-t border-slate-800 text-white relative overflow-hidden"
    >
      {/* Subtle PlayStation themed background glow accents */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Play className="w-3 h-3 fill-blue-400 text-blue-400" />
            Official Setup Guides
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            {sectionTitle}
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            {sectionSubtitle}
          </p>
        </div>

        {/* 2-Card Responsive Grid (Side-by-side on desktop, stacked on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* CARD 1: PS5 Account Setup */}
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all duration-300 shadow-xl overflow-hidden flex flex-col h-full group">
            {/* Card Header & Badge */}
            <div className="p-5 pb-4 border-b border-slate-800/80 bg-slate-900/40 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-sm">
                    PS5
                  </span>
                  <span className="text-xs text-blue-400 font-semibold tracking-wide">
                    Next-Gen Console
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight pt-0.5">
                  {ps5Title}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 transition-colors shrink-0">
                <Tv className="w-4 h-4" />
              </div>
            </div>

            {/* Embedded YouTube Video Container */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
                {ps5EmbedUrl ? (
                  <iframe
                    src={ps5EmbedUrl}
                    title={ps5Title}
                    className="w-full h-full border-0 absolute inset-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                    <HelpCircle className="w-8 h-8 mb-2" />
                    <p className="text-xs">Tutorial video player unavailable.</p>
                  </div>
                )}
              </div>

              {/* Description & Key Points */}
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {ps5Desc}
                </p>

                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quick PS5 Checklist:
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Select <strong>Add User</strong> on the PS5 home screen (do not play as guest).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Enable <strong>Console Sharing and Offline Play</strong> in Settings.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Start downloading from <strong>Game Library</strong>, then switch to your own PSN ID.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: PS4 Account Setup */}
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all duration-300 shadow-xl overflow-hidden flex flex-col h-full group">
            {/* Card Header & Badge */}
            <div className="p-5 pb-4 border-b border-slate-800/80 bg-slate-900/40 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                    PS4
                  </span>
                  <span className="text-xs text-blue-400 font-semibold tracking-wide">
                    Classic Console
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight pt-0.5">
                  {ps4Title}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 transition-colors shrink-0">
                <Gamepad className="w-4 h-4" />
              </div>
            </div>

            {/* Embedded YouTube Video Container */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
                {ps4EmbedUrl ? (
                  <iframe
                    src={ps4EmbedUrl}
                    title={ps4Title}
                    className="w-full h-full border-0 absolute inset-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                    <HelpCircle className="w-8 h-8 mb-2" />
                    <p className="text-xs">Tutorial video player unavailable.</p>
                  </div>
                )}
              </div>

              {/* Description & Key Points */}
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {ps4Desc}
                </p>

                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quick PS4 Checklist:
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Choose <strong>New User</strong> &gt; <strong>Create a User</strong> (accept User Agreement).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Set as <strong>Primary PS4</strong> under Account Management &gt; Activate.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Add purchased games to download queue and switch back to your main account.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Helpful Advice / Rules & WhatsApp Note */}
        <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="leading-relaxed">
              <strong>Need a reminder on rules?</strong> Never change account passwords or delete the user profile after downloading.
            </p>
          </div>
          <button
            onClick={() => openModal('terms')}
            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4 cursor-pointer shrink-0 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Read Complete Account Rules</span>
          </button>
        </div>
      </div>
    </section>
  );
};
