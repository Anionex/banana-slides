import { useEffect, useRef } from 'react';
import { getHeroGrainUrl, HERO_GRAIN_OPACITY } from './heroGrain';

/** Rounded rectangle motif sharing the footer's bitmap grain across illustrations. */
export function GrainSteps({ className = '', bitmapGrain = true, interactive = false }: { className?: string; bitmapGrain?: boolean; interactive?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bitmapGrain || !root.current) return;
    root.current.style.setProperty('--hero-grain-image', `url("${getHeroGrainUrl()}")`);
    root.current.style.setProperty('--hero-grain-opacity', String(HERO_GRAIN_OPACITY));
  }, [bitmapGrain]);
  useEffect(() => {
    const element = root.current;
    const surface = element?.parentElement;
    if (!interactive || !element || !surface) return;
    const preference = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
    const washes = Array.from(element.querySelectorAll<HTMLElement>('.grain-wash'));
    let frame = 0;
    const leave = () => {
      cancelAnimationFrame(frame);
      element.removeAttribute('data-pointer-active');
    };
    const move = (event: PointerEvent) => {
      if (!preference.matches || event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const wash of washes) {
          const rect = wash.getBoundingClientRect();
          wash.style.setProperty('--wash-x', `${event.clientX - rect.left}px`);
          wash.style.setProperty('--wash-y', `${event.clientY - rect.top}px`);
        }
        element.setAttribute('data-pointer-active', '');
      });
    };
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerleave', leave);
    surface.addEventListener('pointercancel', leave);
    preference.addEventListener('change', leave);
    window.addEventListener('blur', leave);
    return () => {
      leave();
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerleave', leave);
      surface.removeEventListener('pointercancel', leave);
      preference.removeEventListener('change', leave);
      window.removeEventListener('blur', leave);
    };
  }, [interactive]);
  return <div ref={root} className={`grain-steps ${bitmapGrain ? 'grain-steps-bitmap' : ''} ${className}`} aria-hidden="true">
    {[0, 1, 2, 3].map(index => <span key={index}>{interactive && <i className="grain-wash" />}</span>)}
  </div>;
}
