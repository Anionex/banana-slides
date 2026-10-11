import { useEffect, useRef } from 'react';
import { getHeroGrainUrl, HERO_GRAIN_OPACITY } from './heroGrain';
import { createRibbonRenderer, RIBBON_COLORS } from './ribbonField';
import './beta-ribbon.css';

// Overhead waves travel horizontally through the existing yellow/white palette.
const flowSpeed = 0.55;

export function BetaRibbon() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const button = canvas?.parentElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !button || !context) return;

    const render = createRibbonRenderer(context, RIBBON_COLORS, {
      softness: 40, wave: 20, waveFrequency: 0.85, flow: 'horizontal',
    });
    let ratio = 1;
    let texture: CanvasPattern | null = null;
    let frame = 0;
    let elapsed = 0;
    let previous: number | undefined;
    let visible = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = () => {
      render(canvas.width, canvas.height, elapsed * flowSpeed);
      if (texture) {
        context.save();
        context.scale(ratio, ratio);
        context.globalCompositeOperation = 'overlay';
        context.globalAlpha = HERO_GRAIN_OPACITY;
        context.fillStyle = texture;
        context.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
        context.restore();
      }
      button.dataset.betaRibbon = 'ready';
    };
    const resize = () => {
      ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.ceil(button.clientWidth * ratio));
      canvas.height = Math.max(1, Math.ceil(button.clientHeight * ratio));
      draw();
    };
    const tick = (now: number) => {
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
    const grain = new Image();
    grain.onload = () => { texture = context.createPattern(grain, 'repeat'); draw(); };
    grain.src = getHeroGrainUrl();
    const observer = new ResizeObserver(resize);
    observer.observe(button);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; playback(); });
    intersection.observe(button);
    reduced.addEventListener('change', playback);
    document.addEventListener('visibilitychange', playback);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      reduced.removeEventListener('change', playback);
      document.removeEventListener('visibilitychange', playback);
      grain.onload = null;
      delete button.dataset.betaRibbon;
    };
  }, []);
  return <canvas ref={ref} className="beta-ribbon" aria-hidden="true" />;
}
