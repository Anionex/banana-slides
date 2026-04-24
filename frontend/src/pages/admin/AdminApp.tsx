import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { adminApi } from '../../api/admin';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminUsers } from './AdminUsers';
import { AdminSubscriptions } from './AdminSubscriptions';
import { AdminTransactions } from './AdminTransactions';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminAccount } from './AdminAccount';
import { AdminPricing } from './AdminPricing';

function ProtectedLayout() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated());
  const accessToken = useAdminStore((s) => s.accessToken);
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const logout = useAdminStore((s) => s.logout);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !accessToken) {
      setIsVerifying(false);
      return;
    }

    const verifyAdminSession = async () => {
      try {
        const res = await adminApi.getMe();
        if (!cancelled) {
          setAdmin(res.data.data);
          setIsVerifying(false);
        }
      } catch {
        if (!cancelled) {
          logout();
          setIsVerifying(false);
        }
      }
    };

    verifyAdminSession();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isAuthenticated, logout, setAdmin]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 border-2 border-[var(--banana-yellow)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!useAdminStore.getState().isAuthenticated()) return <Navigate to="/login" replace />;
  return <AdminLayout hideBackButton />;
}

export function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<AdminLoginGuard />} />
        <Route element={<ProtectedLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="account" element={<AdminAccount />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// Redirect to dashboard if already logged in
function AdminLoginGuard() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated());
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <AdminLogin />;
}
