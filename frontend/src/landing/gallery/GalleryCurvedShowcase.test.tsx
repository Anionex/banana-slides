import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import type { WheelDeck } from './WheelDeck';
import { GalleryCurvedShowcase } from './GalleryCurvedShowcase';

const rendered = vi.hoisted(() => ({ reader: null as ComponentProps<typeof WheelDeck> | null }));
vi.mock('./CurvedGallery', () => ({
  CurvedGallery: ({ onRead, children }: { onRead: (index: number) => void; children: ReactNode }) => <div>
    <button onClick={() => onRead(0)}>Open software</button>
    <button onClick={() => onRead(1)}>Open DeepSeek</button>
    {children}
  </div>,
}));
vi.mock('./WheelDeck', () => ({
  WheelDeck: (props: ComponentProps<typeof WheelDeck>) => {
    rendered.reader = props;
    return <div data-testid="reader" data-returning={props.returning}>{props.deck.id}</div>;
  },
}));
afterEach(() => { cleanup(); rendered.reader = null; });

describe('showcase reading intent', () => {
  it('isolates progress and ignores completion from a replaced reader', () => {
    const view = render(<GalleryCurvedShowcase language="en" />);
    fireEvent.click(view.getByText('Open software'));
    const previous = rendered.reader!;
    act(() => previous.progress.set(3));
    fireEvent.click(view.getByText('Open DeepSeek'));
    expect(rendered.reader!.progress).not.toBe(previous.progress);
    expect(rendered.reader!.progress.get()).toBe(0);
    act(() => previous.onExit());
    expect(view.getByTestId('reader')).toHaveTextContent('deepseek');
  });

  it('lets a new intent interrupt return without resetting the on-screen page', () => {
    const view = render(<GalleryCurvedShowcase language="en" />);
    fireEvent.click(view.getByText('Open software'));
    const previous = rendered.reader!;
    act(() => previous.progress.set(1.4));
    fireEvent.click(view.getByRole('button', { name: 'Back to overview' }));
    expect(view.getByTestId('reader')).toHaveAttribute('data-returning', 'true');
    fireEvent.click(view.getByText('Open software'));
    expect(rendered.reader!.progress.get()).toBe(1.4);
    expect(rendered.reader!.enteredAt).not.toBe(previous.enteredAt);
    expect(view.getByTestId('reader')).toHaveAttribute('data-returning', 'false');
    act(() => previous.onExit());
    expect(view.getByTestId('reader')).toBeInTheDocument();
    act(() => rendered.reader!.onExit());
    expect(view.queryByTestId('reader')).not.toBeInTheDocument();
  });
});
