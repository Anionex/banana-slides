import { useEffect, useRef } from 'react';
import { getHeroGrainUrl, grainOpacity, LANDING_GRAIN } from './heroGrain';
import { createRibbonRenderer, ribbonDimensions } from './ribbonField';
import './footer-ribbon.css';

export function FooterRibbon({ speed = 1, grain = LANDING_GRAIN }: { speed?: number; grain?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = root.current;
    const canvas = surface.current;
    const context = canvas?.getContext('2d');
    if (!element || !canvas || !context) return;
    element.style.setProperty('--ribbon-grain', `url("${getHeroGrainUrl()}")`);
    element.style.setProperty('--ribbon-grain-opacity', String(grainOpacity(grain)));
    const render = createRibbonRenderer(context);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let elapsed = 0;
    let previous: number | undefined;
    let visible = false;
    const draw = () => render(canvas.width, canvas.height, elapsed * speed);
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      const { width, height } = ribbonDimensions(bounds.width, bounds.height, !reduced.matches,
        reduced.matches ? Math.min(2, devicePixelRatio || 1) : 1);
      canvas.width = width;
      canvas.height = height;
      draw();
    };
    const tick = (now: number) => {
      // Same suspended-tab time clamp as the reference editor.
      if (previous !== undefined) elapsed += Math.min(0.05, (now - previous) / 1000);
      previous = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const playback = () => {
      cancelAnimationFrame(frame);
      previous = undefined;
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const motionPreference = () => { resize(); playback(); };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; playback(); });
    intersection.observe(element);
    document.addEventListener('visibilitychange', playback);
    reduced.addEventListener('change', motionPreference);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', playback);
      reduced.removeEventListener('change', motionPreference);
    };
  }, [speed, grain]);
  return <div ref={root} className="footer-ribbon" aria-hidden="true"><canvas ref={surface} /></div>;
}
