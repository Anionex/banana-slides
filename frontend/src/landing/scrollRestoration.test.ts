import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMarketingScrollRestoration } from './scrollRestoration';

let dispose: (() => void) | undefined;
const ready = () => document.dispatchEvent(new Event('marketing:content-ready'));
afterEach(() => {
  dispose?.(); dispose = undefined;
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
  vi.clearAllMocks();
});

describe('marketing history restoration before first paint', () => {
  it('keeps the first screen hidden until the saved return position is applied', () => {
    history.replaceState({ marketingScroll: { url: '/', x: 0, y: 1350 } }, '', '/');
    dispose = installMarketingScrollRestoration();
    expect(document.documentElement.dataset.marketingScroll).toBe('restoring');
    expect(history.scrollRestoration).toBe('manual');
    vi.mocked(window.scrollTo).mockImplementationOnce(() => {
      expect(document.documentElement.dataset.marketingScroll).toBe('restoring');
    });
    ready();
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 1350, behavior: 'instant' });
    expect(document.documentElement.dataset.marketingScroll).toBeUndefined();
  });

  it('saves each departing history entry without discarding its existing state', () => {
    history.replaceState({ example: 'keep' }, '', '/en/#works-curved');
    dispose = installMarketingScrollRestoration();
    ready();
    document.body.innerHTML = '<a href="/en/gallery/">Gallery</a>';
    document.querySelector('a')!.addEventListener('click', event => event.preventDefault());
    const x = vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);
    const y = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1460);
    document.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(history.state).toEqual({ example: 'keep', marketingScroll: { url: '/en/#works-curved', x: 0, y: 1460 } });
    x.mockRestore(); y.mockRestore();
  });

  it('positions direct section links once their static markup exists', () => {
    history.replaceState(null, '', '/#works-curved');
    dispose = installMarketingScrollRestoration();
    const section = document.createElement('section'); section.id = 'works-curved';
    section.scrollIntoView = vi.fn(); document.body.append(section);
    ready();
    expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
    expect(document.documentElement.dataset.marketingScroll).toBeUndefined();
  });

  it('does not impose an old page position on a new home visit', () => {
    history.replaceState({ marketingScroll: { url: '/gallery/', x: 0, y: 2100 } }, '', '/');
    dispose = installMarketingScrollRestoration(); ready();
    expect(document.documentElement.dataset.marketingScroll).toBeUndefined();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not replay the initial position on a back-forward-cache pageshow', () => {
    history.replaceState({ marketingScroll: { url: '/', x: 0, y: 900 } }, '', '/');
    dispose = installMarketingScrollRestoration(); ready();
    vi.mocked(window.scrollTo).mockClear();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('reveals the page when an anchor no longer exists and leaves editor routes alone', () => {
    history.replaceState(null, '', '/#missing');
    dispose = installMarketingScrollRestoration(); ready();
    expect(document.documentElement.dataset.marketingScroll).toBeUndefined();
    dispose?.(); dispose = undefined;
    history.replaceState(null, '', '/app#missing');
    expect(installMarketingScrollRestoration()).toBeUndefined();
    expect(document.documentElement.dataset.marketingScroll).toBeUndefined();
  });
});
