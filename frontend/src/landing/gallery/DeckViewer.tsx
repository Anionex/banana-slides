import { useEffect, useRef, useState, type RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, X } from 'lucide-react';
import { pageSource, type CatalogDeck, type GalleryLanguage } from './catalog';
import { SlideImage } from './SlideImage';
import { useSlideSwipe } from './useSlideSwipe';
import { DeckThumbnails } from './DeckThumbnails';

export function DeckViewer({ deck, page, language, trigger, onPage, onClose }: {
  deck: CatalogDeck | null; page: number; language: GalleryLanguage; trigger: RefObject<HTMLButtonElement>;
  onPage: (page: number) => void; onClose: () => void;
}) {
  const zh = language === 'zh';
  const closeButton = useRef<HTMLButtonElement>(null);
  const fullscreenOwner = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const step = (direction: number) => { if (deck) onPage(Math.max(0, Math.min(deck.pages.length - 1, page + direction))); };
  const { shouldOpen: _shouldOpen, ...swipe } = useSlideSwipe(step);
  const close = () => {
    if (fullscreenOwner.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    fullscreenOwner.current = false;
    onClose();
  };
  useEffect(() => {
    const changed = () => { setFullscreen(Boolean(document.fullscreenElement)); if (!document.fullscreenElement) fullscreenOwner.current = false; };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); fullscreenOwner.current = true; }
    } catch { setFullscreenError(true); }
  };
  return <Dialog.Root open={Boolean(deck)} onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="collection-reader-backdrop" />
      <Dialog.Popup className="collection-reader" finalFocus={trigger} initialFocus={closeButton} aria-describedby="collection-reader-description"
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
          if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); onPage(event.key === 'Home' ? 0 : (deck?.pages.length ?? 1) - 1); }
        }}>
        {deck && <>
          <header className="collection-reader-header">
            <div><Dialog.Title>{deck.title[language]}</Dialog.Title><Dialog.Description id="collection-reader-description">{deck.appearance[language]}<span aria-hidden="true"> · </span>{deck.category[language]}</Dialog.Description></div>
            <div className="collection-reader-tools">
              {typeof document !== 'undefined' && document.fullscreenEnabled && !fullscreenError && <button type="button" onClick={() => void toggleFullscreen()} aria-label={zh ? (fullscreen ? '退出全屏' : '进入全屏') : (fullscreen ? 'Exit fullscreen' : 'Enter fullscreen')} title={zh ? '全屏' : 'Fullscreen'}>{fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}
              <Dialog.Close ref={closeButton} aria-label={zh ? '关闭放大查看' : 'Close viewer'}><X size={23} /></Dialog.Close>
            </div>
          </header>
          <div className="collection-reader-stage">
            <button className="collection-reader-prev" type="button" onClick={() => step(-1)} disabled={page === 0} aria-label={zh ? '上一页' : 'Previous slide'}><ArrowLeft size={22} /></button>
            <div className="collection-reader-art" {...swipe}>
              <SlideImage key={pageSource(deck, page)} src={pageSource(deck, page)} alt={`${deck.title[language]} · ${page + 1} / ${deck.pages.length}`} language={language} eager />
            </div>
            <button className="collection-reader-next" type="button" onClick={() => step(1)} disabled={page === deck.pages.length - 1} aria-label={zh ? '下一页' : 'Next slide'}><ArrowRight size={22} /></button>
          </div>
          <footer className="collection-reader-footer">
            <div className="collection-reader-status"><span aria-live="polite" aria-atomic="true">{String(page + 1).padStart(2, '0')} / {String(deck.pages.length).padStart(2, '0')}</span><span>{zh ? '左右方向键翻页 · Esc 关闭预览' : 'Arrow keys to browse · Esc to close'}</span></div>
            <DeckThumbnails deck={deck} page={page} language={language} onPage={onPage} />
          </footer>
        </>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
