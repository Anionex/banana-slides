import type { CatalogDeck, GalleryLanguage } from './catalog';
import { SlideImage } from './SlideImage';
import { DeckOverviewArtwork } from './DeckOverviewArtwork';

export const hasDeckOverview = (id: string) => ['software', 'deepseek', 'gen-z', 'quantum', 'saas', 'food-production'].includes(id);

export function DeckOverview({ deck, language, eager }: { deck: CatalogDeck; language: GalleryLanguage; eager: boolean }) {
  // The editable compositions are available only on the development server.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('cover-artwork')) {
    return <DeckOverviewArtwork deck={deck} language={language} eager={eager} />;
  }
  return <div className="collection-overview-image">
    <SlideImage key={`${deck.id}-${language}`} src={`/gallery/overviews/${deck.id}-${language}.webp`}
      srcSet={`/gallery/overviews/${deck.id}-${language}-800.webp 800w, /gallery/overviews/${deck.id}-${language}.webp 1600w`}
      sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 96px) / 2), (max-width: 1199px) calc((100vw - 144px) / 2), 360px"
      alt={language === 'zh' ? `${deck.title.zh}，整套作品总览` : `${deck.title.en}, deck overview`}
      language={language} eager={eager} />
  </div>;
}
