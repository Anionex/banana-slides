import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { History } from './pages/History';
import { OutlineEditor } from './pages/OutlineEditor';
import { DetailEditor } from './pages/DetailEditor';
import { SlidePreview } from './pages/SlidePreview';
import { SettingsPage } from './pages/Settings';
import { UserProfile } from './pages/UserProfile';
import { useProjectStore } from './store/useProjectStore';
import { useUserStore } from './store/useUserStore';
import { userApi } from './api/user';
import { useToast, AccessCodeGuard, LoginModal } from './components/shared';

function App() {
  const { currentProject, syncProject, error, setError } = useProjectStore();
  const accessToken = useUserStore((s) => s.accessToken);
  const setUser = useUserStore((s) => s.setUser);
  const logout = useUserStore((s) => s.logout);
  const { show, ToastContainer } = useToast();

  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && !currentProject) {
      syncProject();
    }
  }, [currentProject, syncProject]);

  useEffect(() => {
    if (error) {
      show({ message: error, type: 'error' });
      setError(null);
    }
  }, [error, setError, show]);

  useEffect(() => {
    let cancelled = false;

    if (!accessToken) return;

    const refreshCurrentUser = async () => {
      try {
        const res = await userApi.getProfile();
        if (!cancelled) {
          setUser(res.data.data);
        }
      } catch (error: any) {
        if (!cancelled && error?.response?.status === 401) {
          logout();
        }
      }
    };

    refreshCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [accessToken, logout, setUser]);

  return (
    <AccessCodeGuard>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/project/:projectId/outline" element={<OutlineEditor />} />
          <Route path="/project/:projectId/detail" element={<DetailEditor />} />
          <Route path="/project/:projectId/preview" element={<SlidePreview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
        <LoginModal />
      </BrowserRouter>
    </AccessCodeGuard>
  );
}

export default App;
