/**
 * Admin Route Guard
 * Wraps ProtectedRoute and additionally checks is_admin.
 * Non-admins are redirected to /.
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import ProtectedRoute from '../auth/ProtectedRoute';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  // Delegate loading / unauthenticated handling to ProtectedRoute
  return (
    <ProtectedRoute>
      {/* After ProtectedRoute passes, check admin */}
      {isAuthenticated && !isLoading && user && !user.is_admin ? (
        <Navigate to="/" replace />
      ) : (
        <>{children}</>
      )}
    </ProtectedRoute>
  );
}
