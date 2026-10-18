import { pageSource, type CatalogDeck, type GalleryLanguage } from './catalog';
import './deck-overview.css';

const compositions: Record<string, { pages: number[]; title: [string, string]; caption: [string, string] }> = {
  software: { pages: [1, 3, 5, 6, 7, 9], title: ['软件开发原则', 'Principles of software'], caption: ['SOLID · DRY · KISS', 'SOLID · DRY · KISS'] },
  deepseek: { pages: [1, 2, 3, 5], title: ['DeepSeek\nV3.2', 'DeepSeek\nV3.2'], caption: ['开源模型的技术前沿', 'The frontier of open models'] },
  'gen-z': { pages: [1, 2, 3, 4, 5], title: ['Z\n世代', 'GEN\nZ'], caption: ['年轻人群体特征解析', 'Portrait of a generation'] },
  quantum: { pages: [1, 2, 4, 6], title: ['量子\n计算', 'Quantum\ncomputing'], caption: ['开启算力新纪元', 'A new era of computing'] },
  saas: { pages: [1, 2, 4, 5], title: ['SaaS 服务定价', 'SaaS pricing'], caption: ['从价值到增长', 'From value to growth'] },
  'food-production': { pages: [1, 2, 3, 4], title: ['预制菜\n智能产线', 'Smart food\nproduction'], caption: ['工艺 · 装备 · 产业化', 'Process · equipment · scale'] },
};

/** Art-directed HTML compositions preserve the original slide artwork and text. */
export function DeckOverviewArtwork({ deck, language, eager }: { deck: CatalogDeck; language: GalleryLanguage; eager: boolean }) {
  const composition = compositions[deck.id];
  const locale = language === 'zh' ? 0 : 1;
  return <div className={`deck-overview deck-overview--${deck.id}`} role="img"
    aria-label={language === 'zh' ? `${deck.title.zh}，整套作品总览` : `${deck.title.en}, deck overview`}>
    <div className="deck-overview-heading" aria-hidden="true">
      <strong>{composition.title[locale]}</strong>
      <span>{composition.caption[locale]}</span>
    </div>
    <div className="deck-overview-pages" aria-hidden="true">
      {composition.pages.map(page => <img key={page} src={pageSource(deck, page - 1)} alt="" width={1600} height={900}
        loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />)}
    </div>
    <span className="deck-overview-note" aria-hidden="true">{deck.pages.length} {language === 'zh' ? '页作品' : 'slides'}</span>
  </div>;
}
