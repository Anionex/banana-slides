import { describe, expect, it } from 'vitest';
import { formatAppVersion } from '@/utils/appVersion';

describe('formatAppVersion', () => {
  it('prefers an exact tag over commit sha', () => {
    expect(formatAppVersion({
      tag: 'v0.4.0',
      shortSha: 'd350e41',
      fullSha: 'd350e41d9fb25f5c7a8f6a56c17b134e6f02cb3aa',
    })).toEqual({
      display: 'v0.4.0',
      detail: 'v0.4.0 (d350e41d9fb25f5c7a8f6a56c17b134e6f02cb3aa)',
    });
  });

  it('falls back to the short sha when no exact tag exists', () => {
    expect(formatAppVersion({
      tag: '',
      shortSha: 'd350e41',
      fullSha: 'd350e41d9fb25f5c7a8f6a56c17b134e6f02cb3aa',
    })).toEqual({
      display: 'd350e41',
      detail: 'd350e41 (d350e41d9fb25f5c7a8f6a56c17b134e6f02cb3aa)',
    });
  });

  it('derives the short sha from the full sha when needed', () => {
    expect(formatAppVersion({
      fullSha: '1234567890abcdef',
    }).display).toBe('1234567');
  });
});
