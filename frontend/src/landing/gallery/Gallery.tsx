import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, X } from 'lucide-react';
import { LandingTheme } from '../LandingTheme';
import { LandingHeader } from '../LandingHeader';
import { Footer } from '../Footer';
import { ChoiceMenu } from '../ChoiceMenu';
import { categories, decks, filterDecks, readGalleryLocation, styles } from './catalog';
import { DeckCard } from './DeckCard';
import { detailHref } from './deckDetails';
import { filterMotion } from './filterMotion';
import '../landing.css';
import '../landing-typography.css';
import '../landing-theme.css';
import './collection.css';

export function Gallery() { return <LandingTheme><GalleryContent /></LandingTheme>; }

function GalleryContent() {
  const motionId = useId();
  const reduced = useReducedMotion();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const zh = language === 'zh';
  const categoryOptions = [{ value: '', label: zh ? '所有用途' : 'All use cases' }, ...categories.map(item => ({ value: item.en, label: item[language] }))];
  const [initial] = useState(() => readGalleryLocation(typeof location === 'undefined' ? '' : location.search));
  const [query, setQuery] = useState(initial.query);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const [style, setStyle] = useState(initial.style);
  const [category, setCategory] = useState(initial.category);
  const [pages, setPages] = useState<Record<string, number>>(initial.deck ? { [initial.deck]: initial.page } : {});
  const [overviews, setOverviews] = useState<Record<string, boolean>>({});
  const search = useRef<HTMLInputElement>(null);
  const visible = filterDecks(query, style, category);
  const path = zh ? '/gallery/' : '/en/gallery/';
  const description = zh ? '使用 Banana Slides 制作的幻灯片，可按风格和用途筛选。' : 'Presentations made with Banana Slides. Filter by style and use case.';
  const setPage = (id: string, value: number) => setPages(current => ({ ...current, [id]: value }));
  const setOverview = (id: string, value: boolean) => setOverviews(current => ({ ...current, [id]: value }));
  const reset = () => { setQuery(''); setStyle(''); setCategory(''); };

  useEffect(() => {
    const restore = () => {
      if (!/^\/(?:en\/)?gallery\/?$/.test(location.pathname)) return;
      const state = readGalleryLocation(location.search);
      setQuery(state.query); setStyle(state.style); setCategory(state.category);
      if (state.deck) setPages(current => ({ ...current, [state.deck!]: state.page }));
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    if (document.getElementById('root')?.dataset.homeParked === 'true') return;
    // Old shared viewer links now land on the dedicated presentation page.
    const legacyDeck = decks.find(deck => deck.id === initial.deck);
    if (legacyDeck) { location.replace(detailHref(legacyDeck, language, initial.page, location.search)); return; }
    document.title = `${zh ? '作品画廊' : 'Presentation gallery'} | Banana Slides`;
    document.documentElement.lang = zh ? 'zh-CN' : 'en';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://bananaslides.online${path}`);
    const params = new URLSearchParams();
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('cover-artwork')) params.set('cover-artwork', '');
    if (query) params.set('q', query);
    if (style) params.set('style', style);
    if (category) params.set('category', category);
    history.replaceState(history.state, '', `${path}${params.size ? `?${params}` : ''}`);
  }, [zh, language, path, description, query, style, category, initial]);

  return <div className="landing-page collection-page" onPointerDownCapture={() => setKeyboardNavigation(false)} onKeyDownCapture={event => { if (event.key === 'Tab') setKeyboardNavigation(true); }}>
    <a className="landing-skip" href="#collection-results">{zh ? '跳到作品' : 'Skip to presentations'}</a>
    <LandingHeader language={language} currentPage="gallery" />
    <div className="landing-container collection-shell">
      <main>
        <section className="collection-intro" aria-labelledby="collection-title">
          <div><h1 id="collection-title">{zh ? '作品画廊' : 'Presentation gallery'}</h1><p>{description}</p></div>
        </section>
        <section aria-label={zh ? '浏览幻灯片作品' : 'Browse presentations'}>
          <div className="collection-toolbar">
            <div className="collection-filters" role="group" aria-label={zh ? '按风格筛选' : 'Filter by style'}>
              {[{ id: '', zh: '全部风格', en: 'All styles' }, ...styles].map(item => <button type="button" key={item.id} aria-pressed={style === item.id} onClick={() => setStyle(item.id)}>
                {style === item.id && <motion.span className="collection-filter-active" aria-hidden="true" layoutId={reduced ? undefined : `${motionId}-filter`} crossfade={false} initial={false} transition={reduced ? filterMotion.instant : filterMotion.chip} />}
                <span className="collection-filter-label">{item[language]}</span><span className="collection-filter-count">{filterDecks(query, item.id, category).length}</span>
              </button>)}
            </div>
          <div className="collection-search" role="search" data-keyboard-navigation={keyboardNavigation}>
            <div className="collection-category">
              <ChoiceMenu label={zh ? '按用途筛选' : 'Filter by use case'} value={category} onValueChange={setCategory} options={categoryOptions}
                triggerClassName="collection-category-trigger"
                trigger={<><span>{categoryOptions.find(item => item.value === category)?.label}</span><ChevronDown size={15} aria-hidden="true" /></>} />
            </div>
            <Search className="collection-search-icon" size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="collection-query">{zh ? '搜索作品、主题或风格' : 'Search presentations, topics or styles'}</label>
            <input ref={search} id="collection-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={zh ? '搜索主题、作品或风格…' : 'Search topics, decks or styles…'} />
            {query && <button type="button" aria-label={zh ? '清空搜索' : 'Clear search'} onClick={() => { setQuery(''); search.current?.focus(); }}><X size={17} /></button>}
          </div>
          </div>
          <div className="collection-grid" id="collection-results" tabIndex={-1}>
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((deck, index) => <motion.div key={deck.id} className="collection-cell"
                layout={reduced ? false : 'position'}
                initial={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.98, transition: reduced ? filterMotion.instant : filterMotion.exit }}
                transition={reduced ? filterMotion.instant : filterMotion.card}>
                <DeckCard deck={deck} page={pages[deck.id] ?? 0} language={language} eager={index < 3}
                  showOverview={overviews[deck.id] ?? true} onOverview={value => setOverview(deck.id, value)}
                  onPage={value => setPage(deck.id, value)} onOpen={() => {}}
                  detailHref={detailHref(deck, language, pages[deck.id] ?? 0, new URLSearchParams({ q: query, style, category }).toString())} />
              </motion.div>)}
            </AnimatePresence>
          </div>
          {!visible.length && <div className="collection-empty"><Search size={28} aria-hidden="true" /><h2>{zh ? '没有匹配的作品' : 'No matching presentations'}</h2><p>{zh ? '更换关键词或清除筛选。' : 'Change your search or clear the filters.'}</p><button type="button" onClick={reset}>{zh ? '查看全部作品' : 'View all presentations'}</button></div>}
        </section>
      </main>
    </div>
    <Footer />
  </div>;
}
