const slides = new Map<string, Promise<HTMLImageElement>>();

/** Retain decoded first slides so the homepage handoff never swaps an unloaded image. */
export function preloadSlide(src: string) {
  let ready = slides.get(src);
  if (!ready) {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.src = src;
    ready = image.decode().then(() => image).catch(error => {
      slides.delete(src);
      throw error;
    });
    slides.set(src, ready);
  }
  return ready;
}
