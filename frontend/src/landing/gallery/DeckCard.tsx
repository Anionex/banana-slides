import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useIsPresent } from 'motion/react';
import { type CatalogDeck, type GalleryLanguage } from './catalog';
import { SlidePreview } from './SlidePreview';
import { useSlideSwipe } from './useSlideSwipe';
import { DeckOverview, hasDeckOverview } from './DeckOverview';

export function DeckCard({ deck, page, language, eager, showOverview, onOverview, onPage, onOpen, detailHref }: {
  deck: CatalogDeck; page: number; language: GalleryLanguage; eager: boolean;
  showOverview: boolean; onOverview: (show: boolean) => void;
  onPage: (page: number) => void; onOpen: (trigger: HTMLButtonElement) => void;
  detailHref?: string;
}) {
  const zh = language === 'zh';
  const present = useIsPresent();
  const hasOverview = hasDeckOverview(deck.id);
  const overview = hasOverview && showOverview && page === 0;
  const title = deck.title[language];
  const step = (direction: number) => {
    if (overview) { if (direction > 0) onOverview(false); return; }
    if (hasOverview && page === 0 && direction < 0) { onOverview(true); return; }
    onOverview(false);
    onPage(Math.max(0, Math.min(deck.pages.length - 1, page + direction)));
  };
  const { shouldOpen, ...swipe } = useSlideSwipe(step);
  return <article className="collection-card" data-deck={deck.id} aria-labelledby={`deck-${deck.id}`} aria-hidden={!present || undefined} {...(!present ? { inert: '' } : {})}>
    <div className="collection-stage">
      {!overview && <SlidePreview deck={deck} page={page} language={language} eager={eager} />}
      {overview && <DeckOverview deck={deck} language={language} eager={eager} />}
      {detailHref ? <a className="collection-open" href={detailHref} {...swipe}
        aria-label={zh ? `查看作品：${title}` : `View presentation: ${title}`}
        onClick={event => { if (event.detail !== 0 && !shouldOpen()) event.preventDefault(); }}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } }} /> : <button className="collection-open" type="button" {...swipe}
        aria-label={overview ? (zh ? `浏览整套作品：${title}` : `Browse presentation: ${title}`) : (zh ? `放大查看：${title}，第 ${page + 1} 页` : `Enlarge ${title}, slide ${page + 1}`)}
        onClick={event => { if (event.detail === 0 || shouldOpen()) { onOverview(false); onOpen(event.currentTarget); } }}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } }}>
      </button>}
    </div>
    <div className="collection-card-info">
      <div><h2 id={`deck-${deck.id}`}>{title}</h2><p>{deck.appearance[language]}</p></div>
      <div className="collection-pagination" aria-label={zh ? `${title} 翻页` : `${title} navigation`}>
        <button type="button" onClick={() => step(-1)} disabled={overview || (!hasOverview && page === 0)} aria-label={zh ? `${title} 上一页` : `${title}, previous slide`}><ArrowLeft size={16} /></button>
        <span aria-live="polite" aria-atomic="true">{overview ? (zh ? '总览' : 'Overview') : <>{page + 1}<span aria-hidden="true"> / </span><span className="sr-only">{zh ? '，共' : ' of '}</span>{deck.pages.length}</>}</span>
        <button type="button" onClick={() => step(1)} disabled={page === deck.pages.length - 1} aria-label={zh ? `${title} 下一页` : `${title}, next slide`}><ArrowRight size={16} /></button>
      </div>
    </div>
  </article>;
}
