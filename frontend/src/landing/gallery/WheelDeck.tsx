import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { animate, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { GalleryPan } from './CurvedGallery';
import type { GalleryDeck } from './types';

function WheelPage({ deck, index, slot, progress, reduced, language, onLoad }: {
  deck: GalleryDeck; index: number; slot: number; onLoad: () => void; progress: MotionValue<number>; reduced: boolean; language: 'zh' | 'en';
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Every page shares one flat belt: equal spacing, no perspective or scaling.
  const y = useTransform(progress, value => {
    const offset = slot - (reduced ? Math.round(value) : value);
    return `calc(${offset * 100}% + ${offset * 16}px)`;
  });
  const dimensions = deck.pages[index];
  const current = Math.round(progress.get()) === slot;
  return <motion.figure className="gallery-wheel-page" data-slot={slot} style={{ y }} aria-hidden={!current}>
    {failed ? <div className="gallery-image-error"><p>{language === 'zh' ? '页面暂时无法加载' : 'This slide could not load'}</p><button tabIndex={current ? 0 : -1} onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>{language === 'zh' ? '重新加载' : 'Retry'}</button><a tabIndex={current ? 0 : -1} href={deck.pdf} target="_blank" rel="noopener noreferrer">{language === 'zh' ? '打开 PDF' : 'Open PDF'}</a></div>
      : <img src={`/gallery/${deck.id}/${index + 1}.webp${attempt ? `?retry=${attempt}` : ''}`} alt={`${deck.title[language]} · ${index + 1}`} {...dimensions} draggable={false} onLoad={onLoad} onError={() => setFailed(true)} />}
  </motion.figure>;
}

export function WheelDeck({ deck, language, enteredAt, onExit, onHorizontal, pan, position, progress }: {
  deck: GalleryDeck; language: 'zh' | 'en'; enteredAt: number; onExit: () => void; onHorizontal: (direction: number) => void; pan: MutableRefObject<GalleryPan | null>; position: MotionValue<number>; progress: MotionValue<number>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const opacity = useTransform(position, x => 1 - Math.min(1, Math.abs(x) / ((element.current?.clientWidth || 540) * .6)));
  const reduced = useReducedMotion() ?? false;
  const [page, setPage] = useState(0);
  const timer = useRef<number>();
  const horizontalTimer = useRef<number>();
  const horizontalDelta = useRef<number | null>(null);
  const rewinding = useRef(false);
  const animation = useRef<ReturnType<typeof animate>>();
  const inertiaFrame = useRef(0);
  const phase = useRef<'drag' | 'coast' | 'snap'>('snap');
  const drag = useRef<{ x: number; y: number; page: number; axis?: 'x' | 'y' } | null>(null);

  const velocity = useRef({ speed: 0, time: 0 });
  const wrap = (value: number) => ((value % deck.pages.length) + deck.pages.length) % deck.pages.length;
  const push = (value: number) => {
    const now = performance.now(), elapsed = now - velocity.current.time;
    const speed = (value - progress.get()) * 1000 / Math.max(16, Math.min(100, elapsed));
    velocity.current = { speed: elapsed < 100 ? velocity.current.speed * .35 + speed * .65 : speed, time: now };
    progress.set(value);
  };
  const stop = () => {
    cancelAnimationFrame(inertiaFrame.current);
    animation.current?.stop();
  };
  const go = (value: number, speed = 0) => {
    stop(); phase.current = 'snap';
    animation.current = animate(progress, value, reduced ? { duration: 0 } : { type: 'spring', stiffness: 130, damping: 23, mass: .8, velocity: speed });
  };
  const coast = () => {
    stop();
    if (reduced) { go(Math.round(progress.get())); return; }
    let speed = performance.now() - velocity.current.time < 180 ? velocity.current.speed : 0;
    let previous = performance.now();
    phase.current = 'coast';
    const tick = (now: number) => {
      const dt = Math.min(.04, (now - previous) / 1000);
      previous = now;
      // Free motion has no page target. Only slow motion may engage the snap spring.
      if (Math.abs(speed) <= .16) { go(Math.round(progress.get()), speed); return; }
      const decay = Math.exp(-4.2 * dt);
      progress.set(progress.get() + speed * (1 - decay) / 4.2);
      speed *= decay;
      inertiaFrame.current = requestAnimationFrame(tick);
    };
    inertiaFrame.current = requestAnimationFrame(tick);
  };
  useMotionValueEvent(progress, 'change', value => {
    setPage(Math.round(value));
    if (element.current) {
      element.current.dataset.motion = phase.current;
      element.current.dataset.position = value.toFixed(4);
    }
  });
  useMotionValueEvent(position, 'change', value => {
    if (Math.abs(value) < 1) rewinding.current = false;
    else if (!rewinding.current && Math.abs(progress.get() % deck.pages.length) > .001) rewind();
  });
  const rewind = () => {
    rewinding.current = true;
    window.clearTimeout(timer.current);
    stop();
    animation.current = animate(progress, Math.round(progress.get() / deck.pages.length) * deck.pages.length, { duration: reduced ? 0 : .22, ease: [.22, 1, .36, 1] });
  };

  useEffect(() => {
    const el = element.current!;

    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // Keep browser pinch-to-zoom available.
      event.preventDefault();
      event.stopPropagation();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        if (horizontalDelta.current === null) { horizontalDelta.current = 0; rewind(); pan.current?.start(0); }
        horizontalDelta.current += event.deltaX;
        pan.current?.move(-horizontalDelta.current);
        window.clearTimeout(horizontalTimer.current);
        horizontalTimer.current = window.setTimeout(() => { horizontalDelta.current = null; pan.current?.end(); }, 140);
        return;
      }

      stop(); phase.current = 'drag';
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
      push(progress.get() + delta / Math.max(180, el.clientWidth * .5625));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(coast, 100);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('wheel', wheel); window.clearTimeout(timer.current); window.clearTimeout(horizontalTimer.current); stop(); };
    // Deck changes remount the reader. Callbacks use the selected deck from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id, enteredAt, reduced]);

  return <motion.div className="gallery-wheel" data-page={wrap(page) + 1} data-progress={page} style={{ x: position, opacity }}>

    <div ref={element} className="gallery-wheel-viewport" tabIndex={0} role="region"
      aria-label={language === 'zh' ? '原位阅读，向上或向下滚动翻页' : 'Read in place. Scroll up or down to turn slides.'}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest('button, a')) return;
        if (['ArrowDown', 'PageDown', ' ', 'ArrowUp', 'PageUp', 'Home', 'End', 'Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
        if (['ArrowDown', 'PageDown', ' '].includes(event.key)) go(page + 1);
        if (['ArrowUp', 'PageUp'].includes(event.key)) go(page - 1);
        if (event.key === 'Home') go(Math.round(page / deck.pages.length) * deck.pages.length);
        if (event.key === 'End') go(Math.floor(page / deck.pages.length) * deck.pages.length + deck.pages.length - 1);
        if (event.key === 'Escape') onExit();
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') onHorizontal(event.key === 'ArrowRight' ? 1 : -1);
      }}
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if ((event.target as HTMLElement).closest('button, a')) return;
        stop(); window.clearTimeout(timer.current); phase.current = 'drag';
        velocity.current = { speed: 0, time: performance.now() };
        drag.current = { x: event.clientX, y: event.clientY, page: progress.get() };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        const dy = drag.current.y - event.clientY;
        const dx = drag.current.x - event.clientX;
        if (!drag.current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 5) {
          drag.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          if (drag.current.axis === 'x') { rewind(); pan.current?.start(drag.current.x); }
        }
        if (drag.current.axis === 'x') pan.current?.move(event.clientX);
        else if (drag.current.axis === 'y') push(drag.current.page + dy / Math.max(140, event.currentTarget.clientWidth * .5625));
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        if (drag.current.axis === 'x') pan.current?.end();
        else coast();
        drag.current = null;
      }}
      onPointerCancel={() => { if (drag.current?.axis === 'x') pan.current?.end(); drag.current = null; go(Math.round(progress.get())); }}
    >
      {Array.from({ length: 5 }, (_, i) => page + i - 2).map(slot => <WheelPage key={slot} deck={deck} index={wrap(slot)} slot={slot} progress={progress} reduced={reduced} language={language} onLoad={() => pan.current?.paint()} />)}
    </div>
    <div className="gallery-page-controls">
      <button onClick={() => go(page - 1)} aria-label={language === 'zh' ? '上一页' : 'Previous slide'}><ArrowUp size={18} /></button>
      <span aria-live="polite" aria-atomic="true">{String(wrap(page) + 1).padStart(2, '0')} / {String(deck.pages.length).padStart(2, '0')}</span>
      <button onClick={() => go(page + 1)} aria-label={language === 'zh' ? '下一页' : 'Next slide'}><ArrowDown size={18} /></button>
    </div>
  </motion.div>;
}
