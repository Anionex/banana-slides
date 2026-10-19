import { cleanup, fireEvent, render } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurvedGallery } from './CurvedGallery';
import { decks } from './catalog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('showcase entry gestures', () => {
  function setup(reading = false) {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
      return new DOMRect(this.classList.contains('gallery-cover') ? index * 820 : 0, 0, 800, 450);
    });
    const onRead = vi.fn();
    const view = render(<CurvedGallery decks={decks.slice(0, 2)} active={0}
      label="Works" reading={reading} expanded={reading} interaction="showcase"
      onSelect={vi.fn()} onRead={onRead} pan={{ current: null }}
      position={motionValue(0)} progress={motionValue(0)} />);
    const cover = view.container.querySelector<HTMLButtonElement>('.gallery-cover')!;
    const stage = view.container.querySelector<HTMLElement>('.gallery-stage')!;
    return { onRead, cover, stage };
  }

  it.each([false, true])('leaves vertical wheel to the browser, including horizontal departure=%s', horizontal => {
    const { onRead, cover, stage } = setup();
    stage.dataset.horizontal = String(horizontal);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 300, clientY: 200, deltaY: 100 });
    fireEvent(cover, event);
    expect(event.defaultPrevented).toBe(false);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('still opens a clicked cover during horizontal departure', () => {
    const { onRead, cover, stage } = setup();
    stage.dataset.horizontal = 'true';
    fireEvent.click(cover);
    expect(onRead).toHaveBeenCalledWith(0, 0);
  });

  it('marks every loop copy of the reading deck for hiding, including boundary neighbors', () => {
    const { stage } = setup(true);
    expect(stage).toHaveAttribute('data-reading', 'true');
    const copies = stage.querySelectorAll(`.gallery-cover[data-deck="${decks[0].id}"]`);
    expect(copies).toHaveLength(3);
    copies.forEach(copy => expect(copy).toHaveAttribute('aria-pressed', 'true'));
    stage.querySelectorAll(`.gallery-cover[data-deck="${decks[1].id}"]`)
      .forEach(copy => expect(copy).toHaveAttribute('aria-pressed', 'false'));
  });
});
