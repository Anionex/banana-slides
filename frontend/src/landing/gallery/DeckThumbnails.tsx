import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type CatalogDeck, type GalleryLanguage } from './catalog';

export function DeckThumbnails({ deck, page, language, onPage, className = '', navigation = false }: {
  deck: CatalogDeck; page: number; language: GalleryLanguage; onPage: (page: number) => void; className?: string; navigation?: boolean;
}) {
  const thumbnails = useRef<HTMLDivElement>(null);
  const stripId = useId();
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const strip = thumbnails.current;
    if (!navigation || !strip) return;
    const update = () => setEdges({ left: strip.scrollLeft > 1, right: strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 1 });
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    strip.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); strip.removeEventListener('scroll', update); };
  }, [navigation, deck.id]);
  useEffect(() => {
    const strip = thumbnails.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (strip && current) strip.scrollTo({ left: current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2, behavior: 'instant' });
  }, [page, deck.id]);
  const strip = <div id={stripId} ref={thumbnails} className={`collection-thumbnails ${className}`} aria-label={language === 'zh' ? '选择幻灯片' : 'Choose a slide'}>
    {deck.pages.map((_, index) => <button key={index} type="button" aria-current={page === index ? 'page' : undefined}
      aria-label={language === 'zh' ? `查看第 ${index + 1} 页` : `View slide ${index + 1}`} onClick={() => onPage(index)}>
      <img src={`/gallery/thumbnails/${deck.id}/${index + 1}.webp`} alt="" width={160} height={90} loading="lazy" decoding="async" /><span>{index + 1}</span>
    </button>)}
  </div>;
  if (!navigation) return strip;
  const scroll = (direction: number) => {
    const element = thumbnails.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .75, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const overflow = edges.left || edges.right;
  return <div className="deck-thumbnail-navigation" data-overflow={overflow} data-left={edges.left} data-right={edges.right}>
    <button className="deck-thumbnail-arrow" type="button" hidden={!overflow} disabled={!edges.left} aria-controls={stripId}
      aria-label={language === 'zh' ? '向左浏览缩略图' : 'Scroll thumbnails left'} onClick={() => scroll(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
    {strip}
    <button className="deck-thumbnail-arrow" type="button" hidden={!overflow} disabled={!edges.right} aria-controls={stripId}
      aria-label={language === 'zh' ? '向右浏览缩略图' : 'Scroll thumbnails right'} onClick={() => scroll(1)}><ChevronRight size={16} aria-hidden="true" /></button>
  </div>;
}
