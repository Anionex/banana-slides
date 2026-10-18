import { useEffect, useRef, useState } from 'react';
import { useMotionValue, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { CurvedGallery, type GalleryPan } from './CurvedGallery';
import { WheelDeck } from './WheelDeck';
import { decks as catalogDecks, pageSource } from './catalog';
import { preloadSlide } from './preloadSlide';
import { hasDeckOverview } from './DeckOverview';
import { deckPath } from './deckDetails';
import './gallery-curved-showcase.css';

const decks = catalogDecks.filter(deck => hasDeckOverview(deck.id)).slice(0, 6);
const interval = 3600;

export function GalleryCurvedShowcase({ language }: { language: 'zh' | 'en' }) {
  const zh = language === 'zh';
  const root = useRef<HTMLElement>(null);
  const pan = useRef<GalleryPan | null>(null);
  const position = useMotionValue(0);
  const progress = useMotionValue(0);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(() => decks.findIndex(deck => deck.id === 'deepseek'));
  const [centered, setCentered] = useState(active);
  const [reading, setReading] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [enteredAt, setEnteredAt] = useState(0);
  const hovering = useRef(false);
  const visible = useRef(false);
  const nextAt = useRef(0);
  const interacting = () => { nextAt.current = performance.now() + interval; };
  const select = (index: number) => {
    if (index === active) return;
    setReading(false); progress.set(0); setActive(index);
    interacting();
  };
  const read = () => { interacting(); if (!reading) { progress.set(0); setEnteredAt(performance.now()); setReading(true); } };
  const step = (direction: number) => { interacting(); pan.current?.step(direction); };

  useEffect(() => {
    if (nearby) void preloadSlide(pageSource(decks[active], 0)).catch(() => {});
  }, [active, nearby]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearby(true); observer.disconnect(); }
    }, { rootMargin: '400px' });
    observer.observe(root.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = root.current!;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) nextAt.current = performance.now() + interval;
    }, { threshold: .3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || reading) return;
    nextAt.current = performance.now() + interval;
    const timer = window.setInterval(() => {
      if (!visible.current || document.hidden || root.current?.closest('[inert]') || hovering.current || performance.now() < nextAt.current) return;
      const stage = root.current?.querySelector<HTMLElement>('.gallery-stage');
      if (!stage || stage.dataset.motion !== 'idle' || root.current?.contains(document.activeElement)) return;
      nextAt.current = performance.now() + interval;
      pan.current?.step(1);
    }, 250);
    return () => window.clearInterval(timer);
  }, [reduced, reading]);

  const exitReading = () => { setReading(false); progress.set(0); interacting(); };
  const deck = decks[active];
  const captionDeck = decks[centered];

  return <section ref={root} id="works-curved" className="landing-section landing-container curved-showcase" data-reading={reading}
    onPointerEnter={() => { hovering.current = true; }} onPointerLeave={() => { hovering.current = false; interacting(); }}
    onPointerDownCapture={interacting} onWheelCapture={interacting} onKeyDownCapture={interacting}>
    <div className="curved-showcase-heading">
      <h2>{zh ? '快与美，并不矛盾' : 'Fast can be beautiful.'}</h2>
      <p>{zh ? '用 Banana Slides 创作的真实作品。' : 'Real presentations made with Banana Slides.'}</p>
    </div>
    <div className="curved-showcase-frame">
      <CurvedGallery decks={decks} active={active} onSelect={select} onCenterChange={setCentered} language={language}
        coverSource={item => `/gallery/overviews/${item.id}-${language}.webp`}
        label={zh ? '精选作品，左右键切换，回车逐页浏览' : 'Selected decks. Arrow keys to browse, Enter to read.'}
        reading={reading} expanded={reading} onRead={read} pan={pan} position={position} progress={progress} interaction="showcase">
        {reading && <WheelDeck key={deck.id} deck={deck} language={language} enteredAt={enteredAt} onExit={exitReading} onHorizontal={step} pan={pan} position={position} progress={progress} />}
      </CurvedGallery>
    </div>
    <div className="curved-showcase-caption">
      <a className="curved-showcase-title" href={`${deckPath(captionDeck.id, language)}?from=home`}>{captionDeck.title[language]}<ArrowUpRight size={13} /></a>
      <div className="curved-showcase-reader-actions" aria-hidden={!reading}>
        <div><button className="curved-showcase-read" type="button" disabled={!reading} tabIndex={reading ? 0 : -1} onClick={exitReading}>{zh ? '返回总览' : 'Back to overview'}</button></div>
      </div>
    </div>
    <div className="curved-showcase-footer">
      <button className="curved-showcase-arrow" type="button" onClick={() => step(-1)} aria-label={zh ? '上一个作品' : 'Previous deck'}><ArrowLeft size={18} /></button>
      <div className="curved-showcase-dots">{decks.map((item, index) => <button type="button" className="no-min-touch-target" key={item.id} aria-label={item.title[language]} aria-pressed={centered === index} onClick={() => { interacting(); pan.current?.select(index); }}><span /></button>)}</div>
      <button className="curved-showcase-arrow" type="button" onClick={() => step(1)} aria-label={zh ? '下一个作品' : 'Next deck'}><ArrowRight size={18} /></button>
    </div>
    <div className="curved-showcase-cta">
      <a className="curved-showcase-gallery-link" href={`${zh ? '' : '/en'}/gallery/`}>{zh ? '前往作品画廊' : 'Explore the gallery'}</a>
    </div>
  </section>;
}
