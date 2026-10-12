import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useScroll, useTransform, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';

// Ported from Waymark's public SiteHeader bundle; provenance and adaptations in README.md.
const compactHeight = 52;

export default function ScrollHeader({ brand, navigation, actions, label }: {
  brand: ReactNode; navigation: ReactNode; actions: ReactNode; label: string;
}) {
  const shell = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const highlightedItem = useRef<HTMLElement | null>(null);
  const [highlight, setHighlight] = useState<{ x: number; y: number; width: number; height: number; instant: boolean } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [glassReady, setGlassReady] = useState(false);
  const [targetScale, setTargetScale] = useState(1);
  const [expandedHeight, setExpandedHeight] = useState(96);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const progress = useMotionValue(0);
  const verticalProgress = useMotionValue(0);
  const scale = useTransform(progress, [0, 1], [1, targetScale]);
  const inverse = useTransform(scale, value => 1 / value);
  const radius = useTransform(scale, value => `${24 / value}px / 24px`);
  const height = useTransform(verticalProgress, [0, 1], [expandedHeight, compactHeight]);
  const y = useTransform(verticalProgress, [0, 1], [0, 8]);
  useMotionValueEvent(scrollY, 'change', value => setScrolled(value > 24));
  useMotionValueEvent(verticalProgress, 'change', value => setGlassReady(value >= .98));

  useEffect(() => {
    // Settle the height before showing glass; let the width ease in more slowly.
    const animation = animate(progress, scrolled ? 1 : 0, {
      duration: reduce ? 0 : .65,
      ease: [.25, .1, .25, 1],
    });
    const verticalAnimation = animate(verticalProgress, scrolled ? 1 : 0, {
      duration: reduce ? 0 : .32,
      ease: [.22, 1, .36, 1],
    });
    return () => { animation.stop(); verticalAnimation.stop(); };
  }, [progress, verticalProgress, reduce, scrolled]);

  useEffect(() => {
    const element = bar.current;
    if (!element || !shell.current) return;
    setScrolled(window.scrollY > 24);
    const measure = () => {
      setExpandedHeight(parseFloat(getComputedStyle(shell.current!).getPropertyValue('--header-height')));
      // The original minimum is 720px. Our extra language/GitHub actions need more room.
      const groups = Array.from(element.children) as HTMLElement[];
      const minimum = groups.reduce((total, group) => total + group.offsetWidth, 0) + 64;
      setTargetScale(window.innerWidth >= 1024
        ? Math.min(1, Math.max(800 / 1152, minimum / element.offsetWidth))
        : 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    Array.from(element.children).forEach(child => observer.observe(child));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const staticScale = scrolled ? targetScale : 1;
  const counterScale = reduce ? 1 / staticScale : inverse;
  // Waymark's shared highlight: first entry is immediate; subsequent items spring across.
  const clearHighlight = () => { highlightedItem.current = null; setHighlight(null); };
  const moveHighlight = (target: EventTarget, instant = false) => {
    const item = target instanceof Element ? target.closest<HTMLElement>('a, button') : null;
    if (!item || highlightedItem.current === item) return;
    highlightedItem.current = item;
    setHighlight(previous => ({
      x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight,
      instant: instant || previous === null,
    }));
  };
  return <header ref={shell} className="landing-header" data-scrolled={scrolled} data-glass={scrolled && glassReady}>
    <motion.div ref={bar} className="landing-nav landing-container" style={{
      scaleX: reduce ? staticScale : scale,
      borderRadius: reduce ? `${24 / staticScale}px / 24px` : radius,
      height: reduce ? (scrolled ? compactHeight : expandedHeight) : height,
      y: reduce ? (scrolled ? 8 : 0) : y,
    }}>
      <motion.div className="landing-nav-brand" style={{ scaleX: counterScale, originX: 0 }}>{brand}</motion.div>
      <motion.nav aria-label={label} style={{ scaleX: counterScale, originX: .5 }}
        onPointerMove={event => { if (event.pointerType !== 'touch') moveHighlight(event.target); }}
        onFocusCapture={event => moveHighlight(event.target, true)}
        onPointerLeave={clearHighlight}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) clearHighlight(); }}>
        <motion.span aria-hidden="true" className="landing-nav-highlight" initial={false}
          animate={{ transform: `translate(${highlight?.x ?? 0}px, ${highlight?.y ?? 0}px)`, width: highlight?.width ?? 0, height: highlight?.height ?? 0, opacity: Number(Boolean(highlight)) }}
          transition={reduce || !highlight || highlight.instant ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32, mass: .6 }} />
        {navigation}
      </motion.nav>
      <motion.div className="landing-nav-actions" style={{ scaleX: counterScale, originX: 1 }}>{actions}</motion.div>
    </motion.div>
  </header>;
}
