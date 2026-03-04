import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { History } from './pages/History';
import { OutlineEditor } from './pages/OutlineEditor';
import { DetailEditor } from './pages/DetailEditor';
import { SlidePreview } from './pages/SlidePreview';
import { SettingsPage } from './pages/Settings';
import { PricingPage } from './pages/PricingPage';
import { CreditsHistory } from './pages/CreditsHistory';
import { InvitationPage } from './pages/InvitationPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AnnouncementPopup from './components/announcements/AnnouncementPopup';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
  ChangePasswordPage
} from './pages/auth';
import OIDCCallbackPage from './pages/auth/OIDCCallbackPage';
import { ProtectedRoute } from './components/auth';
import { AdminRoute } from './components/admin';
import { AdminDashboard, AdminUsers, AdminTransactions, AdminOrders, AdminConfig, AdminLogs, AdminAnnouncements } from './pages/admin';
import { useProjectStore } from './store/useProjectStore';
import { useAuthStore } from './store/useAuthStore';
import { useToast } from './components/shared';
import { setupAuthInterceptor, checkAuth } from './api/auth';

// App level i18n
const appI18n = {
  zh: {
    siteTitle: '蕉幻 | AI 原生 PPT 生成器'
  },
  en: {
    siteTitle: 'Banana Slides | AI-Native PPT Generator'
  }
};

// Setup auth interceptor on app load
setupAuthInterceptor();

function App() {
  const { currentProject, syncProject, error, setError } = useProjectStore();
  const { isAuthenticated, setLoading } = useAuthStore();
  const { show, ToastContainer } = useToast();
  const { i18n } = useTranslation();

  // 设置浏览器标题和 HTML lang 属性（国际化）
  useEffect(() => {
    const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
    document.title = appI18n[lang].siteTitle;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [i18n.language]);

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
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/oidc/callback" element={<OIDCCallbackPage />} />
        <Route path="/landing" element={<Landing />} />

        {/* Protected routes */}
        <Route path="/app" element={
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
        <Route path="/pricing" element={
          <ProtectedRoute>
            <PricingPage />
          </ProtectedRoute>
        } />
        <Route path="/credits" element={
          <ProtectedRoute>
            <CreditsHistory />
          </ProtectedRoute>
        } />
        <Route path="/invitation" element={
          <ProtectedRoute>
            <InvitationPage />
          </ProtectedRoute>
        } />
        <Route path="/change-password" element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        } />
        <Route path="/announcements" element={
          <ProtectedRoute>
            <AnnouncementsPage />
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

        {/* Admin routes */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        } />
        <Route path="/admin/transactions" element={
          <AdminRoute>
            <AdminTransactions />
          </AdminRoute>
        } />
        <Route path="/admin/orders" element={
          <AdminRoute>
            <AdminOrders />
          </AdminRoute>
        } />
        <Route path="/admin/config" element={
          <AdminRoute>
            <AdminConfig />
          </AdminRoute>
        } />
        <Route path="/admin/logs" element={
          <AdminRoute>
            <AdminLogs />
          </AdminRoute>
        } />
        <Route path="/admin/announcements" element={
          <AdminRoute>
            <AdminAnnouncements />
          </AdminRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AnnouncementPopup />
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;

