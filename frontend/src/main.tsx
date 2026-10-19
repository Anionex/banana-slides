import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import i18n from './i18n';
import './index.css';
import { isGalleryDetailPath, isGalleryPath, isLandingPath, publicLandingEnabled } from './utils/publicLanding';
import { initializePublicAnalytics } from './utils/publicAnalytics';

// Marketing pages must not wait for API configuration or load editor styles/code.
const showLanding = publicLandingEnabled && isLandingPath(window.location.pathname);
const showGallery = publicLandingEnabled && isGalleryPath(window.location.pathname);
const showDeck = publicLandingEnabled && isGalleryDetailPath(window.location.pathname);
if (showLanding || showGallery || showDeck) {
  void i18n.changeLanguage(/^\/en(?:\/|$)/.test(location.pathname) ? 'en' : 'zh');
  initializePublicAnalytics();
}

// Reuse the static page's DOM, including already decoded images. createRoot
// would discard it and repaint every cover when the interactive bundle arrives.
function mountMarketingPage(page: React.ReactNode) {
  const container = document.getElementById('root')!;
  const app = <React.StrictMode>{page}</React.StrictMode>;
  if (container.hasChildNodes()) ReactDOM.hydrateRoot(container, app);
  else ReactDOM.createRoot(container).render(app);
}

// Keep the prerendered page visible while its interactive bundle loads.
if (showDeck) {
  void import('./landing/gallery/DeckDetail').then(({ DeckDetail }) => {
    delete document.documentElement.dataset.appShell;
    mountMarketingPage(<DeckDetail />);
  });
} else if (showGallery) {
  void Promise.all([import('./landing/gallery/Gallery'), import('./landing/gallery/homeDeckNavigation')]).then(([{ Gallery }, { installHomeDeckNavigation }]) => {
    installHomeDeckNavigation('gallery');
    delete document.documentElement.dataset.appShell;
    mountMarketingPage(<Gallery />);
  });
} else if (showLanding) {
  void Promise.all([import('./landing/Landing'), import('./landing/gallery/homeDeckNavigation')]).then(([{ Landing }, { installHomeDeckNavigation }]) => {
    installHomeDeckNavigation();
    mountMarketingPage(<Landing />);
  });
} else {
  const App = lazy(() => import('./AppBootstrap'));
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><Suspense fallback={<div className="p-8" role="status">加载中…</div>}><App /></Suspense></React.StrictMode>,
  );
}
