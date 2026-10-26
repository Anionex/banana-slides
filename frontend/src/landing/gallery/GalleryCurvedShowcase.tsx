import { useEffect, useRef, useState } from 'react';
import { motionValue, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';
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
type ReaderSession = { id: number; index: number; progress: MotionValue<number>; initialWheel: number; returning: boolean };

export function GalleryCurvedShowcase({ language }: { language: 'zh' | 'en' }) {
  const zh = language === 'zh';
  const root = useRef<HTMLElement>(null);
  const pan = useRef<GalleryPan | null>(null);
  const position = useMotionValue(0);
  const idleProgress = useMotionValue(0);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(() => decks.findIndex(deck => deck.id === 'deepseek'));
  const [centered, setCentered] = useState(active);
  const [reader, setReader] = useState<ReaderSession | null>(null);
  const nextReader = useRef(0);
  const reading = reader !== null;
  const progress = reader?.progress ?? idleProgress;
  const [nearby, setNearby] = useState(false);
  const hovering = useRef(false);
  const visible = useRef(false);
  const nextAt = useRef(0);
  const interacting = () => { nextAt.current = performance.now() + interval; };
  const select = (index: number) => {
    if (index === active) return;
    setReader(null); setActive(index);
    interacting();
  };
  const read = (index = active, wheelDelta = 0) => {
    interacting();
    setActive(index); setCentered(index);
    setReader({ id: ++nextReader.current, index,
      progress: reader?.index === index ? reader.progress : motionValue(0),
      initialWheel: wheelDelta, returning: false });
  };
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

  // A completion from an old reader may never close a newer reading intent.
  const exitReading = (id: number) => { setReader(current => current?.id === id ? null : current); interacting(); };
  const resumeReading = (id: number) => setReader(current => current?.id === id && current.returning ? { ...current, returning: false } : current);
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
        coverSrcSet={item => `/gallery/overviews/${item.id}-${language}-800.webp 800w, /gallery/overviews/${item.id}-${language}.webp 1600w`}
        coverSizes="(max-width: 640px) 74vw, (max-width: 1180px) 39vw, 460px"
        label={zh ? '精选作品，左右键切换，回车逐页浏览' : 'Selected decks. Arrow keys to browse, Enter to read.'}
        reading={reading} expanded={reading} onRead={read} pan={pan} position={position} progress={progress} interaction="showcase">
        {reader && <WheelDeck key={deck.id} deck={deck} overviewSource={`/gallery/overviews/${deck.id}-${language}.webp`} language={language} enteredAt={reader.id} initialWheel={reader.initialWheel} returning={reader.returning} onExit={() => exitReading(reader.id)} onResume={() => resumeReading(reader.id)} onHorizontal={step} pan={pan} position={position} progress={progress} />}
      </CurvedGallery>
    </div>
    <div className="curved-showcase-caption">
      <a className="curved-showcase-title" href={`${deckPath(captionDeck.id, language)}?from=home`}>{captionDeck.title[language]}<ArrowUpRight size={13} /></a>
      <div className="curved-showcase-reader-actions" aria-hidden={!reading}>
        <div><button className="curved-showcase-read" type="button" disabled={!reading} tabIndex={reading ? 0 : -1} onClick={() => setReader(current => current ? { ...current, returning: true } : current)}>{zh ? '返回总览' : 'Back to overview'}</button></div>
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
