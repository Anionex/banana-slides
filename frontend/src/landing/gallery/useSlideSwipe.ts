import { useRef, type PointerEvent } from 'react';

/** Horizontal swipes turn one slide; vertical scrolling and pinch zoom stay native. */
export function useSlideSwipe(step: (direction: number) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressed = useRef(false);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary || event.button !== 0) { start.current = null; return; }
      start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
      suppressed.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!start.current) return;
      if (Math.abs(event.clientX - start.current.x) > 8 || Math.abs(event.clientY - start.current.y) > 8) suppressed.current = true;
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const origin = start.current;
      start.current = null;
      if (!origin || origin.id !== event.pointerId) return;
      const x = event.clientX - origin.x, y = event.clientY - origin.y;
      if (Math.abs(x) > 48 && Math.abs(x) > Math.abs(y) * 1.3) { suppressed.current = true; step(x < 0 ? 1 : -1); }
    },
    onPointerCancel() { start.current = null; suppressed.current = true; },
    shouldOpen: () => !suppressed.current,
  };
}
