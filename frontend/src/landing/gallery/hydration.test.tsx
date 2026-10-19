import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { act, waitFor } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Gallery } from './Gallery';
import { DeckDetail } from './DeckDetail';
import { SlideImage } from './SlideImage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('../FooterRibbon', () => ({ FooterRibbon: () => <canvas /> }));
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });

let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove(); root = undefined;
  localStorage.clear();
  history.replaceState(null, '', '/');
});
afterAll(() => { vi.restoreAllMocks(); });

async function hydrate(page: React.ReactElement) {
  container = document.createElement('div');
  container.innerHTML = renderToString(page);
  document.body.append(container);
  const images = [...container.querySelectorAll('img')];
  const first = container.firstElementChild;
  const errors = vi.fn();
  await act(async () => { root = hydrateRoot(container, <StrictMode>{page}</StrictMode>, { onRecoverableError: errors }); });
  expect(errors).not.toHaveBeenCalled();
  expect(container.firstElementChild).toBe(first);
  return images;
}

describe('prerendered marketing page handoff', () => {
  it('preserves all existing gallery images and the dark theme when attaching interactions', async () => {
    history.replaceState(null, '', '/en/gallery/');
    localStorage.setItem('banana-landing-theme', 'dark');
    document.documentElement.dataset.landingTheme = 'dark';
    const images = await hydrate(<Gallery />);
    expect(images.every(image => image.isConnected)).toBe(true);
    expect(document.documentElement.dataset.landingTheme).toBe('dark');
    expect(container.querySelector('[aria-label="Dark theme"]')).toHaveAttribute('aria-pressed', 'true');
  });

  it('restores URL filters after hydration without overwriting them with the static default', async () => {
    history.replaceState(null, '', '/en/gallery/?q=DeepSeek&style=minimal');
    await hydrate(<Gallery />);
    expect(container.querySelector('input[type="search"]')).toHaveValue('DeepSeek');
    expect(container.querySelectorAll('.collection-card:not([aria-hidden="true"])')).toHaveLength(1);
    expect(location.search).toBe('?q=DeepSeek&style=minimal');
  });

  it('retains a detail page and restores its requested slide and return destination', async () => {
    history.replaceState(null, '', '/en/gallery/software/?from=home&slide=3');
    await hydrate(<DeckDetail deckId="software" />);
    expect(container.querySelector('.deck-detail-controls')).toHaveTextContent('Slide 3 of 9');
    expect(container.querySelector('.deck-detail-back')).toHaveAttribute('href', '/en/#works-curved');
    expect(location.search).toBe('?from=home&slide=3');
  });

  it('finishes the skeleton for an image loaded before hydration without recreating the image', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1600);
    const ready = vi.fn();
    const [image] = await hydrate(<SlideImage src="/slide.webp" alt="Slide" language="en" onReady={ready} />);
    await waitFor(() => expect(image.closest('.collection-image')).toHaveAttribute('aria-busy', 'false'));
    expect(image.isConnected).toBe(true);
    expect(ready).toHaveBeenCalled();
  });
});
