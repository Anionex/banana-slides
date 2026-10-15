import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import i18n from './i18n';
import './index.css';
import { isLandingPath, publicLandingEnabled } from './utils/publicLanding';
import { initializePublicAnalytics } from './utils/publicAnalytics';

// Marketing pages must not wait for API configuration or load editor styles/code.
const showLanding = publicLandingEnabled && isLandingPath(window.location.pathname);
if (showLanding) {
  if (/^\/en\/?$/.test(location.pathname)) void i18n.changeLanguage('en');
  initializePublicAnalytics();
}

// Keep the prerendered page visible while its interactive bundle loads.
if (showLanding) {
  void import('./landing/Landing').then(({ Landing }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Landing /></React.StrictMode>);
  });
} else {
  const App = lazy(() => import('./AppBootstrap'));
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><Suspense fallback={<div className="p-8" role="status">加载中…</div>}><App /></Suspense></React.StrictMode>,
  );
}
