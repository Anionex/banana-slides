import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import { isLandingPath, publicLandingEnabled } from './utils/publicLanding';
import { initializePublicAnalytics } from './utils/publicAnalytics';

// Marketing pages must not wait for API configuration or load editor styles/code.
const showLanding = publicLandingEnabled && isLandingPath(window.location.pathname);
const Page = showLanding
  ? lazy(() => import('./landing/Landing').then(module => ({ default: module.Landing })))
  : lazy(() => import('./AppBootstrap'));
if (showLanding) initializePublicAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="p-8" role="status">加载中…</div>}>
      <Page />
    </Suspense>
  </React.StrictMode>,
);
