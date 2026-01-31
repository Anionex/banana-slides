import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { History } from './pages/History';
import { OutlineEditor } from './pages/OutlineEditor';
import { DetailEditor } from './pages/DetailEditor';
import { SlidePreview } from './pages/SlidePreview';
import { SettingsPage } from './pages/Settings';
import { 
  LoginPage, 
  RegisterPage, 
  ForgotPasswordPage, 
  ResetPasswordPage, 
  VerifyEmailPage 
} from './pages/auth';
import { ProtectedRoute } from './components/auth';
import { useProjectStore } from './store/useProjectStore';
import { useAuthStore } from './store/useAuthStore';
import { useToast } from './components/shared';
import { setupAuthInterceptor, checkAuth } from './api/auth';

// Setup auth interceptor on app load
setupAuthInterceptor();

function App() {
  const { currentProject, syncProject, error, setError } = useProjectStore();
  const { isAuthenticated, setLoading } = useAuthStore();
  const { show, ToastContainer } = useToast();

  // Check auth status on app load
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await checkAuth();
      setLoading(false);
    };
    initAuth();
  }, [setLoading]);

  // 恢复项目状态
  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && !currentProject && isAuthenticated) {
      syncProject();
    }
  }, [currentProject, syncProject, isAuthenticated]);

  // 显示全局错误
  useEffect(() => {
    if (error) {
      show({ message: error, type: 'error' });
      setError(null);
    }
  }, [error, setError, show]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/landing" element={<Landing />} />
        
        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/project/:projectId/outline" element={
          <ProtectedRoute>
            <OutlineEditor />
          </ProtectedRoute>
        } />
        <Route path="/project/:projectId/detail" element={
          <ProtectedRoute>
            <DetailEditor />
          </ProtectedRoute>
        } />
        <Route path="/project/:projectId/preview" element={
          <ProtectedRoute>
            <SlidePreview />
          </ProtectedRoute>
        } />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;

