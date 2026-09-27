import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Gamepad2, Search, HelpCircle, FileText, Lock, MessageCircle, RefreshCw, X, LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    settings,
    searchQuery,
    setSearchQuery,
    openModal,
    isAdminLoggedIn,
    currentUser,
    myGames,
    openMyGames,
    loginWithGoogle,
    logoutCustomer,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trackInputOpen, setTrackInputOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderQuery.trim()) return;
    openModal('trackOrder');
    // Set into URL/tracking
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('order', orderQuery.trim());
    window.history.pushState({}, '', newUrl.toString());
    setTrackInputOpen(false);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await loginWithGoogle();
    } catch (err) {
      console.warn('Google sign-in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Store Name */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  {settings.storeName}
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    GH
                  </span>
                </span>
                <p className="text-[10px] text-slate-400 font-medium -mt-1 hidden sm:block">
                  PlayStation Digital Storefront
                </p>
              </div>
            </a>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-games-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games (e.g., GTA V, FC 26, Spider-Man)..."
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg pl-10 pr-9 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Nav Actions */}
          <div className="hidden lg:flex items-center gap-5">
            <a
              href="#games"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Games
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              How It Works
            </a>
            {settings.showTutorialVideos !== false && (
              <a
                href="#setup-tutorials"
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Setup Tutorials
              </a>
            )}
            <a
              href="#faq"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              FAQ
            </a>
            <button
              onClick={() => openModal('terms')}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              Rules & Terms
            </button>

            {/* Track Order Button */}
            <button
              id="nav-track-order-btn"
              onClick={() => setTrackInputOpen(!trackInputOpen)}
              className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 bg-blue-950/50 hover:bg-blue-900/50 px-3 py-1.5 rounded-lg border border-blue-800/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Track
            </button>

            {/* Customer Account & My Games */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  id="nav-my-games-btn"
                  onClick={openMyGames}
                  className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3.5 py-1.5 rounded-lg shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>My Games</span>
                  {myGames.length > 0 && (
                    <span className="bg-white/25 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
                      {myGames.length}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Customer'}
                      className="w-7 h-7 rounded-full border border-blue-500/40 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-900/60 border border-blue-500/40 flex items-center justify-center text-xs text-blue-300 font-bold">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <button
                    id="nav-logout-btn"
                    onClick={logoutCustomer}
                    title="Sign Out of Customer Account"
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 py-1 px-1.5 rounded hover:bg-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="nav-google-login-btn"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting...' : 'Sign In'}</span>
              </button>
            )}

            {/* WhatsApp Link */}
            <a
              href={`https://wa.me/${settings.supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(settings.storeName)}%2C%20I%20have%20an%20inquiry%20about%20a%20game`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Help
            </a>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setTrackInputOpen(!trackInputOpen)}
              className="text-xs text-blue-400 bg-blue-950/50 border border-blue-800/40 px-2.5 py-1.5 rounded-lg"
            >
              Track
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white"
            >
              <span className="sr-only">Open menu</span>
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className="w-full h-0.5 bg-current rounded" />
                <span className="w-full h-0.5 bg-current rounded" />
                <span className="w-full h-0.5 bg-current rounded" />
              </div>
            </button>
          </div>
        </div>

        {/* Track Order Quick Drawer / Popover */}
        {trackInputOpen && (
          <div className="py-3 px-4 bg-slate-900 border-t border-slate-800 animate-in fade-in slide-in-from-top-2">
            <form onSubmit={handleTrackSubmit} className="flex items-center gap-2 max-w-md mx-auto">
              <input
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Enter Order # (e.g., PSG-20260920-0001)..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
              >
                Track
              </button>
              <button
                type="button"
                onClick={() => setTrackInputOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Mobile menu expanded */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-800 space-y-3">
            {/* Mobile Customer Account Card */}
            <div className="px-2 pb-2">
              {currentUser ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {currentUser.photoURL ? (
                        <img
                          src={currentUser.photoURL}
                          alt=""
                          className="w-8 h-8 rounded-full border border-blue-500/40 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-900/60 border border-blue-500/40 flex items-center justify-center text-xs text-blue-300 font-bold">
                          {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-white truncate max-w-[160px]">
                          {currentUser.displayName || 'Google Customer'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logoutCustomer();
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded"
                    >
                      <LogOut className="w-3 h-3" />
                      Sign Out
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openMyGames();
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>My Games & Purchases</span>
                    {myGames.length > 0 && (
                      <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                        {myGames.length}
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleGoogleSignIn();
                  }}
                  disabled={isSigningIn}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google ($1 Off 1st Game)</span>
                </button>
              )}
            </div>

            <div className="px-2 pb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex flex-col gap-2 px-2">
              <a
                href="#games"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-slate-300 py-1.5"
              >
                Games Catalog
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-slate-300 py-1.5"
              >
                How It Works
              </a>
              {settings.showTutorialVideos !== false && (
                <a
                  href="#setup-tutorials"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium text-slate-300 py-1.5"
                >
                  PSN Setup Tutorials
                </a>
              )}
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-slate-300 py-1.5"
              >
                FAQ & Help
              </a>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openModal('terms');
                }}
                className="text-left text-sm font-medium text-slate-300 py-1.5"
              >
                Account Rules & Terms
              </button>
              <a
                href={`https://wa.me/${settings.supportWhatsApp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5 py-1.5"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Support
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
