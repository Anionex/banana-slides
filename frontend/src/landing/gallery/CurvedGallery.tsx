import { useCallback, useEffect, useRef } from 'react';
import type { GalleryDeck } from './types';

/** Native scroll/snap owns input; the canvas only bends the cover artwork.
 * The unmodified images/buttons remain the accessible and no-canvas fallback.
 * Inspired by 21st.dev's cylinder-carousel and circular-gallery-2 studies.
 */
export function CurvedGallery({ decks, active, onSelect, label }: {
  decks: GalleryDeck[]; active: number; onSelect: (index: number) => void; label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pending = useRef<number>();
  const frame = useRef(0);
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (surface.width !== Math.round(width * dpr) || surface.height !== Math.round(height * dpr)) {
      surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    el.querySelectorAll<HTMLButtonElement>('.gallery-cover').forEach(button => {
      const img = button.querySelector('img')!;
      const x = button.offsetLeft - el.scrollLeft, w = button.offsetWidth;
      if (x + w < 0 || x > width || !img.complete || !img.naturalWidth) return;
      const base = w * 9 / 16;
      const bend = width < 768 ? .2 : .55;
      const sizeAt = (px: number) => base * (1 + bend * Math.pow((px - width / 2) / (width / 2), 2));
      const top = (px: number) => (height - sizeAt(px)) / 2;
      const bottom = (px: number) => (height + sizeAt(px)) / 2;
      const radius = 12, steps = Math.ceil(w);
      ctx.save();
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
      const imageWidth = Math.min(w, base * img.naturalWidth / img.naturalHeight);
      const imageHeight = imageWidth * img.naturalHeight / img.naturalWidth;
      for (let s = 0; s < steps; s++) {
        const px = x + (w - imageWidth) / 2 + imageWidth * s / steps;
        const h = sizeAt(px + imageWidth / steps / 2) * imageHeight / base;
        ctx.drawImage(img, img.naturalWidth * s / steps, 0, img.naturalWidth / steps, img.naturalHeight,
          px, (height - h) / 2, imageWidth / steps + .6, h);
      }
      ctx.restore();
      button.dataset.painted = 'true';
    });
  }, []);

  const schedulePaint = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  }, [paint]);

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
    if (el && button) el.scrollTo({ left: button.offsetLeft - (el.clientWidth - button.offsetWidth) / 2, behavior: instant || reduced() ? 'instant' : 'smooth' });
  }, [decks.length]);

  useEffect(() => { center(active); }, [active, center]);
  useEffect(() => {
    const el = track.current!;
    const resize = new ResizeObserver(() => { center(activeRef.current, true); schedulePaint(); });
    resize.observe(el);
    schedulePaint();
    return () => { resize.disconnect(); cancelAnimationFrame(frame.current); window.clearTimeout(pending.current); };
  }, [center, schedulePaint]);

  return <div className="gallery-stage">
    <canvas ref={canvas} aria-hidden="true" className="gallery-canvas" />
    <div ref={track} className="gallery-track" role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); onSelect((active + (event.key === 'ArrowRight' ? 1 : -1) + decks.length) % decks.length);
        }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); onSelect(event.key === 'Home' ? 0 : decks.length - 1); }
      }}
      onScroll={() => {
        schedulePaint(); window.clearTimeout(pending.current);
        pending.current = window.setTimeout(() => {
          const el = track.current!;
          const buttons = Array.from(el.children) as HTMLElement[];
          const middle = el.scrollLeft + el.clientWidth / 2;
          const nearest = buttons.reduce((best, button, i) => Math.abs(button.offsetLeft + button.offsetWidth / 2 - middle) < Math.abs(buttons[best].offsetLeft + buttons[best].offsetWidth / 2 - middle) ? i : best, 0);
          const index = (nearest - 1 + decks.length) % decks.length;
          if (nearest === 0 || nearest === decks.length + 1) center(index, true);
          onSelect(index);
        }, 180);
      }}
      onPointerDown={event => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={event => {
        const state = drag.current;
        if (!state) return;
        if (Math.abs(event.clientX - state.x) > 5) {
          state.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.style.scrollSnapType = 'none';
          event.currentTarget.scrollLeft = state.scroll - (event.clientX - state.x);
        }
      }}
      onPointerUp={event => {
        event.currentTarget.style.scrollSnapType = '';
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        // Keep moved until click has fired, then allow the next interaction.
        window.setTimeout(() => { drag.current = null; }, 0);
      }}
      onPointerCancel={event => { event.currentTarget.style.scrollSnapType = ''; drag.current = null; }}
      onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
    >
      {entries.map((deck, slot) => <button key={`${deck.id}-${slot}`} className="gallery-cover" tabIndex={-1} aria-label={deck.title.zh} aria-hidden={slot === 0 || slot === entries.length - 1} aria-pressed={slot - 1 === active}
        onClick={event => {
          if (drag.current?.moved || !track.current) return;
          const button = event.currentTarget;
          track.current.scrollTo({ left: button.offsetLeft - (track.current.clientWidth - button.offsetWidth) / 2, behavior: reduced() ? 'instant' : 'smooth' });
        }}>
        <img src={`/gallery/${deck.id}/cover.webp`} alt={deck.title.zh} width="800" height="450" draggable={false} onLoad={schedulePaint} />
      </button>)}
    </div>
  </div>;
}
