import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WheelDeck } from './WheelDeck';
import { decks } from './catalog';

vi.mock('motion/react', async importOriginal => ({
  ...await importOriginal<typeof import('motion/react')>(),
  useReducedMotion: () => true,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function reader() {
  const progress = motionValue(0);
  const position = motionValue(0);
  const onExit = vi.fn();
  const content = (returning = false) => <div className="gallery-stage"><WheelDeck deck={decks[0]} language="zh"
    overviewSource="/gallery/overviews/software-zh.webp"
    enteredAt={1} returning={returning} onExit={onExit} onHorizontal={vi.fn()} pan={{ current: null }}
    position={position} progress={progress} /></div>;
  const view = render(content());
  const viewport = view.getByRole('region');
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 640, 500));
  // Two visible slide portions separated by a 16px gap at y=350…366.
  view.container.querySelectorAll('.gallery-wheel-page').forEach((page, index) => {
    vi.spyOn(page, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, index < 2 ? -10_000 : index === 2 ? -10 : 366 + (index - 3) * 376, 640, 360));
  });
  const wheel = (clientX: number, clientY: number, ctrlKey = false) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX, clientY, deltaY: 80, ctrlKey });
    fireEvent(viewport, event);
    return event;
  };
  return { progress, position, wheel, view, viewport, onExit, requestReturn: () => view.rerender(content(true)) };
}

describe('reader wheel surface', () => {
  it('turns slides in the gap and prevents document scrolling', () => {
    const { progress, wheel } = reader();
    expect(wheel(400, 358).defaultPrevented).toBe(true);
    expect(progress.get()).toBeGreaterThan(0);
  });

  it('leaves scrolling outside the reader and pinch zoom to the browser', () => {
    const { progress, wheel } = reader();
    expect(wheel(80, 358).defaultPrevented).toBe(false);
    expect(wheel(400, 620).defaultPrevented).toBe(false);
    expect(wheel(400, 358, true).defaultPrevented).toBe(false);
    expect(progress.get()).toBe(0);
  });

  it('keeps the overview at page 0 and loops through every slide before it', async () => {
    const { view, progress, viewport } = reader();
    const source = (slot: number) => view.container.querySelector(`.gallery-wheel-page[data-slot="${slot}"] img`)?.getAttribute('src');
    expect(source(0)).toBe('/gallery/overviews/software-zh.webp');
    expect(source(1)).toBe(`/gallery/${decks[0].id}/1.webp`);
    expect(source(-1)).toBe(`/gallery/${decks[0].id}/${decks[0].pages.length}.webp`);
    await waitFor(() => expect(progress.get()).toBe(1));
    fireEvent.keyDown(viewport, { key: 'Home' });
    await waitFor(() => expect(progress.get()).toBe(0));
    act(() => progress.set(decks[0].pages.length + 1));
    expect(source(decks[0].pages.length + 1)).toBe('/gallery/overviews/software-zh.webp');
    expect(view.container.querySelector('.gallery-wheel')).toHaveAttribute('data-page', '0');
  });

  it('finishes returning on the overview before handing off to the cover', async () => {
    const { progress, onExit, requestReturn } = reader();
    await waitFor(() => expect(progress.get()).toBe(1));
    act(() => progress.set(2));
    const exitedAt: number[] = [];
    onExit.mockImplementation(() => exitedAt.push(progress.get()));
    requestReturn();
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
    expect(exitedAt[0] % (decks[0].pages.length + 1)).toBe(0);
  });

  it('closes a departing reader once rewound without waiting for horizontal rest', async () => {
    const { progress, position, view, onExit } = reader();
    await waitFor(() => expect(progress.get()).toBe(1));
    (view.container.querySelector('.gallery-stage') as HTMLElement).dataset.horizontal = 'true';
    act(() => position.set(100));
    expect(onExit).toHaveBeenCalledOnce();
    expect(position.get()).toBe(100);
    expect(progress.get()).toBe(0);
  });
});
