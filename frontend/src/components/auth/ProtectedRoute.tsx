/**
 * Protected Route Component
 * 路由守卫组件 - 保护需要认证的路由
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerified?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requireEmailVerified = false 
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Email verification required but not verified
  if (requireEmailVerified && user && !user.email_verified) {
    return <Navigate to="/verify-email-required" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
