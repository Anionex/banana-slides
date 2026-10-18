import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LandingTheme } from '../LandingTheme';
import { LandingHeader } from '../LandingHeader';
import { Footer } from '../Footer';
import { decks, type CatalogDeck } from './catalog';
import { DeckCard } from './DeckCard';
import { DeckViewer } from './DeckViewer';
import { DeckThumbnails } from './DeckThumbnails';
import { SlidePreview } from './SlidePreview';
import { useSlideSwipe } from './useSlideSwipe';
import { galleryStyleHref } from '../../utils/galleryStyle';
import { aspectLabel, creationDetails, deckIdFromPath, deckPath, detailHref, detailPage, detailReturnPath, galleryReturnPath, relatedDecks } from './deckDetails';
import '../landing.css';
import '../landing-typography.css';
import '../landing-theme.css';
import './collection.css';
import './deck-detail.css';

export function DeckDetail({ deckId }: { deckId?: string }) {
  const id = deckId ?? (typeof location !== 'undefined' ? deckIdFromPath(location.pathname) : null);
  return <LandingTheme><DeckDetailContent key={id} deck={decks.find(item => item.id === id) ?? null} /></LandingTheme>;
}

function DeckDetailContent({ deck }: { deck: CatalogDeck | null }) {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const zh = language === 'zh';
  const [initialSearch] = useState(() => typeof location === 'undefined' ? '' : location.search);
  const [page, setPage] = useState(() => deck ? detailPage(deck, initialSearch) : 0);
  const [viewer, setViewer] = useState(false);
  const [viewerFromToolbar, setViewerFromToolbar] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [relatedPages, setRelatedPages] = useState<Record<string, number>>({});
  const [overviews, setOverviews] = useState<Record<string, boolean>>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const enlargeTrigger = useRef<HTMLButtonElement>(null);
  const promptText = useRef<HTMLDivElement>(null);
  const metadata = deck ? creationDetails[deck.id] : null;
  const prompt = metadata?.stylePrompt[language] ?? '';
  const back = galleryReturnPath(language, initialSearch);
  const fromHome = new URLSearchParams(initialSearch).get('from') === 'home';
  const step = (direction: number) => { if (deck) setPage(value => Math.max(0, Math.min(deck.pages.length - 1, value + direction))); };
  const { shouldOpen, ...swipe } = useSlideSwipe(step);

  useEffect(() => {
    document.title = `${deck ? deck.title[language] : (zh ? '作品未找到' : 'Presentation not found')} | Banana Slides`;
    document.documentElement.lang = zh ? 'zh-CN' : 'en';
    if (!deck) return;
    const path = detailHref(deck, language, page, initialSearch);
    history.replaceState(history.state, '', path);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://bananaslides.online${deckPath(deck.id, language)}`);
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${deck.title[language]} · ${deck.appearance[language]}`);
  }, [deck, language, zh, page, initialSearch]);
  useEffect(() => {
    const restore = () => { if (deck) setPage(detailPage(deck, location.search)); setViewer(false); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [deck]);
  useEffect(() => {
    setCopyStatus('idle');
  }, [language]);
  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 2200);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);
  const copy = async () => {
    // Embedded browsers can leave Clipboard API writes pending. A synchronous
    // textarea copy follows the existing PublicSettings fallback.
    const previousFocus = document.activeElement as HTMLElement | null;
    const textarea = document.createElement('textarea');
    textarea.value = prompt;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    let copied = false;
    try { textarea.select(); copied = document.execCommand('copy'); }
    catch { /* Fall back to the Clipboard API. */ }
    finally { textarea.remove(); previousFocus?.focus({ preventScroll: true }); }
    if (copied) { setCopyStatus('copied'); return; }
    try { await navigator.clipboard.writeText(prompt); setCopyStatus('copied'); }
    catch {
      setCopyStatus('error');
      if (promptText.current) { const range = document.createRange(); range.selectNodeContents(promptText.current); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); }
    }
  };
  return <div className="landing-page collection-page deck-detail-page">
    <a className="landing-skip" href="#deck-content">{zh ? '跳到作品详情' : 'Skip to presentation'}</a>
    <LandingHeader language={language} currentPage="gallery" />
    <main id="deck-content" className="landing-container collection-shell">
      <a className="deck-detail-back" href={detailReturnPath(language, initialSearch)}><ArrowLeft size={16} aria-hidden="true" />{fromHome ? (zh ? '返回主页' : 'Back to home') : (zh ? '返回作品画廊' : 'Back to gallery')}</a>
      {deck && metadata ? <>
        <div className="deck-detail-layout">
          <div className="deck-detail-heading"><h1 id="deck-detail-title">{deck.title[language]}</h1><p>{deck.appearance[language]}</p></div>
          <section className="deck-detail-preview" aria-label={zh ? '作品预览' : 'Presentation preview'}>
            <div className="collection-stage">
              <SlidePreview deck={deck} page={page} language={language} eager />
              <button ref={trigger} type="button" className="collection-open deck-detail-open" {...swipe}
                aria-label={zh ? `放大查看：${deck.title.zh}，第 ${page + 1} 页` : `Enlarge ${deck.title.en}, slide ${page + 1}`}
                onClick={event => { if (event.detail === 0 || shouldOpen()) { setViewerFromToolbar(false); setViewer(true); } }}
                onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } }}>
              </button>
            </div>
            <div className="deck-detail-controls">
              <span aria-live="polite">{zh ? `第 ${page + 1} 页，共 ${deck.pages.length} 页` : `Slide ${page + 1} of ${deck.pages.length}`}</span>
              <button ref={enlargeTrigger} type="button" className="deck-detail-enlarge" aria-label={zh ? '放大当前幻灯片' : 'Enlarge current slide'} onClick={() => { setViewerFromToolbar(true); setViewer(true); }}><Maximize2 size={16} aria-hidden="true" /></button>
            </div>
            <DeckThumbnails deck={deck} page={page} language={language} onPage={setPage} className="deck-detail-thumbnails" navigation />
          </section>
          <section className="deck-detail-info" aria-labelledby="deck-detail-title">
            <dl className="deck-detail-metadata">
              <div><dt>{zh ? '画面比例' : 'Aspect ratio'}</dt><dd>{aspectLabel(deck)}</dd></div>
              <div><dt>{zh ? '作品页数' : 'Slides'}</dt><dd>{deck.pages.length}{zh ? ' 页' : ''}</dd></div>
              <div><dt>{zh ? '用途' : 'Use case'}</dt><dd>{deck.category[language]}</dd></div>
              <div><dt>{zh ? '分享者' : 'Shared by'}</dt><dd>{deck.author}</dd></div>
              <div><dt>{zh ? '生成模型' : 'Generation model'}</dt><dd>{metadata.model}</dd></div>
              <div><dt>{zh ? '生成方式' : 'Generation method'}</dt><dd>{metadata.generationMethod === 'style-prompt' ? (zh ? '风格提示词' : 'Style prompt') : (zh ? '参考图' : 'Reference image')}</dd></div>
            </dl>
            <div className="deck-detail-prompt">
              <div className="deck-detail-prompt-heading"><h2 id="deck-style-prompt-title">{zh ? '风格提示词' : 'Style prompt'}</h2>
                <button type="button" onClick={() => void copy()} aria-label={zh ? '复制风格描述' : 'Copy style description'} data-copied={copyStatus === 'copied'}>
                  {copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}<span>{copyStatus === 'copied' ? (zh ? '已复制' : 'Copied') : (zh ? '复制' : 'Copy')}</span>
                </button>
              </div>
              <div key={language} ref={promptText} className="deck-detail-prompt-text" role="region" aria-labelledby="deck-style-prompt-title" tabIndex={0}><ReactMarkdown>{prompt}</ReactMarkdown></div>
              <div className="deck-detail-prompt-footer">
              <p className="deck-detail-prompt-note">{metadata.promptSource.kind === 'app-preset'
                ? (zh ? `应用文字模板 · ${metadata.promptSource.name.zh}` : `App style preset · ${metadata.promptSource.name.en}`)
                : (zh ? '由模型根据参考图反推，仅供风格参考，非作者原始提示词。' : 'Inferred by AI from the reference image; not the creator’s original prompt.')}</p>
              <a className="deck-detail-use" href={galleryStyleHref(deck.id, language)}>{zh ? '前往使用' : 'Use this style'}<ArrowUpRight size={14} aria-hidden="true" /></a>
              </div>
              <span className={copyStatus === 'error' ? 'deck-detail-copy-error' : 'sr-only'} role="status">{copyStatus === 'copied' ? (zh ? '风格描述已复制' : 'Style description copied') : copyStatus === 'error' ? (zh ? '自动复制未成功，已选中文本，可手动复制。' : 'Copy failed. The text is selected for manual copying.') : ''}</span>
            </div>
          </section>
        </div>
        <section className="deck-detail-related" aria-labelledby="deck-related-title">
          <div className="deck-detail-related-heading"><h2 id="deck-related-title">{zh ? '继续探索' : 'Keep exploring'}</h2><a href={back}>{zh ? '全部作品' : 'All presentations'}<ArrowRight size={16} aria-hidden="true" /></a></div>
          <div className="collection-grid">
            {relatedDecks(deck).map(item => <DeckCard key={item.id} deck={item} page={relatedPages[item.id] ?? 0} language={language} eager={false}
              showOverview={overviews[item.id] ?? true} onOverview={value => setOverviews(current => ({ ...current, [item.id]: value }))}
              onPage={value => setRelatedPages(current => ({ ...current, [item.id]: value }))} onOpen={() => {}}
              detailHref={detailHref(item, language, relatedPages[item.id] ?? 0, initialSearch)} />)}
          </div>
        </section>
      </> : <div className="collection-empty"><h1>{zh ? '没有找到这套作品' : 'Presentation not found'}</h1><p>{zh ? '这条链接可能有误，请返回画廊继续浏览。' : 'This link may be incorrect. Return to the gallery to explore more.'}</p></div>}
    </main>
    <Footer />
    <DeckViewer deck={viewer ? deck : null} page={page} language={language} trigger={viewerFromToolbar ? enlargeTrigger : trigger} onPage={setPage} onClose={() => setViewer(false)} />
  </div>;
}
