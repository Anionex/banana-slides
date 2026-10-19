import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decks, pageSource } from './catalog';
import { SlidePreview } from './SlidePreview';

const animations = vi.hoisted(() => new Map<string, () => void>());
vi.mock('motion/react', () => ({
  useReducedMotion: () => false,
  motion: { div: ({ children, animate, onAnimationComplete }: {
    children: ReactElement<{ src: string }>; animate: { opacity: number }; onAnimationComplete: () => void;
  }) => {
    animations.set(children.props.src, onAnimationComplete);
    return <div className="collection-slide" style={animate}>{children}</div>;
  } },
}));
vi.mock('./SlideImage', () => ({ SlideImage: ({ src, alt, onReady }: { src: string; alt: string; onReady: () => void }) => <img src={src} alt={alt} onLoad={onReady} /> }));
afterEach(() => { cleanup(); animations.clear(); });
const deck = decks.find(item => item.id === 'deepseek')!;
const preview = (page: number) => <SlidePreview deck={deck} page={page} language="en" eager />;

describe('slide fade handoff', () => {
  it('retains an opaque previous image through decode and the entire incoming fade', () => {
    const view = render(preview(0));
    const previous = view.container.querySelector('img')!;
    view.rerender(preview(1));
    const incoming = view.container.querySelectorAll('img')[1];
    fireEvent.load(incoming);
    expect(previous).toBeInTheDocument();
    expect(previous.parentElement).toHaveStyle({ opacity: '1' });
    act(() => animations.get(pageSource(deck, 1))!());
    expect(previous).not.toBeInTheDocument();
    expect(incoming).toBeInTheDocument();
  });

  it('keeps partially revealed layers when interrupted and ignores their late completion', () => {
    const view = render(preview(0));
    view.rerender(preview(1));
    fireEvent.load(view.container.querySelectorAll('img')[1]);
    const staleCompletion = animations.get(pageSource(deck, 1))!;
    view.rerender(preview(2));
    expect(view.container.querySelectorAll('img')).toHaveLength(3);
    act(staleCompletion);
    expect(view.container.querySelectorAll('img')).toHaveLength(3);
    fireEvent.load(view.container.querySelectorAll('img')[2]);
    act(() => animations.get(pageSource(deck, 2))!());
    expect(view.container.querySelectorAll('img')).toHaveLength(1);
    expect(view.container.querySelector('img')).toHaveAttribute('src', pageSource(deck, 2));
  });
});
