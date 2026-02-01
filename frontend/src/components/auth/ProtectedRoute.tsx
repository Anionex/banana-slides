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
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  // Still checking auth status - show loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-banana-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-foreground-secondary">加载中...</p>
        </div>
      </div>
    );
  }

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
