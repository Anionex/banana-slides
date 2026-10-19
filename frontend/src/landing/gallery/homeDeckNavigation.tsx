import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import i18n from '../../i18n';
import { applyLandingMetadata } from '../metadata';
import { decks, pageSource } from './catalog';
import { detailPage } from './deckDetails';
import { preloadSlide } from './preloadSlide';
import './home-deck-navigation.css';

/** Keep both pages in one document for this one authored navigation sequence. */
export function installHomeDeckNavigation(origin: 'home' | 'gallery' = 'home') {
  const host = document.getElementById('root')!;
  let busy = false;
  let detailMounted = false;
  let detailHost: HTMLDivElement | null = null;
  let detailRoot: Root | null = null;
  let homeScroll = 0;
  let homeFocus: HTMLElement | null = null;
  let sourcePath = location.pathname;
  let sourceMetadata = { title: '', description: '', canonical: '', lang: '' };
  let version = 0;
  let running: Animation[] = [];
  let module: ReturnType<typeof importDetail> | undefined;
  const importDetail = () => import('./DeckDetail');
  const load = () => module ??= importDetail().catch(error => { module = undefined; throw error; });
  const linkFrom = (event: Event) => {
    const link = (event.target as Element)?.closest<HTMLAnchorElement>(origin === 'gallery' ? '.collection-card a.collection-open' : '.curved-showcase-title');
    return link && host.contains(link) && !detailMounted ? link : null;
  };
  const warm = (event: Event) => {
    const link = linkFrom(event);
    if (!link) return;
    void load().catch(() => {});
    const id = link.pathname.split('/').filter(Boolean).pop();
    const deck = decks.find(item => item.id === id);
    if (deck) void preloadSlide(pageSource(deck, detailPage(deck, link.search))).catch(() => {});
  };
  document.addEventListener('pointerover', warm);
  document.addEventListener('focusin', warm);
  const mountDetail = (DeckDetail: Awaited<ReturnType<typeof importDetail>>['DeckDetail'], id: string) => {
    host.dataset.homeParked = 'true';
    host.style.top = `${-homeScroll}px`;
    host.inert = true;
    host.setAttribute('aria-hidden', 'true');
    detailHost = document.createElement('div');
    detailHost.className = 'home-deck-detail-root';
    document.body.append(detailHost);
    detailRoot = createRoot(detailHost);
    flushSync(() => detailRoot!.render(<StrictMode><DeckDetail deckId={id} /></StrictMode>));
    detailMounted = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const restoreHome = () => {
    // Native history restoration runs after popstate and would override our saved
    // position. Own this restoration for one frame, then restore normal history.
    const scrollRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    version++;
    running.forEach(animation => animation.cancel());
    document.querySelector('.home-deck-flight')?.remove();
    flushSync(() => detailRoot?.unmount());
    detailHost?.remove(); detailHost = null; detailRoot = null;
    detailMounted = false; busy = false;
    delete host.dataset.homeParked;
    host.inert = false; host.removeAttribute('aria-hidden');
    ['top', 'opacity', 'pointer-events'].forEach(property => host.style.removeProperty(property));
    if (origin === 'home') applyLandingMetadata(i18n.language.startsWith('zh') ? 'zh' : 'en');
    else {
      document.title = sourceMetadata.title;
      document.documentElement.lang = sourceMetadata.lang;
      document.querySelector('meta[name="description"]')?.setAttribute('content', sourceMetadata.description);
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', sourceMetadata.canonical);
    }
    window.scrollTo({ top: homeScroll, behavior: 'instant' });
    requestAnimationFrame(() => { history.scrollRestoration = scrollRestoration; });
    homeFocus?.focus({ preventScroll: true });
    host.dataset.deckTransition = 'returned';
  };
  // Restore the still-mounted source page instead of reloading its image/renderer state.
  window.addEventListener('popstate', () => {
    const id = /^\/(?:en\/)?gallery\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1];
    if (!id && (detailMounted || busy)) restoreHome();
    else if (id && !detailMounted && history.state?.deckHandoff === origin) {
      const visit = ++version;
      void load().then(({ DeckDetail }) => {
        if (visit === version) mountDetail(DeckDetail, id);
      }).catch(() => location.reload());
    }
  });
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const back = (event.target as Element)?.closest<HTMLAnchorElement>('.deck-detail-back');
    if (back && detailMounted && back.pathname === sourcePath) {
      event.preventDefault();
      if (!busy) history.back();
      return;
    }
    const link = linkFrom(event);
    if (!link || (link.target && link.target !== '_self')) return;
    const section = link.closest('.curved-showcase');
    const stage = origin === 'gallery'
      ? link.closest<HTMLElement>('.collection-stage')
      : section?.querySelector<HTMLElement>('.gallery-stage');
    if (!stage) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    const visit = ++version;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    homeScroll = window.scrollY;
    homeFocus = link;
    sourcePath = location.pathname;
    sourceMetadata = {
      title: document.title, lang: document.documentElement.lang,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
    };
    const href = link.href;
    const id = link.pathname.split('/').filter(Boolean).pop()!;
    const stageBox = stage.getBoundingClientRect();
    const covers = [...stage.querySelectorAll<HTMLElement>(`.gallery-cover[data-deck="${CSS.escape(id)}"]`)];
    const distance = (element: HTMLElement) => Math.abs(element.getBoundingClientRect().left + element.clientWidth / 2 - stageBox.left - stageBox.width / 2);
    const cover = origin === 'gallery' ? stage : covers.sort((a, b) => distance(a) - distance(b))[0];
    // A card can contain both sides of an in-progress page fade. Fly the visible one.
    const cardImage = origin === 'gallery' ? [...stage.querySelectorAll<HTMLImageElement>('img')]
      .filter(item => item.complete && item.naturalWidth)
      .sort((a, b) => Number(getComputedStyle(b.closest('.collection-overview-retained, .collection-slide') ?? b).opacity) - Number(getComputedStyle(a.closest('.collection-overview-retained, .collection-slide') ?? a).opacity))[0] : null;
    const image = cardImage ?? (stage.dataset.reading === 'true' ? stage.querySelector<HTMLImageElement>('.gallery-wheel-page[aria-hidden="false"] img') : null)
      ?? cover?.querySelector<HTMLImageElement>('img');
    if (!cover || !image?.complete || !image.naturalWidth) { location.assign(href); return; }
    const source = cover.getBoundingClientRect();
    const proxy = document.createElement('div');
    const outgoing = new Image(); outgoing.src = image.currentSrc; outgoing.alt = '';
    outgoing.className = 'home-deck-flight-outgoing';
    proxy.append(outgoing);
    proxy.className = 'home-deck-flight'; proxy.setAttribute('aria-hidden', 'true');
    Object.assign(proxy.style, { left: `${source.left}px`, top: `${source.top}px`, width: `${source.width}px`, height: `${source.height}px` });
    const animations: Animation[] = [];
    running = animations;
    let target: HTMLElement | null = null;
    const animate = (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(frames, { fill: 'both', ...options, ...(reduced ? { duration: 0, delay: 0 } : {}) });
      animations.push(animation);
      return animation.finished;
    };
    host.dataset.deckTransition = 'loading';
    link.setAttribute('aria-busy', 'true');
    const pending = document.createElement('span');
    pending.className = 'deck-navigation-pending';
    pending.setAttribute('role', 'status');
    pending.textContent = i18n.language.startsWith('zh') ? '正在打开作品…' : 'Opening presentation…';
    const pendingTimer = window.setTimeout(() => stage.append(pending), 450);
    void (async () => {
      try {
        const deck = decks.find(item => item.id === id);
        if (!deck) throw new Error('Missing presentation');
        const [{ DeckDetail }, decoded] = await Promise.all([
          load(), preloadSlide(pageSource(deck, detailPage(deck, link.search))),
        ]);
        const incoming = new Image(); incoming.src = decoded.src; incoming.alt = '';
        incoming.className = 'home-deck-flight-incoming';
        incoming.style.opacity = '0';
        await Promise.all([incoming.decode(), outgoing.decode()]);
        window.clearTimeout(pendingTimer); pending.remove();
        if (visit !== version) return;
        proxy.prepend(incoming);
        document.body.append(proxy);
        host.style.pointerEvents = 'none';
        host.dataset.deckTransition = 'departing';
        await animate(host, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' });
        if (visit !== version) return;
        host.style.opacity = '0';
        animations.splice(0).forEach(animation => animation.cancel());
        history.pushState({ deckHandoff: origin }, '', href);
        mountDetail(DeckDetail, id);
        target = detailHost!.querySelector<HTMLElement>('.deck-detail-preview > .collection-stage');
        if (!target) throw new Error('Missing presentation preview');
        target.style.visibility = 'hidden';
        const destination = target.getBoundingClientRect();
        const transform = `translate(${destination.left - source.left}px, ${destination.top - source.top}px) scale(${destination.width / source.width}, ${destination.height / source.height})`;
        host.dataset.deckTransition = 'moving';
        await Promise.all([
          animate(proxy, [
            { transform: 'none' },
            { transform },
          ], { duration: 700, easing: 'cubic-bezier(.22, 1, .36, 1)' }),
          animate(outgoing, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: 60, easing: 'ease-in-out' }),
          animate(incoming, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 60, easing: 'ease-in-out' }),
          animate(detailHost!, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, easing: 'ease-out' }),
        ]);
        host.dataset.deckTransition = 'finished';
        const heading = detailHost!.querySelector<HTMLElement>('h1');
        heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
      } catch {
        if (visit === version) {
          host.dataset.deckTransition = 'fallback';
          if (!detailMounted) location.assign(href);
        }
      } finally {
        window.clearTimeout(pendingTimer); pending.remove();
        target?.style.removeProperty('visibility');
        animations.forEach(animation => animation.cancel());
        proxy.remove(); link.removeAttribute('aria-busy');
        if (visit === version) {
          host.style.removeProperty('opacity'); host.style.removeProperty('pointer-events');
          busy = false;
        }
      }
    })();
  });
}
