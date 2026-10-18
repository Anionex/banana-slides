import manifest from './manifest.json';
import { decks, readGalleryLocation, type CatalogDeck, type GalleryLanguage } from './catalog';

type Bilingual = { zh: string; en: string };
export type DeckCreation = {
  model: string;
  generationMethod: 'style-prompt' | 'reference-image';
  stylePrompt: Bilingual;
  promptSource: { kind: 'app-preset'; presetId: string; name: Bilingual }
    | { kind: 'image-extraction'; image: string; analysisModel: string };
};
// Keep creation records in the raw source data so asset regeneration preserves them.
export const creationDetails: Record<string, DeckCreation> = Object.fromEntries(
  manifest.map(deck => [deck.id, deck.creation]),
);

export function deckPath(id: string, language: GalleryLanguage) { return `${language === 'en' ? '/en' : ''}/gallery/${encodeURIComponent(id)}/`; }
export function deckIdFromPath(path: string) { return /^\/(?:en\/)?gallery\/([a-z0-9-]+)\/?$/.exec(path)?.[1] ?? null; }
export function galleryReturnPath(language: GalleryLanguage, search: string) {
  const state = readGalleryLocation(search);
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.style) params.set('style', state.style);
  if (state.category) params.set('category', state.category);
  return `${language === 'en' ? '/en' : ''}/gallery/${params.size ? `?${params}` : ''}`;
}
export function detailHref(deck: CatalogDeck, language: GalleryLanguage, page = 0, search = '') {
  const params = new URLSearchParams(galleryReturnPath(language, search).split('?')[1]);
  if (new URLSearchParams(search).get('from') === 'home') params.set('from', 'home');
  if (page > 0) params.set('slide', String(page + 1));
  return deckPath(deck.id, language) + (params.size ? `?${params}` : '');
}
export function detailReturnPath(language: GalleryLanguage, search: string) {
  return new URLSearchParams(search).get('from') === 'home'
    ? `${language === 'en' ? '/en/' : '/'}#works-curved`
    : galleryReturnPath(language, search);
}
export function detailPage(deck: CatalogDeck, search: string) {
  const requested = Number(new URLSearchParams(search).get('slide') || 1);
  return Number.isInteger(requested) ? Math.max(0, Math.min(deck.pages.length - 1, requested - 1)) : 0;
}
export function aspectLabel(deck: CatalogDeck) {
  const { width, height } = deck.pages[0];
  if (Math.abs(width / height - 16 / 9) < .03) return width * 9 === height * 16 ? '16:9' : '≈ 16:9';
  if (Math.abs(width / height - 4 / 3) < .02) return '≈ 4:3';
  return `${width}:${height}`;
}
export function relatedDecks(deck: CatalogDeck) {
  const score = (item: CatalogDeck) => Number(item.appearance.style === deck.appearance.style) * 2 + Number(item.category.en === deck.category.en);
  return decks.filter(item => item.id !== deck.id).map((item, index) => ({ item, index }))
    .sort((a, b) => score(b.item) - score(a.item) || a.index - b.index).slice(0, 3).map(({ item }) => item);
}
