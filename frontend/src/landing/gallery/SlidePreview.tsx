import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { pageSource, type CatalogDeck, type GalleryLanguage } from './catalog';
import { SlideImage } from './SlideImage';

/** Keep the previous slide visible until the requested image has decoded. */
export function SlidePreview({ deck, page, language, eager }: {
  deck: CatalogDeck; page: number; language: GalleryLanguage; eager: boolean;
}) {
  const reduced = useReducedMotion();
  const [displayedPage, setDisplayedPage] = useState(page);
  const requestedPage = useRef(page);
  requestedPage.current = page;
  const visible = displayedPage === page ? [page] : [displayedPage, page];
  return <AnimatePresence initial={false}>
    {visible.map(candidate => <motion.div key={pageSource(deck, candidate)} className="collection-slide"
      initial={{ opacity: 0 }} animate={{ opacity: candidate === displayedPage ? 1 : 0 }}
      exit={{ opacity: candidate === displayedPage ? 1 : 0, transition: { delay: reduced ? 0 : 0.22, duration: 0 } }}
      transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
      <SlideImage src={pageSource(deck, candidate)} language={language} eager={eager || candidate !== displayedPage}
        alt={`${deck.title[language]} · ${candidate + 1} / ${deck.pages.length}`}
        onReady={() => { if (requestedPage.current === candidate) setDisplayedPage(candidate); }} />
    </motion.div>)}
  </AnimatePresence>;
}
