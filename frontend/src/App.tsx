import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { History } from './pages/History';
import { OutlineEditor } from './pages/OutlineEditor';
import { DetailEditor } from './pages/DetailEditor';
import { SlidePreview } from './pages/SlidePreview';
import { SettingsPage } from './pages/Settings';
import { useProjectStore } from './store/useProjectStore';
import { useToast, AccessCodeGuard, DesktopTitleBar, UpdateChecker } from './components/shared';
import { DESKTOP_TITLEBAR_HEIGHT, isDesktop } from '@/utils';

function App() {
  const { currentProject, syncProject, error, setError } = useProjectStore();
  const { show, ToastContainer } = useToast();

  // 恢复项目状态
  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && !currentProject) {
      syncProject();
    }
  }, [currentProject, syncProject]);

  // 显示全局错误
  useEffect(() => {
    if (error) {
      show({ message: error, type: 'error' });
      setError(null);
    }
  }, [error, setError, show]);


  return (
    <>
      <UpdateChecker />
      <div style={isDesktop ? { paddingTop: `${DESKTOP_TITLEBAR_HEIGHT}px` } : undefined}>
        <AccessCodeGuard>
          {(() => {
            const Router = isDesktop ? HashRouter : BrowserRouter;
            return (
              <Router>
                <DesktopTitleBar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/landing" element={<Landing />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/project/:projectId/outline" element={<OutlineEditor />} />
                  <Route path="/project/:projectId/detail" element={<DetailEditor />} />
                  <Route path="/project/:projectId/preview" element={<SlidePreview />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <ToastContainer />
              </Router>
            );
          })()}
        </AccessCodeGuard>
      </div>
    </>
  );
}

export default App;
