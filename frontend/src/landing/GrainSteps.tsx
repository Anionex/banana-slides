import { useEffect, useRef } from 'react';
import { getHeroGrainUrl, HERO_GRAIN_OPACITY } from './heroGrain';

/** Rounded rectangle motif; only the hero opts into 21st's bitmap grain. */
export function GrainSteps({ className = '', bitmapGrain = false }: { className?: string; bitmapGrain?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bitmapGrain || !root.current) return;
    root.current.style.setProperty('--hero-grain-image', `url("${getHeroGrainUrl()}")`);
    root.current.style.setProperty('--hero-grain-opacity', String(HERO_GRAIN_OPACITY));
  }, [bitmapGrain]);
  return <div ref={root} className={`grain-steps ${bitmapGrain ? 'grain-steps-bitmap' : ''} ${className}`} aria-hidden="true">
    <span /><span /><span /><span />
  </div>;
}
