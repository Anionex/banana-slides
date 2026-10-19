import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { animate, motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import type { GalleryPan } from './CurvedGallery';
import type { GalleryDeck } from './types';

function WheelPage({ deck, overviewSource, index, slot, progress, reduced, language, onLoad }: {
  deck: GalleryDeck; overviewSource: string; index: number; slot: number; onLoad: () => void; progress: MotionValue<number>; reduced: boolean; language: 'zh' | 'en';
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Every page shares one flat belt: equal spacing, no perspective or scaling.
  const transform = useTransform(progress, value => {
    const offset = slot - (reduced ? Math.round(value) : value);
    return `translate3d(0, calc(${offset * 100}% + ${offset * 16}px), 0)`;
  });
  const dimensions = index === 0 ? { width: 800, height: 450 } : deck.pages[index - 1];
  const source = index === 0 ? overviewSource : `/gallery/${deck.id}/${index}.webp`;
  const current = Math.round(progress.get()) === slot;
  return <motion.figure className="gallery-wheel-page" data-slot={slot} style={{ transform }} aria-hidden={!current}>
    {failed ? <div className="gallery-image-error"><p>{language === 'zh' ? '页面暂时无法加载' : 'This slide could not load'}</p><button tabIndex={current ? 0 : -1} onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>{language === 'zh' ? '重新加载' : 'Retry'}</button></div>
      : <img src={`${source}${attempt ? `?retry=${attempt}` : ''}`} alt={`${deck.title[language]} · ${index === 0 ? (language === 'zh' ? '总览' : 'Overview') : index}`} {...dimensions} draggable={false} onLoad={onLoad} onError={() => setFailed(true)} />}
  </motion.figure>;
}

export function WheelDeck({ deck, overviewSource, language, enteredAt, initialWheel = 0, returning = false, onExit, onResume, onHorizontal, pan, position, progress }: {
  deck: GalleryDeck; overviewSource: string; language: 'zh' | 'en'; enteredAt: number; initialWheel?: number; returning?: boolean; onExit: () => void; onResume?: () => void; onHorizontal: (direction: number) => void; pan: MutableRefObject<GalleryPan | null>; position: MotionValue<number>; progress: MotionValue<number>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const [page, setPage] = useState(0);
  const timer = useRef<number>();
  const horizontalTimer = useRef<number>();
  const horizontalDelta = useRef<number | null>(null);
  const rewinding = useRef(false);
  const closeOnRelease = useRef(false);
  const consumedWheel = useRef<number | null>(null);
  const animation = useRef<ReturnType<typeof animate>>();
  const motionEpoch = useRef(0);
  const callbacks = useRef({ onExit, onResume });
  callbacks.current = { onExit, onResume };
  const transform = useTransform(position, value => `translate3d(${value}px, 0, 0)`);
  const inertiaFrame = useRef(0);
  const wheelMotion = useRef<{ target: number; speed: number; lastInput: number; time: number } | null>(null);
  const phase = useRef<'drag' | 'coast' | 'snap'>('snap');
  const drag = useRef<{ x: number; y: number; page: number; axis?: 'x' | 'y' } | null>(null);

  const velocity = useRef({ speed: 0, time: 0 });
  const pageCount = deck.pages.length + 1; // Overview is page 0 in the same belt.
  const wrap = (value: number) => ((value % pageCount) + pageCount) % pageCount;
  const push = (value: number) => {
    const now = performance.now(), elapsed = now - velocity.current.time;
    const speed = (value - progress.get()) * 1000 / Math.max(16, Math.min(100, elapsed));
    velocity.current = { speed: elapsed < 100 ? velocity.current.speed * .35 + speed * .65 : speed, time: now };
    progress.set(value);
  };
  const stop = () => {
    motionEpoch.current++;
    cancelAnimationFrame(inertiaFrame.current);
    wheelMotion.current = null;
    animation.current?.stop();
  };
  const go = (value: number, speed = progress.getVelocity(), instant = false) => {
    stop(); phase.current = 'snap';
    if (reduced || instant) { progress.set(value); return; }
    animation.current = animate(progress, value, { type: 'spring', stiffness: 240, damping: 28, mass: .8, velocity: speed, restSpeed: .03, restDelta: .002 });
  };
  const resume = () => {
    closeOnRelease.current = false; rewinding.current = false;
    callbacks.current.onResume?.();
  };
  const coast = (initialSpeed?: number) => {
    stop();
    if (reduced) { go(Math.round(progress.get())); return; }
    let speed = initialSpeed ?? (performance.now() - velocity.current.time < 180 ? velocity.current.speed : 0);
    let previous = performance.now();
    phase.current = 'coast';
    const tick = (now: number) => {
      const dt = Math.min(.04, (now - previous) / 1000);
      previous = now;
      // Free motion has no page target. Only slow motion may engage the snap spring.
      const decay = Math.exp(-4.2 * dt);
      progress.set(progress.get() + speed * (1 - decay) / 4.2);
      const nextSpeed = speed * decay;
      velocity.current = { speed: nextSpeed, time: now };
      const slowingDown = Math.abs(nextSpeed) <= Math.abs(speed);
      if (element.current) element.current.dataset.speed = Math.abs(nextSpeed).toFixed(5);
      // Capture the slow tail (~30px/s), carrying its velocity into the spring.
      if (slowingDown && Math.abs(nextSpeed) <= .12) { go(Math.round(progress.get()), nextSpeed); return; }
      speed = nextSpeed;
      inertiaFrame.current = requestAnimationFrame(tick);
    };
    inertiaFrame.current = requestAnimationFrame(tick);
  };
  const scrollWheel = (delta: number) => {
    const now = performance.now();
    if (wheelMotion.current) {
      wheelMotion.current.target += delta;
      wheelMotion.current.lastInput = now;
      return;
    }
    const speed = now - velocity.current.time < 180 ? velocity.current.speed : 0;
    stop(); phase.current = 'drag';
    const state = { target: progress.get() + delta, speed, lastInput: now, time: now };
    wheelMotion.current = state;
    const tick = (time: number) => {
      const dt = Math.min(.04, (time - state.time) / 1000);
      state.time = time;
      // A critically damped response smooths wheel notches without pausing between
      // input and inertia. Preserve the actual velocity when the gesture ends.
      const omega = 24, offset = progress.get() - state.target;
      const term = (state.speed + omega * offset) * dt, decay = Math.exp(-omega * dt);
      state.speed = (state.speed - omega * term) * decay;
      progress.set(state.target + (offset + term) * decay);
      velocity.current = { speed: state.speed, time };
      if (time - state.lastInput >= 100) { coast(state.speed); return; }
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
    if (returning) return;
    if (Math.abs(value) < 1) rewinding.current = false;
    else if (element.current?.closest<HTMLElement>('.gallery-stage')?.dataset.horizontal === 'true' && !rewinding.current) rewind(finishDeparture);
  });
  const finishDeparture = () => {
    // Keep pointer capture until release; a new click never waits for coast/snap.
    if (drag.current?.axis === 'x') closeOnRelease.current = true;
    else callbacks.current.onExit();
  };
  const rewind = (onComplete?: () => void) => {
    rewinding.current = true;
    window.clearTimeout(timer.current);
    const speed = progress.getVelocity();
    stop();
    const target = Math.round(progress.get() / pageCount) * pageCount;
    if (reduced) { progress.set(target); onComplete?.(); return; }
    const epoch = motionEpoch.current;
    animation.current = animate(progress, target, {
      type: 'spring', stiffness: 500, damping: 40, mass: .8, velocity: speed,
      restSpeed: .03, restDelta: .002,
      onComplete: () => { if (motionEpoch.current === epoch) { progress.set(target); onComplete?.(); } },
    });
  };

  useEffect(() => {
    const el = element.current!;
    const stage = el.closest<HTMLElement>('.gallery-stage')!;

    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // Keep browser pinch-to-zoom available.
      const contains = (bounds: DOMRect) => event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      // The reader is one continuous scrolling surface, including the gaps
      // between slides. Hit-testing individual pages leaks wheel input to the body.
      if (!contains(el.getBoundingClientRect())) return;
      if (stage.dataset.horizontal === 'true') {
        const overCover = Array.from(stage.querySelectorAll<HTMLElement>('.gallery-cover')).some(cover => cover.dataset.deck === deck.id && contains(cover.getBoundingClientRect()));
        if (!overCover) return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        if (horizontalDelta.current === null) { horizontalDelta.current = 0; rewind(finishDeparture); pan.current?.start(0); }
        horizontalDelta.current += event.deltaX;
        pan.current?.move(-horizontalDelta.current);
        window.clearTimeout(horizontalTimer.current);
        horizontalTimer.current = window.setTimeout(() => { horizontalDelta.current = null; pan.current?.end(); }, 140);
        return;
      }

      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
      const distance = delta / Math.max(180, el.clientWidth * .5625);
      resume();
      if (reduced) {
        stop(); push(progress.get() + distance);
        window.clearTimeout(timer.current); timer.current = window.setTimeout(coast, 100);
      } else scrollWheel(distance);
    };
    // The event that mounts this reader is already dispatched. Consume its delta
    // here so the first wheel notch moves the pages too.
    const initialFrame = consumedWheel.current !== enteredAt ? requestAnimationFrame(() => {
      consumedWheel.current = enteredAt;
      // Mount on the identical overview, then move along the belt to slide 1.
      if (!initialWheel) { go(progress.get() === 0 ? 1 : Math.round(progress.get())); return; }
      const distance = initialWheel / Math.max(180, el.clientWidth * .5625);
      if (reduced) { push(progress.get() + distance); timer.current = window.setTimeout(coast, 100); }
      else scrollWheel(distance);
    }) : 0;
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(initialFrame); stage.removeEventListener('wheel', wheel); window.clearTimeout(timer.current); window.clearTimeout(horizontalTimer.current); stop(); };
    // Deck changes remount the reader. Callbacks use the selected deck from this render.
  }, [deck.id, enteredAt, reduced]);

  useEffect(() => {
    if (returning) rewind(onExit);
  }, [returning]);

  return <motion.div className="gallery-wheel" data-deck={deck.id} data-page={wrap(page)} data-progress={page} style={{ transform }}>

    <div ref={element} className="gallery-wheel-viewport" tabIndex={0} role="region"
      aria-label={language === 'zh' ? '原位阅读，向上或向下滚动翻页' : 'Read in place. Scroll up or down to turn slides.'}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest('button, a')) return;
        if (!['ArrowDown', 'PageDown', ' ', 'ArrowUp', 'PageUp', 'Home', 'End', 'Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        resume();
        if (['ArrowDown', 'PageDown', ' '].includes(event.key)) go(page + 1, 0, true);
        if (['ArrowUp', 'PageUp'].includes(event.key)) go(page - 1, 0, true);
        if (event.key === 'Home') go(Math.round(page / pageCount) * pageCount, 0, true);
        if (event.key === 'End') go(Math.floor(page / pageCount) * pageCount + pageCount - 1, 0, true);
        if (event.key === 'Escape') rewind(onExit);
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') onHorizontal(event.key === 'ArrowRight' ? 1 : -1);
      }}
      onPointerDown={event => {
        if (drag.current || !event.isPrimary) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if ((event.target as HTMLElement).closest('button, a')) return;
        resume(); stop(); window.clearTimeout(timer.current); phase.current = 'drag';
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
          if (drag.current.axis === 'x') { rewind(finishDeparture); pan.current?.start(drag.current.x); }
        }
        if (drag.current.axis === 'x') pan.current?.move(event.clientX);
        else if (drag.current.axis === 'y') push(drag.current.page + dy / Math.max(140, event.currentTarget.clientWidth * .5625));
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        if (drag.current.axis === 'x') pan.current?.end();
        else coast();
        drag.current = null;
        if (closeOnRelease.current) onExit();
      }}
      onPointerCancel={() => { const horizontal = drag.current?.axis === 'x'; if (horizontal) pan.current?.end(); drag.current = null; if (horizontal) onExit(); else go(Math.round(progress.get())); }}
    >
      {Array.from({ length: 5 }, (_, i) => page + i - 2).map(slot => <WheelPage key={slot} deck={deck} overviewSource={overviewSource} index={wrap(slot)} slot={slot} progress={progress} reduced={reduced} language={language} onLoad={() => pan.current?.paint()} />)}
    </div>
  </motion.div>;
}
