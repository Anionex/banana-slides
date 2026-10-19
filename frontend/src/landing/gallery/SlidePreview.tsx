import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { pageSource, type CatalogDeck, type GalleryLanguage } from './catalog';
import { SlideImage } from './SlideImage';

/** Keep an opaque backing slide until the decoded incoming layer finishes fading. */
export function SlidePreview({ deck, page, language, eager, onReady }: {
  deck: CatalogDeck; page: number; language: GalleryLanguage; eager: boolean; onReady?: () => void;
}) {
  const reduced = useReducedMotion();
  const nextLayer = useRef(0);
  const [state, setState] = useState(() => ({ requested: page, layers: [{ id: 0, page, ready: true }] }));
  if (state.requested !== page) {
    // Discard only unseen requests. Preserve partially revealed layers so a
    // rapid second click cannot expose an earlier slide or the stage background.
    const layers = state.layers.filter(layer => layer.ready);
    if (layers[layers.length - 1].page !== page) layers.push({ id: ++nextLayer.current, page, ready: false });
    setState({ requested: page, layers });
  }
  return <>
    {state.layers.map((layer, index) => <motion.div key={layer.id} className="collection-slide"
      aria-hidden={index !== state.layers.length - 1 || undefined}
      initial={layer.id === 0 ? false : { opacity: 0 }} animate={{ opacity: layer.ready ? 1 : 0 }}
      onAnimationComplete={() => {
        if (!layer.ready) return;
        setState(current => current.layers.length > 1 && current.layers[current.layers.length - 1].id === layer.id
          ? { ...current, layers: [current.layers[current.layers.length - 1]] } : current);
      }}
      transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
      <SlideImage src={pageSource(deck, layer.page)} language={language} eager={eager || layer.id !== 0}
        alt={`${deck.title[language]} · ${layer.page + 1} / ${deck.pages.length}`}
        onReady={() => {
          if (state.requested !== layer.page || state.layers[state.layers.length - 1].id !== layer.id) return;
          setState(current => current.layers.some(item => item.id === layer.id && !item.ready)
            ? { ...current, layers: current.layers.map(item => item.id === layer.id ? { ...item, ready: true } : item) } : current);
          onReady?.();
        }} />
    </motion.div>)}
  </>;
}
