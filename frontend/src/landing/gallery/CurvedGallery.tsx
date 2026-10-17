import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import type { MotionValue } from 'motion/react';
import { animate } from 'motion/react';
import type { GalleryDeck } from './types';

export interface GalleryPan {
  start: (x: number) => void;
  move: (x: number) => void;
  end: () => void;
  select: (index: number) => void;
  paint: () => void;
}

/** Native scroll/snap owns input; the canvas only bends the cover artwork.
 * The unmodified images/buttons remain the accessible and no-canvas fallback.
 * Inspired by 21st.dev's cylinder-carousel and circular-gallery-2 studies.
 */
export function CurvedGallery({ decks, active, onSelect, label, reading, expanded, onRead, children, pan, position, progress }: {
  decks: GalleryDeck[]; active: number; onSelect: (index: number) => void; label: string; reading: boolean; onRead: () => void; children?: ReactNode; expanded: boolean; pan: MutableRefObject<GalleryPan | null>; position: MotionValue<number>; progress: MotionValue<number>;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const manual = useRef<{ x: number; scroll: number } | null>(null);
  const pending = useRef<number>();
  const frame = useRef(0);
  const settling = useRef<ReturnType<typeof animate>>();
  const activeRef = useRef(active);
  activeRef.current = active;
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const entries = [decks[decks.length - 1], ...decks, decks[0]];

  const paint = useCallback(() => {
    const el = track.current;
    const surface = canvas.current;
    const ctx = surface?.getContext('2d');
    if (!el || !surface || !ctx) return;
    const width = el.clientWidth, height = el.clientHeight;
    // Share the layout's artwork anchor instead of centering in the preview belt.
    const anchor = el.querySelector<HTMLButtonElement>('.gallery-cover');
    const centerY = anchor ? anchor.offsetTop + anchor.offsetHeight / 2 : height / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (surface.width !== Math.round(width * dpr) || surface.height !== Math.round(height * dpr)) {
      surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const drawCard = (img: HTMLImageElement, x: number, w: number, shift = 0, alpha = 1, curvature = 1) => {
      const base = w * 9 / 16;
      const bend = (width < 768 ? .2 : .55) * curvature;
      const sizeAt = (px: number) => base * (1 + bend * Math.pow((px - width / 2) / (width / 2), 2));
      const top = (px: number) => centerY - sizeAt(px) / 2 + shift;
      const bottom = (px: number) => centerY + sizeAt(px) / 2 + shift;
      const radius = 12, steps = Math.ceil(w / 2);
      const imageWidth = Math.min(w, base * img.naturalWidth / img.naturalHeight);
      const imageHeight = imageWidth * img.naturalHeight / img.naturalWidth;
      if (curvature === 0) {
        const y = centerY - base / 2 + shift;
        if (y + base < 0 || y > height) return;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.roundRect(x, y, w, base, radius); ctx.clip();
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, base);
        ctx.drawImage(img, x + (w - imageWidth) / 2, centerY - imageHeight / 2 + shift, imageWidth, imageHeight);
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x + radius, top(x + radius));
      for (let s = 1; s <= steps; s++) {
        const px = x + radius + (w - 2 * radius) * s / steps;
        ctx.lineTo(px, top(px));
      }
      ctx.quadraticCurveTo(x + w, top(x + w), x + w, top(x + w) + radius);
      ctx.lineTo(x + w, bottom(x + w) - radius);
      ctx.quadraticCurveTo(x + w, bottom(x + w), x + w - radius, bottom(x + w - radius));
      for (let s = steps - 1; s >= 0; s--) {
        const px = x + radius + (w - 2 * radius) * s / steps;
        ctx.lineTo(px, bottom(px));
      }
      ctx.quadraticCurveTo(x, bottom(x), x, bottom(x) - radius);
      ctx.lineTo(x, top(x) + radius);
      ctx.quadraticCurveTo(x, top(x), x + radius, top(x + radius));
      ctx.clip();
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, 0, w, height);
      // Slice mapping preserves all source content, including text at the edges.
      for (let s = 0; s < steps; s++) {
        const px = x + (w - imageWidth) / 2 + imageWidth * s / steps;
        const h = sizeAt(px + imageWidth / steps / 2) * imageHeight / base;
        ctx.drawImage(img, img.naturalWidth * s / steps, 0, img.naturalWidth / steps, img.naturalHeight,
          px, centerY - h / 2 + shift, imageWidth / steps + .6, h);
      }
      ctx.restore();
    };
    el.querySelectorAll<HTMLButtonElement>('.gallery-cover').forEach((button, slot) => {
      const cover = button.querySelector('img')!;
      const x = button.offsetLeft - el.scrollLeft, w = button.offsetWidth;
      if (x + w < 0 || x > width || !cover.complete || !cover.naturalWidth) return;
      // The centered work is completely flat, including its cover. Curvature only
      // develops as a work moves into the side position, with no mode-change jump.
      const side = Math.min(1, Math.max(0, (Math.abs(x - (width - w) / 2) / w - .2) / .8));
      const curvature = side * side * (3 - 2 * side);
      if (reading && slot === active + 1) {
        const departure = Math.min(1, Math.abs(x - (width - w) / 2) / (w * .6));
        const base = w * 9 / 16;
        const horizontal = stage.current!.dataset.horizontal === 'true';
        ctx.save();
        if (horizontal) {
          // Hide the adjacent pages as soon as horizontal intent is established.
          // Keep the central aperture curved so the card can still return smoothly.
          const edge = (px: number) => base * (1 + (width < 768 ? .2 : .55) * curvature * Math.pow((px - width / 2) / (width / 2), 2));
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const px = x + w * i / 40, py = centerY - edge(px) / 2;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          for (let i = 40; i >= 0; i--) {
            const px = x + w * i / 40;
            ctx.lineTo(px, centerY + edge(px) / 2);
          }
          ctx.closePath(); ctx.clip();
        }
        const figures = stage.current!.querySelectorAll<HTMLElement>('.gallery-wheel-page');
        figures.forEach(figure => {
          const virtual = Number(figure.dataset.slot);
          const img = figure.querySelector('img');
          const isCover = ((virtual % decks[active].pages.length) + decks[active].pages.length) % decks[active].pages.length === 0;
          const source = img?.complete && img.naturalWidth ? img : isCover ? cover : null;
          if (!source) return;
          drawCard(source, x, w, (virtual - progress.get()) * (base + 16), isCover ? 1 : 1 - departure, isCover ? curvature : 0);
          figure.dataset.painted = 'true';
        });
        // Mask only this card's column; neighboring presentations keep their curvature.
        ctx.save(); ctx.beginPath(); ctx.rect(x, 0, w, height); ctx.clip();
        ctx.globalCompositeOperation = 'destination-in';
        const fade = ctx.createLinearGradient(0, 0, 0, height);
        fade.addColorStop(0, 'transparent'); fade.addColorStop((centerY - base / 2) / height, '#000');
        fade.addColorStop((centerY + base / 2) / height, '#000'); fade.addColorStop(1, 'transparent');
        ctx.fillStyle = fade; ctx.fillRect(x, 0, w, height); ctx.restore();
        ctx.restore();
      } else drawCard(cover, x, w, 0, 1, curvature);
      button.dataset.painted = 'true';
    });
  }, [reading, active, decks, progress]);

  const paintRef = useRef(paint);
  paintRef.current = paint;
  const updatePosition = () => {
    const el = track.current!;
    const button = el.children[activeRef.current + 1] as HTMLElement;
    position.set(button.offsetLeft - el.scrollLeft - (el.clientWidth - button.offsetWidth) / 2);
  };
  const schedulePaint = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; paintRef.current(); });
  }, []);
  useLayoutEffect(() => { updatePosition(); paint(); });
  useEffect(() => progress.on('change', schedulePaint), [progress, schedulePaint]);
  useEffect(() => {
    const deck = decks[active];
    const indexes = new Set([0, 1, 2, deck.pages.length - 1, deck.pages.length - 2]);
    const images = [...indexes].map(index => {
      const image = new Image();
      image.src = `/gallery/${deck.id}/${index + 1}.webp`;
      return image;
    });
    return () => { images.forEach(image => { image.onload = null; }); };
  }, [active, decks]);

  const settleTo = useCallback((left: number, instant = false) => {
    const el = track.current!;
    settling.current?.stop();
    if (instant || reduced() || Math.abs(left - el.scrollLeft) < 1) {
      el.scrollTo({ left, behavior: 'instant' });
      return;
    }
    el.style.scrollSnapType = 'none';
    settling.current = animate(el.scrollLeft, left, {
      duration: Math.min(.56, .32 + Math.abs(left - el.scrollLeft) / 2400),
      ease: [.45, 0, .55, 1],
      onUpdate: value => { el.scrollLeft = value; },
    });
  }, []);

  const center = useCallback((index: number, instant = false) => {
    const el = track.current;
    let slot = index + 1;
    if (el && !instant) {
      const first = el.children[1] as HTMLElement;
      const last = el.children[decks.length] as HTMLElement;
      const middle = el.scrollLeft + el.clientWidth / 2;
      if (index === decks.length - 1 && Math.abs(middle - first.offsetLeft - first.offsetWidth / 2) < 2) slot = 0;
      if (index === 0 && Math.abs(middle - last.offsetLeft - last.offsetWidth / 2) < 2) slot = decks.length + 1;
    }
    const button = el?.children[slot] as HTMLElement | undefined;
    if (el && button) settleTo(button.offsetLeft - (el.clientWidth - button.offsetWidth) / 2, instant);
  }, [decks.length, settleTo]);

  useEffect(() => { center(active); }, [active, center]);
  useEffect(() => {
    const el = track.current!;
    let width = 0;
    const resize = new ResizeObserver(() => {
      if (el.clientWidth !== width) { width = el.clientWidth; center(activeRef.current, true); }
      schedulePaint();
    });
    resize.observe(el);
    schedulePaint();
    return () => { resize.disconnect(); cancelAnimationFrame(frame.current); frame.current = 0; settling.current?.stop(); window.clearTimeout(pending.current); };
  }, [center, schedulePaint]);

  const finishScroll = () => {
    window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      if (manual.current) return;
      const el = track.current!;
      const buttons = Array.from(el.children) as HTMLElement[];
      const middle = el.scrollLeft + el.clientWidth / 2;
      const nearest = buttons.reduce((best, button, i) => Math.abs(button.offsetLeft + button.offsetWidth / 2 - middle) < Math.abs(buttons[best].offsetLeft + buttons[best].offsetWidth / 2 - middle) ? i : best, 0);
      const index = (nearest - 1 + decks.length) % decks.length;
      el.style.scrollSnapType = '';
      if (nearest === 0 || nearest === decks.length + 1) center(index, true);
      stage.current!.dataset.horizontal = 'false';
      onSelect(index); schedulePaint();
    }, 180);
  };
  pan.current = {
    paint: schedulePaint,
    start(x) {
      settling.current?.stop();
      stage.current!.dataset.horizontal = 'true';
      const el = track.current!;
      window.clearTimeout(pending.current);
      manual.current = { x, scroll: el.scrollLeft };
      el.style.scrollSnapType = 'none';
      el.scrollTo({ left: el.scrollLeft, behavior: 'instant' });
    },
    move(x) {
      if (!manual.current) return;
      track.current!.scrollLeft = manual.current.scroll + manual.current.x - x;
      updatePosition(); schedulePaint();
    },
    end() {
      const el = track.current!;
      const state = manual.current;
      manual.current = null;
      if (!state) return;
      const first = el.children[1] as HTMLElement;
      const second = el.children[2] as HTMLElement;
      const step = second.offsetLeft - first.offsetLeft;
      const distance = el.scrollLeft - state.scroll;
      const initialSlot = Math.round((state.scroll + (el.clientWidth - first.offsetWidth) / 2 - first.offsetLeft) / step) + 1;
      const slot = Math.max(0, Math.min(decks.length + 1, initialSlot + (Math.abs(distance) > 60 ? Math.sign(distance) * Math.max(1, Math.round(Math.abs(distance) / step)) : 0)));
      const button = el.children[slot] as HTMLElement;
      settleTo(button.offsetLeft - (el.clientWidth - button.offsetWidth) / 2);
      finishScroll();
    },
    select(index) { stage.current!.dataset.horizontal = 'true'; center(index); finishScroll(); },
  };

  useEffect(() => {
    const el = stage.current!;
    const wheel = (event: WheelEvent) => {
      if (reading || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const rect = track.current!.getBoundingClientRect();
      const contains = (bounds: DOMRect) => event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      // Follow the selected cover's actual scroll position, including loop copies.
      const overCover = Array.from(track.current!.querySelectorAll<HTMLElement>('.gallery-cover')).some(cover => cover.dataset.deck === decks[activeRef.current].id && contains(cover.getBoundingClientRect()));
      if (!contains(rect) || !overCover) return;
      event.preventDefault();
      onRead();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [reading, onRead, decks]);

  return <div ref={stage} className="gallery-stage" data-reading={reading} data-expanded={expanded}>
    <canvas ref={canvas} aria-hidden="true" className="gallery-canvas" />
    <div ref={track} className="gallery-track" role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRead(); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); pan.current?.select((active + (event.key === 'ArrowRight' ? 1 : -1) + decks.length) % decks.length);
        }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); pan.current?.select(event.key === 'Home' ? 0 : decks.length - 1); }
      }}
      onScroll={() => { updatePosition(); schedulePaint(); if (!manual.current) finishScroll(); }}
      onPointerDown={event => {
        settling.current?.stop();
        if (event.pointerType !== 'mouse') { touch.current = { x: event.clientX, y: event.clientY }; return; }
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={event => {
        const state = drag.current;
        if (!state) return;
        if (Math.abs(event.clientX - state.x) > 5) {
          if (!state.moved) pan.current?.start(state.x);
          state.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          pan.current?.move(event.clientX);
        }
      }}
      onPointerUp={event => {
        if (touch.current) {
          const dx = Math.abs(event.clientX - touch.current.x), dy = Math.abs(event.clientY - touch.current.y);
          if (dy > 24 && dy > dx) onRead();
          touch.current = null;
        }
        if (drag.current?.moved) pan.current?.end();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        // Keep moved until click has fired, then allow the next interaction.
        window.setTimeout(() => { drag.current = null; }, 0);
      }}
      onPointerCancel={() => { if (drag.current?.moved) pan.current?.end(); drag.current = null; touch.current = null; }}
      onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
    >
      {entries.map((deck, slot) => <button key={`${deck.id}-${slot}`} className="gallery-cover" data-deck={deck.id} tabIndex={-1} aria-label={deck.title.zh} aria-hidden={slot === 0 || slot === entries.length - 1} aria-pressed={slot - 1 === active}
        onClick={event => {
          if (drag.current?.moved || !track.current) return;
          if (slot - 1 === active) { onRead(); return; }
          const button = event.currentTarget;
          settleTo(button.offsetLeft - (track.current.clientWidth - button.offsetWidth) / 2);
        }}>
        <img src={`/gallery/${deck.id}/cover.webp`} alt={deck.title.zh} width="800" height="450" draggable={false} onLoad={schedulePaint} />
      </button>)}
    </div>
    {children}
  </div>;
}
