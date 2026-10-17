import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { LandingTheme, ThemeToggle } from '../LandingTheme';
import { LanguageMenu } from '../LanguageMenu';
import { CurvedGallery, type GalleryPan } from './CurvedGallery';
import { WheelDeck } from './WheelDeck';
import manifest from './manifest.json';
import type { GalleryDeck } from './types';
import '../landing.css';
import '../landing-typography.css';
import '../landing-theme.css';
import './gallery.css';

const decks: GalleryDeck[] = manifest;
const strings = {
  zh: { title: '每一个想法，都有好看的样子。', intro: '用 Banana Slides 创作的真实作品。横向挑选作品，滚动原位翻页。', home: '回到首页', demo: '体验 Demo', previous: '上一个作品', next: '下一个作品', read: '左右拖动挑选作品，上下滚动翻页', pages: '页', skip: '跳到作品内容', original: '原始作品来自 GitHub 社区案例，内容保持原样。', deckLabel: '作品画廊，左右方向键切换作品' },
  en: { title: 'Every idea has a look of its own.', intro: 'Real presentations made with Banana Slides. Browse sideways. Scroll through each deck in place.', home: 'Back to home', demo: 'Try the demo', previous: 'Previous presentation', next: 'Next presentation', read: 'Drag sideways to browse. Scroll up or down to turn slides.', pages: 'slides', skip: 'Skip to presentation', original: 'Original presentations from the GitHub community showcase, presented as shared.', deckLabel: 'Presentation gallery. Use left and right arrow keys to browse.' },
};

export function Gallery() { return <LandingTheme><GalleryContent /></LandingTheme>; }

function GalleryContent() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = strings[language];
  const [active, setActive] = useState(() => {
    if (typeof location === 'undefined') return 0;
    return Math.max(0, decks.findIndex(deck => deck.id === new URLSearchParams(location.search).get('deck')));
  });
  const [reading, setReading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pan = useRef<GalleryPan | null>(null);
  const position = useMotionValue(0);
  const progress = useMotionValue(0);
  const [enteredAt, setEnteredAt] = useState(0);
  const reduced = useReducedMotion();
  const startReading = useCallback(() => { progress.set(0); setEnteredAt(performance.now()); setExpanded(true); setReading(true); }, [progress]);
  const changeDeck = (step: number) => pan.current?.select((active + step + decks.length) % decks.length);
  const selectDeck = (index: number) => {
    if (index === active) return;
    setReading(false); setActive(index);
  };
  const deck = decks[active];
  const path = language === 'zh' ? '/gallery/' : '/en/gallery/';
  useEffect(() => {
    document.title = `${language === 'zh' ? '作品画廊' : 'Presentation gallery'} | Banana Slides`;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.intro);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://bananaslides.online${path}`);
    history.replaceState(null, '', `${path}?deck=${deck.id}`);
  }, [deck.id, language, path, t.intro]);

  const backToGallery = () => {
    setReading(false);
    document.querySelector<HTMLElement>('.gallery-track')?.focus({ preventScroll: true });
  };

  return <div className="landing-page gallery-page">
    <a className="landing-skip" href="#gallery-selection">{t.skip}</a>
    <header className="gallery-header">
      <a className="brand" href={language === 'zh' ? '/' : '/en/'} aria-label={t.home}><img src={logoUrl} alt="" width="32" height="32" /><span>Banana Slides</span></a>
      <nav aria-label={language === 'zh' ? '主导航' : 'Main navigation'}><a className="gallery-home-link" href={language === 'zh' ? '/' : '/en/'}>{t.home}</a><LanguageMenu /><ThemeToggle /><a className="studio-button studio-button-dark" href="/app">{t.demo}<ArrowUpRight size={16} /></a></nav>
    </header>
    <main>
      <section id="gallery-selection" className="gallery-selection" data-reading={expanded} aria-labelledby="gallery-title">
        <div className="gallery-intro">
          <h1 id="gallery-title">{t.title}</h1>
          <div className="gallery-intro-navigation">
            <button className="gallery-arrow" onClick={() => changeDeck(-1)} aria-label={t.previous}><ArrowLeft size={21} /></button>
            <p>{t.intro}</p>
            <button className="gallery-arrow" onClick={() => changeDeck(1)} aria-label={t.next}><ArrowRight size={21} /></button>
          </div>
        </div>
        <div className="gallery-experience">
          <motion.div layout="position" className="gallery-stage-wrap" transition={{ duration: reduced ? 0 : .6, ease: [.22, 1, .36, 1] }}>
            <CurvedGallery decks={decks} active={active} onSelect={selectDeck} label={t.deckLabel} reading={reading} expanded={expanded} pan={pan} position={position} progress={progress} onRead={startReading}>
              {reading && <WheelDeck key={deck.id} deck={deck} language={language} enteredAt={enteredAt} onExit={backToGallery} onHorizontal={changeDeck} pan={pan} position={position} progress={progress} />}

            </CurvedGallery>
          </motion.div>
          <div className="gallery-current" aria-live="polite" aria-atomic="true"><span>{deck.category[language]} <span aria-hidden="true">·</span> {deck.pages.length} {t.pages}</span><h2>{deck.title[language]}</h2></div>
        </div>
        <p className="gallery-read-link">{t.read}</p>
      </section>
    </main>
    <footer className="gallery-footer"><a href={language === 'zh' ? '/' : '/en/'}>Banana Slides</a><p>{t.original}</p><a href="https://github.com/Anionex/banana-slides/issues/2" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={14} /></a></footer>
  </div>;
}
