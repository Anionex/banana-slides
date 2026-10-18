import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import type { MotionValue } from 'motion/react';
import type { GalleryDeck } from './types';
import { GalleryMotion, modulo } from './galleryMotion';
import { GalleryRenderer } from './GalleryRenderer';

export interface GalleryPan {
  start: (x: number) => void;
  move: (x: number) => void;
  end: () => void;
  select: (index: number) => void;
  step: (direction: number) => void;
  paint: () => void;
}

/** Reuse one motion axis for the DOM showcase and the experimental warped gallery.
 * The homepage always draws ordinary images, without a canvas or GPU setup.
 */
export function CurvedGallery({ decks, active, onSelect, onCenterChange, label, reading, expanded, onRead, children, pan, position, progress, interaction = 'gallery', language = 'zh', coverSource }: {
  decks: GalleryDeck[]; active: number; onSelect: (index: number) => void; label: string; reading: boolean; onRead: (index?: number, wheelDelta?: number) => void; children?: ReactNode; expanded: boolean; pan: MutableRefObject<GalleryPan | null>; position: MotionValue<number>; progress: MotionValue<number>; interaction?: 'gallery' | 'showcase'; language?: 'zh' | 'en'; coverSource?: (deck: GalleryDeck) => string;
  onCenterChange?: (index: number) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<GalleryRenderer | null>(null);
  const motion = useRef(new GalleryMotion(1));
  const frame = useRef(0);
  const previousTime = useRef(0);
  const paintedFrames = useRef(0);
  const initialized = useRef(false);
  const horizontalAt = useRef(0);
  const drag = useRef<{ x: number; y: number; moved: boolean; axis?: 'x' | 'y' } | null>(null);
  const suppressClick = useRef(false);
  const manual = useRef<{ pointer: number; position: number } | null>(null);
  const assets = useRef(new Map<string, HTMLImageElement>());
  const layout = useRef({ width: 0, height: 0, centerY: 0, origin: 0, cycle: 1, covers: [] as { button: HTMLButtonElement; image: HTMLImageElement; left: number; width: number }[] });
  const centered = useRef(active);
  const current = useRef({ active, reading, onSelect, onRead, onCenterChange });
  current.current = { active, reading, onSelect, onRead, onCenterChange };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const entries = [...decks, ...decks, ...decks];
  const renderRef = useRef<(time: number) => void>(() => {});
  const schedulePaint = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(time => { frame.current = 0; renderRef.current(time); });
  }, []);
  const markHorizontal = () => {
    if (stage.current?.dataset.horizontal !== 'true') horizontalAt.current = performance.now();
    if (stage.current) stage.current.dataset.horizontal = 'true';
  };
  const pageImage = (deck: GalleryDeck, index: number) => {
    const src = `/gallery/${deck.id}/${modulo(index, deck.pages.length) + 1}.webp`;
    let image = assets.current.get(src);
    if (!image) {
      image = new Image(); image.decoding = 'async';
      image.onload = schedulePaint; image.src = src;
      assets.current.set(src, image);
      if (assets.current.size > 32) {
        const oldest = assets.current.keys().next().value as string;
        const discarded = assets.current.get(oldest)!; discarded.onload = null; assets.current.delete(oldest);
      }
    }
    return image;
  };

  renderRef.current = time => {
    const el = track.current, container = stage.current, data = layout.current;
    if (!el || !container || !data.width) return;
    const axis = motion.current, previousPhase = axis.phase;
    const dt = previousTime.current ? Math.min(.04, (time - previousTime.current) / 1000) : 1 / 60;
    previousTime.current = time;
    if (reduced() && axis.phase === 'coast') axis.velocity = 0;
    axis.tick(dt, time);
    if (reduced() && axis.phase === 'snap') { axis.position = axis.target; axis.velocity = 0; axis.tick(0, time); }
    // Preview follows the nearest cover during drag/coast, independently of the
    // settled selection that owns the in-place reader.
    const nearestCover = modulo(Math.round(axis.position / axis.step), decks.length);
    if (nearestCover !== centered.current) {
      centered.current = nearestCover;
      current.current.onCenterChange?.(nearestCover);
    }
    const scroll = data.origin + modulo(axis.position, data.cycle);
    el.scrollLeft = scroll;
    const relative = modulo(current.current.active * axis.step - axis.position + data.cycle / 2, data.cycle) - data.cycle / 2;
    position.set(relative);
    container.dataset.motion = axis.phase;
    container.dataset.speed = Math.abs(axis.velocity).toFixed(4);
    container.dataset.position = axis.position.toFixed(4);
    if (previousPhase !== 'idle' && axis.phase === 'idle') {
      container.dataset.horizontal = 'false';
      current.current.onSelect(modulo(Math.round(axis.position / axis.step), decks.length));
    }
    const horizontal = container.dataset.horizontal === 'true';
    const aperture = horizontal ? Math.min(1, (time - horizontalAt.current) / 100) : 0;
    if (interaction === 'showcase') {
      data.covers.forEach(({ image, left, width }) => {
        const distance = Math.max(-1, Math.min(1, (left - scroll + width / 2 - data.width / 2) / axis.step));
        image.style.transform = `perspective(1000px) rotateY(${-distance * 7}deg) scale(${1 - Math.abs(distance) * .07})`;
        image.style.opacity = String(1 - Math.abs(distance) * .12);
      });
    }
    const gpu = renderer.current;
    if (gpu) {
      const started = performance.now();
      gpu.begin(data.width, data.height, data.centerY);
      const deck = decks[current.current.active];
      const p = progress.get(), nearest = Math.round(p);
      if (current.current.reading) for (let i = nearest - 3; i <= nearest + 3; i++) pageImage(deck, i);
      data.covers.forEach(({ button, image, left, width }, slot) => {
        const x = left - scroll;
        if (x + width < -data.width * .25 || x > data.width * 1.25) return;
        if (current.current.reading && slot % decks.length === current.current.active) {
          for (let virtual = nearest - 2; virtual <= nearest + 2; virtual++) {
            const isCover = modulo(virtual, deck.pages.length) === 0;
            const img = pageImage(deck, virtual);
            const source = img.complete && img.naturalWidth ? img : isCover ? image : img;
            const painted = gpu.draw(source, x, width, (virtual - p) * (width * 9 / 16 + 16), isCover, true, aperture);
            const figure = container.querySelector<HTMLElement>(`.gallery-wheel-page[data-slot="${virtual}"]`);
            if (figure) figure.dataset.painted = String(painted);
          }
        } else button.dataset.painted = String(gpu.draw(image, x, width));
      });
      gpu.end();
      container.dataset.drawCalls = String(gpu.draws);
      container.dataset.renderMs = (performance.now() - started).toFixed(3);
      container.dataset.frame = String(++paintedFrames.current);
    }
    if (!['idle', 'drag'].includes(axis.phase) || (horizontal && aperture < 1)) schedulePaint();
    else previousTime.current = 0;
  };

  const select = (index: number) => {
    const axis = motion.current;
    const base = axis.phase === 'snap' ? axis.target : axis.position;
    const nearest = base + (modulo(index * axis.step - base + layout.current.cycle / 2, layout.current.cycle) - layout.current.cycle / 2);
    markHorizontal();
    if (reduced()) { axis.snap(nearest); axis.velocity = 0; axis.position = nearest; }
    else axis.snap(nearest);
    schedulePaint();
  };
  pan.current = {
    paint: schedulePaint,
    start(x) {
      markHorizontal(); motion.current.begin(performance.now());
      manual.current = { pointer: x, position: motion.current.position };
    },
    move(x) {
      if (!manual.current) return;
      motion.current.drag(manual.current.position + manual.current.pointer - x, performance.now());
      schedulePaint();
    },
    end() {
      manual.current = null;
      motion.current.release(performance.now());
      if (reduced()) motion.current.velocity = 0;
      schedulePaint();
    },
    select,
    step(direction) {
      const axis = motion.current;
      select(modulo(Math.round((axis.phase === 'snap' ? axis.target : axis.position) / axis.step) + direction, decks.length));
    },
  };

  useLayoutEffect(() => {
    const el = track.current!, surface = canvas.current, container = stage.current!;
    const fallback = () => {
      container.dataset.renderer = 'fallback';
      container.querySelectorAll<HTMLElement>('[data-painted]').forEach(node => { delete node.dataset.painted; });
    };
    const initialize = () => {
      if (!surface) { container.dataset.renderer = 'dom'; return; }
      try { renderer.current = new GalleryRenderer(surface, interaction === 'showcase'); container.dataset.renderer = 'webgl'; }
      catch (error) { renderer.current = null; container.dataset.rendererError = String(error); fallback(); }
      schedulePaint();
    };
    const lost = (event: Event) => { event.preventDefault(); renderer.current = null; fallback(); };
    const measure = () => {
      const bounds = el.getBoundingClientRect();
      const covers = Array.from(el.querySelectorAll<HTMLButtonElement>('.gallery-cover')).map(button => {
        const rect = button.getBoundingClientRect();
        return { button, image: button.querySelector('img')!, left: rect.left - bounds.left + el.scrollLeft, width: rect.width };
      });
      if (!covers.length || !bounds.width) return;
      const first = covers[decks.length], cycle = covers[2 * decks.length].left - first.left;
      const fraction = initialized.current ? motion.current.position / motion.current.step : current.current.active;
      const speed = motion.current.velocity / motion.current.step;
      const target = motion.current.target / motion.current.step;
      motion.current.step = cycle / decks.length;
      motion.current.position = fraction * motion.current.step;
      motion.current.target = initialized.current ? target * motion.current.step : motion.current.position;
      motion.current.velocity = speed * motion.current.step;
      layout.current = { width: bounds.width, height: bounds.height, centerY: first.button.offsetTop + first.width * 9 / 32, origin: first.left - (bounds.width - first.width) / 2, cycle, covers };
      initialized.current = true;
      schedulePaint();
    };
    initialize(); measure();
    const resize = new ResizeObserver(measure); resize.observe(el);
    surface?.addEventListener('webglcontextlost', lost); surface?.addEventListener('webglcontextrestored', initialize);
    const visibility = () => { previousTime.current = 0; if (document.hidden) { cancelAnimationFrame(frame.current); frame.current = 0; } else schedulePaint(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      resize.disconnect(); cancelAnimationFrame(frame.current); frame.current = 0; previousTime.current = 0;
      renderer.current?.destroy(); renderer.current = null;
      surface?.removeEventListener('webglcontextlost', lost); surface?.removeEventListener('webglcontextrestored', initialize);
      document.removeEventListener('visibilitychange', visibility);
      assets.current.forEach(image => { image.onload = null; }); assets.current.clear();
      fallback();
    };
  }, [decks.length, interaction, schedulePaint]);
  useLayoutEffect(schedulePaint, [active, reading, schedulePaint]);
  useEffect(() => progress.on('change', schedulePaint), [progress, schedulePaint]);
  useEffect(() => {
    // Decode the selected deck ahead of interaction; the renderer keeps only the
    // moving neighborhood on the GPU. Loading never hides the DOM fallback.
    if (interaction === 'showcase') return;
    const deck = decks[active];
    for (let i = -2; i <= 3; i++) pageImage(deck, i);
  }, [active, decks, interaction]);

  useEffect(() => {
    const el = stage.current!;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault(); event.stopPropagation(); markHorizontal();
        motion.current.wheel(event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? layout.current.width : 1), performance.now());
        schedulePaint(); return;
      }
      if (interaction === 'showcase') return;
      const horizontal = el.dataset.horizontal === 'true';
      if (current.current.reading && !horizontal) return;
      const axis = motion.current;
      // A vertical gesture takes over the work currently nearest the center,
      // without waiting for the horizontal spring's invisible settling tail.
      const index = horizontal && axis.phase !== 'drag'
        ? modulo(Math.round(axis.position / axis.step), decks.length)
        : current.current.active;
      const inside = layout.current.covers.some(({ button }) => {
        if (button.dataset.deck !== decks[index].id) return false;
        const r = button.getBoundingClientRect();
        return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
      });
      if (inside) {
        event.preventDefault(); event.stopPropagation();
        if (horizontal && axis.phase !== 'drag') {
          axis.snap(Math.round(axis.position / axis.step) * axis.step);
          axis.velocity = 0;
          el.dataset.horizontal = 'false';
          position.set(modulo(index * axis.step - axis.position + layout.current.cycle / 2, layout.current.cycle) - layout.current.cycle / 2);
          schedulePaint();
        }
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? layout.current.height : 1);
        current.current.onRead(index, delta);
      }
    };
    el.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', wheel, { capture: true });
  }, [decks, interaction, position, schedulePaint]);

  return <div ref={stage} className="gallery-stage" data-reading={reading} data-expanded={expanded}>
    {interaction !== 'showcase' && <canvas ref={canvas} aria-hidden="true" className="gallery-canvas" />}
    <div ref={track} className="gallery-track" role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
      onScroll={interaction === 'showcase' ? schedulePaint : undefined}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRead(); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); pan.current?.step(event.key === 'ArrowRight' ? 1 : -1); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); select(event.key === 'Home' ? 0 : decks.length - 1); }
      }}
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        suppressClick.current = false;
        motion.current.begin(performance.now());
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={event => {
        const state = drag.current;
        if (!state) return;
        const dx = event.clientX - state.x, dy = event.clientY - state.y;
        if (!state.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 5) {
          state.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          if (state.axis === 'x') { pan.current?.start(state.x); event.currentTarget.setPointerCapture(event.pointerId); }
        }
        if (state.axis === 'x') { state.moved = true; suppressClick.current = true; pan.current?.move(event.clientX); }
      }}
      onPointerUp={event => {
        const state = drag.current;
        if (state?.moved) pan.current?.end();
        else { motion.current.release(performance.now()); schedulePaint(); }
        if (interaction === 'gallery' && state?.axis === 'y' && Math.abs(event.clientY - state.y) > 24) onRead();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={() => { if (interaction === 'gallery' && drag.current?.axis === 'y') onRead(); pan.current?.end(); drag.current = null; }}
    >
      {entries.map((deck, slot) => <button key={`${deck.id}-${slot}`} className="gallery-cover" data-deck={deck.id} tabIndex={-1} aria-label={deck.title[language]} aria-hidden={slot < decks.length || slot >= 2 * decks.length} aria-pressed={slot - decks.length === active}
        onClick={() => {
          if (suppressClick.current) return;
          if (slot % decks.length === active && Math.abs(position.get()) < 1) onRead();
          else select(slot % decks.length);
        }}>
        <img src={coverSource ? coverSource(deck) : `/gallery/${deck.id}/cover.webp`} alt={deck.title[language]} width="800" height="450" draggable={false} loading="lazy" decoding="async" onLoad={schedulePaint} />
      </button>)}
    </div>
    {children}
  </div>;
}
