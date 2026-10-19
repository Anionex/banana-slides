/** Inlined in the prerendered HTML head: keep this function self-contained. */
export function installMarketingScrollRestoration() {
  if (!/^\/(?:en\/)?(?:gallery(?:\/[a-z0-9-]+)?\/?)?$/.test(location.pathname)) return;
  const key = 'marketingScroll';
  const address = () => location.pathname + location.search + location.hash;
  const saved = history.state?.[key];
  const restorePosition = saved?.url === address() && Number.isFinite(saved.x) && Number.isFinite(saved.y);
  const previous = history.scrollRestoration;
  let pending = Boolean(restorePosition || location.hash);
  if (pending) {
    history.scrollRestoration = 'manual';
    document.documentElement.dataset.marketingScroll = 'restoring';
  }
  const save = () => {
    // Never overwrite a valid return position while its document is still loading.
    if (pending) return;
    history.replaceState({ ...history.state, [key]: { url: address(), x: scrollX, y: scrollY } }, '');
  };
  const leaving = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
    if (link && link.origin === location.origin && (!link.target || link.target === '_self')) save();
  };
  const restore = () => {
    if (!pending) return;
    try {
      if (restorePosition) window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
      else {
        let id = location.hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* Treat malformed escapes as a literal ID. */ }
        const target = document.getElementById(id);
        target?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    } finally {
      // The body-end signal runs after the static layout exists, before it paints.
      pending = false;
      delete document.documentElement.dataset.marketingScroll;
    }
  };
  const shown = () => {
    restore();
    history.scrollRestoration = previous;
  };
  document.addEventListener('click', leaving, true);
  window.addEventListener('pagehide', save);
  document.addEventListener('marketing:content-ready', restore);
  window.addEventListener('pageshow', shown);
  return () => {
    document.removeEventListener('click', leaving, true);
    window.removeEventListener('pagehide', save);
    document.removeEventListener('marketing:content-ready', restore);
    window.removeEventListener('pageshow', shown);
    delete document.documentElement.dataset.marketingScroll;
    history.scrollRestoration = previous;
  };
}
