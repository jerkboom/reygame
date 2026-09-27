import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Shield, Lock, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { isAdminLoggedIn, setAdminLoggedIn, settings } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // If administrator is already logged in with a valid session, navigate to /admin
  useEffect(() => {
    localStorage.removeItem('reygames_admin_token');
    if (isAdminLoggedIn) {
      window.location.replace('/admin');
    }
  }, [isAdminLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both administrator email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      setAdminLoggedIn(true, data.adminUser || email.trim());
      // Successful login lands on /admin
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const storeName = settings.storeName || 'ReyGames';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top minimal return bar */}
      <div className="w-full max-w-md mx-auto pt-2 flex items-center justify-between text-xs text-slate-500">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 hover:text-slate-300 transition-colors py-1 px-2 rounded hover:bg-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to {storeName} Store</span>
        </a>
        <span className="font-mono text-[10px] text-slate-600">SECURE CONSOLE v2.0</span>
      </div>

      {/* Center login card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Subtle accent border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-xl bg-blue-950/70 border border-blue-800/50 text-blue-400 mb-1">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {storeName}
            </h1>
            <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider text-xs">
              Administration Portal
            </p>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-red-950/40 border border-red-800/40 text-red-300 text-[11px] font-medium">
              Authorized personnel only
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="bg-red-950/50 border border-red-800/60 rounded-xl p-3 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Administrator Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@reygames.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Bottom Security Notice */}
          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Protected by multi-layer cryptographic token verification and rate limiting.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="w-full max-w-md mx-auto text-center pb-2 text-[11px] text-slate-600">
        © {new Date().getFullYear()} {storeName} Administration Console
      </div>
    </div>
  );
};
