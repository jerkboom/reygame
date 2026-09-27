import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

export const AdminAccessDenied: React.FC = () => {
  const { currentUser, settings } = useStore();
  const storeName = settings.storeName || 'ReyGames';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-red-600 selection:text-white">
      {/* Top return bar */}
      <div className="w-full max-w-lg mx-auto pt-2 flex items-center justify-between text-xs text-slate-500">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 hover:text-slate-300 transition-colors py-1 px-2 rounded hover:bg-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to {storeName} Store</span>
        </a>
        <span className="font-mono text-[10px] text-red-500 font-bold uppercase tracking-wider">
          ACCESS CONTROL: 403 FORBIDDEN
        </span>
      </div>

      {/* Center card */}
      <div className="w-full max-w-lg mx-auto my-auto py-8">
        <div className="bg-slate-900 border border-red-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-xl bg-red-950/70 border border-red-800/60 text-red-400 mb-1">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Access Denied
            </h1>
            <p className="text-sm font-semibold text-red-300 uppercase tracking-wider text-xs">
              Administrator Authorization Required
            </p>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              The Administration Portal is a secured management console reserved exclusively for store operators.
              {currentUser && (
                <span className="block mt-2 text-slate-400">
                  You are signed in as customer <strong className="text-white font-mono">{currentUser.email}</strong>. Customer accounts do not have access to administrative operations.
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <a
              href="/admin/login"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition text-center"
            >
              <LogIn className="w-4 h-4" />
              <span>Admin Sign In</span>
            </a>
            <a
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition text-center"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Store</span>
            </a>
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg mx-auto text-center pb-2 text-[11px] text-slate-600">
        © {new Date().getFullYear()} {storeName} Administration Console
      </div>
    </div>
  );
};
