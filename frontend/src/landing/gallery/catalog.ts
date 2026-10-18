import manifest from './manifest.json';
import type { GalleryDeck } from './types';

export type GalleryLanguage = 'zh' | 'en';
export const styles = [
  { id: 'illustrated', zh: '手绘插画', en: 'Illustrated' },
  { id: 'minimal', zh: '极简留白', en: 'Minimal' },
  { id: 'technology', zh: '科技未来', en: 'Technology' },
  { id: 'business', zh: '商务专业', en: 'Professional' },
  { id: 'expressive', zh: '鲜明个性', en: 'Expressive' },
] as const;
export type GalleryStyle = typeof styles[number]['id'];
const presentationStyles: Record<string, { style: GalleryStyle; zh: string; en: string }> = {
  software: { style: 'illustrated', zh: '彩色插画 · 知识图解', en: 'Colorful illustration · visual learning' },
  deepseek: { style: 'minimal', zh: '极简线稿 · 纸感留白', en: 'Fine linework · paper & whitespace' },
  'gen-z': { style: 'expressive', zh: '流动渐变 · 鲜明色彩', en: 'Fluid gradients · vivid color' },
  quantum: { style: 'technology', zh: '未来科技 · 发光线条', en: 'Future technology · luminous lines' },
  saas: { style: 'business', zh: '深蓝商务 · 等距图形', en: 'Navy blue · isometric graphics' },
  'food-production': { style: 'business', zh: '行业报告 · 流程图解', en: 'Industry report · process diagrams' },
  money: { style: 'illustrated', zh: '羊皮纸 · 复古手绘', en: 'Parchment · vintage illustration' },
  moutai: { style: 'expressive', zh: '黑金质感 · 装饰艺术', en: 'Black & gold · art deco' },
  xian: { style: 'illustrated', zh: '古城速写 · 旅行手账', en: 'Architectural sketches · travel journal' },
  'deepseek-tech': { style: 'technology', zh: '蓝色科技 · 数字空间', en: 'Electric blue · digital spaces' },
  cnn: { style: 'business', zh: '蓝白简报 · 清晰结构', en: 'Blue & white · structured briefing' },
};
export type CatalogDeck = GalleryDeck & { appearance: typeof presentationStyles[string] };
// Alternate visual styles in the first rows so the collection is legible at a glance.
export const decks: CatalogDeck[] = Object.keys(presentationStyles).flatMap(id => {
  const deck = manifest.find(item => item.id === id);
  return deck ? [{ ...deck, appearance: presentationStyles[id] }] : [];
});
export const categories = [...new Map(decks.map(deck => [deck.category.en, deck.category])).values()];
export const pageSource = (deck: GalleryDeck, page: number) => `/gallery/${deck.id}/${page + 1}.webp`;
const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();
export function filterDecks(query: string, style: string, category: string) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  return decks.filter(deck => {
    if (style && deck.appearance.style !== style) return false;
    if (category && deck.category.en !== category) return false;
    const text = normalized([deck.title.zh, deck.title.en, deck.originalTitle, deck.category.zh, deck.category.en,
      deck.appearance.zh, deck.appearance.en, ...Object.values(styles.find(item => item.id === deck.appearance.style)!)].join(' '));
    return terms.every(term => text.includes(term));
  });
}
export function readGalleryLocation(search: string) {
  const params = new URLSearchParams(search);
  const deck = decks.find(item => item.id === params.get('deck'));
  const slide = Number(params.get('slide') || 1);
  return {
    query: params.get('q') || '',
    style: styles.some(item => item.id === params.get('style')) ? params.get('style')! : '',
    category: categories.some(item => item.en === params.get('category')) ? params.get('category')! : '',
    deck: deck?.id ?? null,
    page: deck && Number.isInteger(slide) ? Math.max(0, Math.min(deck.pages.length - 1, slide - 1)) : 0,
  };
}
