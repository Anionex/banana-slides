import { useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { History } from './pages/History';
import { OutlineEditor } from './pages/OutlineEditor';
import { DetailEditor } from './pages/DetailEditor';
import { TemplateSetupPage } from './pages/TemplateSetupPage';
import { SlidePreview } from './pages/SlidePreview';
import { SettingsPage } from './pages/Settings';
import { useProjectStore } from './store/useProjectStore';
import { useToast, AccessCodeGuard, DesktopTitleBar, UpdateChecker } from './components/shared';
import { getDesktopTopInset } from './components/shared/UpdateChecker';
import { isDesktop } from '@/utils';
import { useApiSettingsRecovery } from '@/hooks/useApiSettingsRecovery';

function GlobalErrorToasts() {
  const { error, errorRecoveryPath, setError } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const location = useLocation();
  const { withApiSettingsRecovery } = useApiSettingsRecovery();

  useEffect(() => {
    if (!error) return;

    const isEditorRoute = /^\/project\/[^/]+\/(outline|detail)$/.test(location.pathname);
    const toast = { message: error, type: 'error' as const };
    show(
      errorRecoveryPath || isEditorRoute
        ? withApiSettingsRecovery(error, toast, errorRecoveryPath || undefined)
        : toast
    );
    setError(null);
  }, [error, errorRecoveryPath, location.pathname, setError, show, withApiSettingsRecovery]);

  return <ToastContainer />;
}

function App() {
  const { currentProject, syncProject } = useProjectStore();
  const [isUpdateVisible, setIsUpdateVisible] = useState(false);

  // 恢复项目状态
  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && !currentProject) {
      syncProject();
    }
  }, [currentProject, syncProject]);

  return (
    <>
      <UpdateChecker onVisibilityChange={setIsUpdateVisible} />
      <div style={isDesktop ? { paddingTop: `${getDesktopTopInset(isUpdateVisible)}px` } : undefined}>
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
                  <Route path="/project/:projectId/template-setup" element={<TemplateSetupPage />} />
                  <Route path="/project/:projectId/preview" element={<SlidePreview />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <GlobalErrorToasts />
              </Router>
            );
          })()}
        </AccessCodeGuard>
      </div>
    </>
  );
}

export default App;
