import { describe, expect, it } from 'vitest';
import manifest from '../landing/gallery/manifest.json';
import { galleryStyleFromSearch, galleryStyleHref } from './galleryStyle';

describe('gallery style handoff', () => {
  it('round-trips every published prompt in either language without truncation', () => {
    for (const deck of manifest) {
      for (const language of ['zh', 'en'] as const) {
        const url = new URL(galleryStyleHref(deck.id, language), 'https://example.com');
        expect(url.pathname).toBe('/app');
        expect(galleryStyleFromSearch(url.searchParams)?.prompt).toBe(deck.creation.stylePrompt[language]);
        expect(url.href.length).toBeLessThan(150);
      }
    }
  });

  it('leaves ordinary entries and unknown works untouched', () => {
    for (const search of ['', 'galleryStyle=unknown', 'galleryStyle=__proto__', 'stylePrompt=arbitrary']) {
      expect(galleryStyleFromSearch(new URLSearchParams(search))).toBeNull();
    }
  });

  it('uses Chinese for an omitted or unsupported prompt language', () => {
    const deck = manifest[0];
    expect(galleryStyleFromSearch(new URLSearchParams({ galleryStyle: deck.id, styleLanguage: 'fr' }))?.prompt)
      .toBe(deck.creation.stylePrompt.zh);
  });
});
