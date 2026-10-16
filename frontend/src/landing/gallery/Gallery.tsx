import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Download, ExternalLink } from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { LandingTheme, ThemeToggle } from '../LandingTheme';
import { LanguageMenu } from '../LanguageMenu';
import { CurvedGallery } from './CurvedGallery';
import manifest from './manifest.json';
import type { GalleryDeck } from './types';
import '../landing.css';
import '../landing-typography.css';
import '../landing-theme.css';
import './gallery.css';

const decks: GalleryDeck[] = manifest;
const strings = {
  zh: { title: '每一个想法，都有好看的样子。', intro: '用 Banana Slides 创作的真实作品。横向挑选，向下读完。', home: '回到首页', demo: '体验 Demo', previous: '上一个作品', next: '下一个作品', choose: '选择作品', read: '向下浏览整套', pages: '页', source: '查看原帖', pdf: '打开 PDF', top: '返回作品选择', end: '看完了，下一个灵感是什么？', all: '全部作品', failed: '这一页暂时无法显示，可打开原始 PDF 查看。', retry: '重新加载', skip: '跳到作品内容', original: '原始作品来自 GitHub 社区案例，内容保持原样。', deckLabel: '作品画廊，左右方向键切换作品' },
  en: { title: 'Every idea has a look of its own.', intro: 'Real presentations made with Banana Slides. Browse sideways. Read downwards.', home: 'Back to home', demo: 'Try the demo', previous: 'Previous presentation', next: 'Next presentation', choose: 'Choose a presentation', read: 'Explore the full deck', pages: 'slides', source: 'Original post', pdf: 'Open PDF', top: 'Back to gallery', end: 'One more idea to explore?', all: 'All presentations', failed: 'This slide could not load. You can view it in the original PDF.', retry: 'Retry', skip: 'Skip to presentation', original: 'Original presentations from the GitHub community showcase, presented as shared.', deckLabel: 'Presentation gallery. Use left and right arrow keys to browse.' },
};

function SlideImage({ src, width, height, alt, failed, retry }: { src: string; width: number; height: number; alt: string; failed: string; retry: string }) {
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className="gallery-slide-image" style={{ aspectRatio: `${width} / ${height}` }}>
    {error ? <div className="gallery-image-error" role="status"><p>{failed}</p><button onClick={() => { setError(false); setAttempt(attempt + 1); }}>{retry}</button></div>
      : <img src={src + (attempt ? `?retry=${attempt}` : '')} alt={alt} width={width} height={height} loading="lazy" decoding="async" onError={() => setError(true)} />}
  </div>;
}

export function Gallery() { return <LandingTheme><GalleryContent /></LandingTheme>; }

function GalleryContent() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = strings[language];
  const [active, setActive] = useState(() => {
    if (typeof location === 'undefined') return 0;
    return Math.max(0, decks.findIndex(deck => deck.id === new URLSearchParams(location.search).get('deck')));
  });
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
    document.querySelector<HTMLElement>('.gallery-track')?.focus({ preventScroll: true });
    document.getElementById('gallery-selection')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return <div className="landing-page gallery-page">
    <a className="landing-skip" href="#gallery-reading">{t.skip}</a>
    <header className="gallery-header">
      <a className="brand" href={language === 'zh' ? '/' : '/en/'} aria-label={t.home}><img src={logoUrl} alt="" width="32" height="32" /><span>Banana Slides</span></a>
      <nav aria-label={language === 'zh' ? '主导航' : 'Main navigation'}><a className="gallery-home-link" href={language === 'zh' ? '/' : '/en/'}>{t.home}</a><LanguageMenu /><ThemeToggle /><a className="studio-button studio-button-dark" href="/app">{t.demo}<ArrowUpRight size={16} /></a></nav>
    </header>
    <main>
      <section id="gallery-selection" className="gallery-selection" aria-labelledby="gallery-title">
        <div className="gallery-intro"><h1 id="gallery-title">{t.title}</h1><p>{t.intro}</p></div>
        <CurvedGallery decks={decks} active={active} onSelect={setActive} label={t.deckLabel} />
        <div className="gallery-selection-caption">
          <button className="gallery-arrow" onClick={() => setActive((active - 1 + decks.length) % decks.length)} aria-label={t.previous}><ArrowLeft size={21} /></button>
          <div className="gallery-current" aria-live="polite" aria-atomic="true"><span>{deck.category[language]} <span aria-hidden="true">·</span> {deck.pages.length} {t.pages}</span><h2>{deck.title[language]}</h2></div>
          <button className="gallery-arrow" onClick={() => setActive((active + 1) % decks.length)} aria-label={t.next}><ArrowRight size={21} /></button>
        </div>
        <div className="gallery-browse"><label htmlFor="gallery-picker">{t.all} <span>{String(active + 1).padStart(2, '0')} / {decks.length}</span></label><select id="gallery-picker" value={active} onChange={event => setActive(Number(event.target.value))} aria-label={t.choose}>{decks.map((item, index) => <option key={item.id} value={index}>{item.title[language]}</option>)}</select></div>
        <a className="gallery-read-link" href="#gallery-reading">{t.read}<ArrowDown size={17} /></a>
      </section>
      <section id="gallery-reading" className="gallery-reading" aria-labelledby="gallery-deck-title" key={deck.id}>
        <div className="gallery-reading-toolbar"><div><h2 id="gallery-deck-title">{deck.title[language]}</h2><p>{deck.pages.length} {t.pages} <span aria-hidden="true">·</span> {deck.author}</p></div><div className="gallery-reading-actions"><a href={deck.source} target="_blank" rel="noopener noreferrer">{t.source}<ExternalLink size={15} /></a><a href={deck.pdf} target="_blank" rel="noopener noreferrer">{t.pdf}<Download size={16} /></a><button className="gallery-arrow" onClick={backToGallery} aria-label={t.top}><ArrowUp size={18} /></button></div></div>
        <div className="gallery-slides">{deck.pages.map((page, index) => <figure key={index}>
          <SlideImage src={`/gallery/${deck.id}/${index + 1}.webp`} {...page} alt={`${deck.title[language]} · ${language === 'zh' ? `第 ${index + 1} 页` : `Slide ${index + 1}`}`} failed={t.failed} retry={t.retry} />
          <figcaption>{String(index + 1).padStart(2, '0')} <span>/ {String(deck.pages.length).padStart(2, '0')}</span></figcaption>
        </figure>)}</div>
        <div className="gallery-end"><p>{t.end}</p><button className="studio-button studio-button-dark" onClick={backToGallery}>{t.top}<ArrowUp size={18} /></button></div>
      </section>
    </main>
    <footer className="gallery-footer"><a href={language === 'zh' ? '/' : '/en/'}>Banana Slides</a><p>{t.original}</p><a href="https://github.com/Anionex/banana-slides/issues/2" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={14} /></a></footer>
  </div>;
}
