import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminAccessDenied } from './AdminAccessDenied';
import { AdminPortal } from './AdminPortal';

export const AdminRouter: React.FC = () => {
  const { isAdminLoggedIn, setAdminLoggedIn, currentUser } = useStore();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [isVerifying, setIsVerifying] = useState(true);

  // Sync with browser URL changes
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Verify server-side session validity on mount via secure cookie
  useEffect(() => {
    localStorage.removeItem('reygames_admin_token');

    fetch('/api/admin/session', {
      credentials: 'include',
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Session invalid or revoked');
      })
      .then((data) => {
        if (data.authenticated) {
          setAdminLoggedIn(true, data.adminUser || 'Store Administrator');
        } else {
          setAdminLoggedIn(false);
        }
      })
      .catch(() => {
        setAdminLoggedIn(false);
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [setAdminLoggedIn]);

  // 1. Dedicated Admin Login Route (/admin/login)
  if (currentPath === '/admin/login' || currentPath.startsWith('/admin/login')) {
    return <AdminLoginPage />;
  }

  // 2. Loading state while verifying token against server API
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying administrator authorization...</span>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated or Customer Account Gate
  if (!isAdminLoggedIn) {
    // If user is currently signed in as a regular Google customer, show ACCESS DENIED
    if (currentUser) {
      return <AdminAccessDenied />;
    }

    // If anonymous visitor, render the dedicated admin login page
    return <AdminLoginPage />;
  }

  // 4. Authenticated Administrator: Render standalone Admin Management Console!
  return <AdminPortal isStandalone={true} />;
};
