import { describe, expect, it } from 'vitest';
import manifest from './manifest.json';
import { decks, filterDecks, readGalleryLocation } from './catalog';

describe('public presentation catalog', () => {
  it('includes every curated source once, without the removed ecology deck', () => {
    expect(decks.map(deck => deck.id).sort()).toEqual(manifest.map(deck => deck.id).sort());
    expect(decks.some(deck => deck.id === 'ecology')).toBe(false);
  });
  it('combines bilingual text, style and use-case filters', () => {
    expect(filterDecks('  ＤＥＥＰＳＥＥＫ  ', '', '').map(deck => deck.id)).toEqual(['deepseek', 'deepseek-tech']);
    expect(filterDecks('手绘', 'illustrated', 'Education').map(deck => deck.id)).toEqual(['money']);
    expect(filterDecks('blue isometric', 'business', '').map(deck => deck.id)).toEqual(['saas']);
    expect(filterDecks('不存在的作品', '', '')).toEqual([]);
  });
  it('restores shareable filtered deck/slide links and clamps malformed pages', () => {
    expect(readGalleryLocation('?deck=software&slide=3&style=illustrated&q=软件')).toEqual({ deck: 'software', page: 2, style: 'illustrated', query: '软件', category: '' });
    expect(readGalleryLocation('?deck=software&slide=999').page).toBe(8);
    for (const slide of ['-10', 'NaN', '1.5']) expect(readGalleryLocation(`?deck=software&slide=${slide}`).page).toBe(0);
    expect(readGalleryLocation('?deck=ecology&style=bad&category=bad')).toEqual({ deck: null, page: 0, query: '', style: '', category: '' });
  });
});
