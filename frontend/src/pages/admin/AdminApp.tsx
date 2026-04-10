import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAdminStore } from '../../store/useAdminStore';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminUsers } from './AdminUsers';
import { AdminSubscriptions } from './AdminSubscriptions';
import { AdminTransactions } from './AdminTransactions';
import { SettingsPage } from '../Settings';

function ProtectedLayout() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
          <Route path="settings" element={<SettingsPage />} />
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
