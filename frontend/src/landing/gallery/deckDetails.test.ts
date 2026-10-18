import { describe, expect, it } from 'vitest';
import { decks } from './catalog';
import { aspectLabel, creationDetails, deckIdFromPath, detailHref, detailPage, detailReturnPath, galleryReturnPath, relatedDecks } from './deckDetails';
import { isGalleryDetailPath } from '../../utils/publicLanding';
import sources from './sources.json';
import manifest from './manifest.json';
import { presetStylesI18n } from '../../config/presetStylesI18n';

describe('presentation detail navigation', () => {
  const software = decks.find(deck => deck.id === 'software')!;
  it('retains the home origin through slide/language changes without changing gallery links', () => {
    expect(detailHref(software, 'en', 2, '?from=home')).toBe('/en/gallery/software/?from=home&slide=3');
    expect(detailReturnPath('zh', '?from=home&slide=3')).toBe('/#works-curved');
    expect(detailReturnPath('en', '?from=home')).toBe('/en/#works-curved');
    expect(detailReturnPath('zh', '?style=minimal')).toBe('/gallery/?style=minimal');
    expect(galleryReturnPath('en', '?from=home')).toBe('/en/gallery/');
  });
  it('keeps filters and slide selection across detail navigation without carrying a viewer selection', () => {
    const search = '?q=software&style=illustrated&category=Technology&deck=software&slide=3';
    expect(detailHref(software, 'en', 2, search)).toBe('/en/gallery/software/?q=software&style=illustrated&category=Technology&slide=3');
    expect(galleryReturnPath('zh', search)).toBe('/gallery/?q=software&style=illustrated&category=Technology');
    expect(detailPage(software, '?slide=999')).toBe(8);
    expect(detailPage(software, '?slide=-8')).toBe(0);
    expect(detailPage(software, '?slide=oops')).toBe(0);
  });
  it('recognizes detail routes without capturing slide assets or editor routes', () => {
    for (const path of ['/gallery/software', '/en/gallery/deepseek/']) {
      expect(isGalleryDetailPath(path)).toBe(true);
      expect(deckIdFromPath(path)).not.toBeNull();
    }
    for (const path of ['/gallery/software/1.webp', '/gallery/overviews/software-zh.webp', '/app', '/en/gallery/']) expect(isGalleryDetailPath(path)).toBe(false);
  });
  it('preserves creation provenance through the source-to-manifest pipeline', () => {
    for (const deck of decks) {
      const source = sources.find(item => item.id === deck.id)!.creation;
      expect(manifest.find(item => item.id === deck.id)!.creation).toEqual(source);
      expect(creationDetails[deck.id].model).toBe('Nanobanana Pro');
      expect(source.modelSource).toBe('creator-confirmed');
      expect(source.stylePrompt.zh).toBeTruthy();
      expect(source.stylePrompt.en).toBeTruthy();
      if (source.promptSource.kind === 'app-preset') {
        expect(source.generationMethod).toBe('style-prompt');
        const key = source.promptSource.key as keyof typeof presetStylesI18n.zh;
        for (const language of ['zh', 'en'] as const) {
          expect(source.stylePrompt[language]).toBe(presetStylesI18n[language][key].description);
        }
      } else {
        expect(source.generationMethod).toBe('reference-image');
        expect(source.promptSource.analysisModel).toBeTruthy();
        expect(source.promptSource.extractionPrompt).toBe('backend/services/prompts.py:get_style_extraction_prompt');
        expect(source.promptSource.image).toMatch(/^\/templates\//);
      }
      expect(aspectLabel(deck)).toMatch(/\d/);
    }
  });
  it('prioritizes similar styles, excludes the current work and returns stable results', () => {
    const related = relatedDecks(software);
    expect(related).toHaveLength(3);
    expect(new Set(related.map(deck => deck.id)).size).toBe(3);
    expect(related.some(deck => deck.id === software.id)).toBe(false);
    expect(related[0].appearance.style).toBe('illustrated');
    expect(relatedDecks(software)).toEqual(related);
  });
});
