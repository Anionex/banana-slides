import { beforeEach, describe, expect, test } from 'vitest';
import { loadStoredPresets } from '@/utils/presetStorage';

const KEY = 'presetCapsules_outline';

describe('loadStoredPresets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns saved presets without changing valid storage', () => {
    const raw = JSON.stringify([{ name: 'Academic', content: 'Use citations' }]);
    localStorage.setItem(KEY, raw);

    expect(loadStoredPresets(localStorage, KEY)).toEqual([
      { name: 'Academic', content: 'Use citations' },
    ]);
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  test.each([
    ['malformed JSON', '{bad-json'],
    ['non-array JSON', JSON.stringify({ name: 'Unexpected object' })],
  ])('repairs %s to an empty preset list', (_label, raw) => {
    localStorage.setItem(KEY, raw);

    expect(loadStoredPresets(localStorage, KEY)).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe('[]');
  });

  test('keeps valid entries and removes invalid fields and records', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { name: '  Keep me  ', content: '  Valid content  ', legacy: true },
      { name: '', content: 'Blank name' },
      { name: 'Wrong content type', content: 123 },
      null,
    ]));

    expect(loadStoredPresets(localStorage, KEY)).toEqual([
      { name: 'Keep me', content: 'Valid content' },
    ]);
    expect(localStorage.getItem(KEY)).toBe(
      JSON.stringify([{ name: 'Keep me', content: 'Valid content' }]),
    );
  });

  test('does not fail the editor when storage access is unavailable', () => {
    const unavailableStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };

    expect(loadStoredPresets(unavailableStorage, KEY)).toEqual([]);
  });

  test('keeps repaired presets available when the cache cannot be rewritten', () => {
    const readOnlyStorage = {
      getItem: () => JSON.stringify([{ name: '  Keep  ', content: '  Usable  ' }]),
      setItem: () => { throw new Error('quota exceeded'); },
    };

    expect(loadStoredPresets(readOnlyStorage, KEY)).toEqual([
      { name: 'Keep', content: 'Usable' },
    ]);
  });
});
