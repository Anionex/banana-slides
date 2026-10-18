import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeckCard } from './DeckCard';
import { decks } from './catalog';

afterEach(cleanup);

function holdDecode(image: HTMLImageElement) {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  Object.defineProperty(image, 'decode', { value: () => promise });
  fireEvent.load(image);
  return async () => { await act(async () => { resolve(); await promise; }); };
}

describe('card slide readiness', () => {
  const deck = decks.find(item => item.id === 'software')!;
  const card = (page: number, showOverview = false) => <DeckCard deck={deck} page={page} language="zh" eager
    showOverview={showOverview} onOverview={vi.fn()} onPage={vi.fn()} onOpen={vi.fn()} />;

  it('restores the overview and its page label immediately when the viewer resets the card', async () => {
    const view = render(card(3));
    view.rerender(card(0, true));
    expect(view.getByRole('img', { name: `${deck.title.zh}，整套作品总览` })).toBeInTheDocument();
    expect(view.container.querySelector('.collection-pagination')).toHaveTextContent('总览');
    expect(view.getByRole('button', { name: `${deck.title.zh} 上一页` })).toBeDisabled();
    expect(view.getByRole('button', { name: `浏览整套作品：${deck.title.zh}` })).toBeInTheDocument();
    await waitFor(() => expect(view.container.querySelectorAll('img')).toHaveLength(1));
  });

  it('keeps the previous slide opaque until the requested image has decoded', async () => {
    const view = render(card(0));
    const first = view.container.querySelector('img')!;
    await holdDecode(first)();
    view.rerender(card(1));
    const incoming = view.container.querySelectorAll('img')[1];
    const finishDecode = holdDecode(incoming);
    expect(first.closest('.collection-slide')).toHaveStyle({ opacity: '1' });
    expect(incoming.closest('.collection-slide')).toHaveStyle({ opacity: '0' });
    await finishDecode();
    await waitFor(() => expect(view.container.querySelectorAll('img')).toHaveLength(1));
    expect(view.container.querySelector('img')).toBe(incoming);
  });

  it('ignores stale image readiness when navigating back before decoding completes', async () => {
    const view = render(card(0));
    const first = view.container.querySelector('img')!;
    await holdDecode(first)();
    view.rerender(card(1));
    const finishDecode = holdDecode(view.container.querySelectorAll('img')[1]);
    view.rerender(card(0));
    await finishDecode();
    await waitFor(() => expect(view.container.querySelectorAll('img')).toHaveLength(1));
    expect(view.container.querySelector('img')).toBe(first);
    expect(first.closest('.collection-slide')).toHaveStyle({ opacity: '1' });
  });
});
