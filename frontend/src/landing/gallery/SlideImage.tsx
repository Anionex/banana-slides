import { useEffect, useRef, useState } from 'react';
import { ImageOff, RotateCw } from 'lucide-react';
import type { GalleryLanguage } from './catalog';

/** Mount with key={src} so a new page has its own load/error state. */
export function SlideImage({ src, srcSet, sizes, alt, language, eager = false, onReady }: {
  src: string; srcSet?: string; sizes?: string; alt: string; language: GalleryLanguage; eager?: boolean; onReady?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    let cancelled = false;
    const ready = async () => {
      await image.decode?.().catch(() => {});
      if (!cancelled && image.naturalWidth) setLoaded(true);
    };
    // The prerendered image may finish before React attaches its load handler.
    if (image.complete) {
      if (image.naturalWidth) void ready();
      else setFailed(true);
    }
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => { if (loaded || failed) onReady?.(); }, [loaded, failed, onReady]);
  return <div className="collection-image" data-loaded={loaded} data-failed={failed} aria-busy={!loaded && !failed}>
    {!loaded && !failed && <span className="sr-only" role="status">{language === 'zh' ? '正在加载幻灯片…' : 'Loading slide…'}</span>}
    {!failed ? <img ref={imageRef} key={attempt} src={src} srcSet={srcSet} sizes={sizes} alt={alt} width={1600} height={900} draggable={false}
      loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={async event => {
        const image = event.currentTarget;
        await image.decode().catch(() => {});
        if (!image.isConnected) return;
        setLoaded(true);
      }} onError={() => setFailed(true)} />
      : <div className="collection-image-error" role="status"><ImageOff size={24} aria-hidden="true" />
        <span>{language === 'zh' ? '这页图片暂时未能加载' : 'This slide couldn’t load'}</span>
        <button type="button" onClick={() => { setAttempt(value => value + 1); setFailed(false); }}>
          <RotateCw size={15} aria-hidden="true" />{language === 'zh' ? '重新加载' : 'Try again'}
        </button>
      </div>}
  </div>;
}
