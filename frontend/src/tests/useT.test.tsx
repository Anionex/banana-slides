import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { useT } from '../hooks/useT';
import { getT } from '../utils/i18nHelper';
import { intlLocaleForUiLanguage, nextUiLanguage, resolveUiLanguage } from '../utils/uiLanguage';

describe('useT Vietnamese fallback', () => {
  afterEach(async () => {
    cleanup();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('uses a Vietnamese component dictionary when one exists', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    const { result } = renderHook(() => useT({
      zh: { title: '标题' },
      en: { title: 'Title' },
      vi: { title: 'Tiêu đề' },
    }));

    expect(result.current('title')).toBe('Tiêu đề');
  });

  it('falls back to English for components not translated to Vietnamese yet', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    const { result } = renderHook(() => useT({
      zh: { title: '标题' },
      en: { title: 'Title' },
    }));

    expect(result.current('title')).toBe('Title');
  });

  it('uses the same Vietnamese fallback outside React', async () => {
    await i18n.changeLanguage('vi');
    const t = getT({
      zh: { status: '状态' },
      en: { status: 'Status' },
    });

    expect(t('status')).toBe('Status');
  });

  it('normalizes Vietnamese locale identities and cycles all three UI languages', () => {
    expect(resolveUiLanguage('vi-VN')).toBe('vi');
    expect(intlLocaleForUiLanguage('vi-VN')).toBe('vi-VN');
    expect(nextUiLanguage('zh-CN')).toBe('en');
    expect(nextUiLanguage('en-US')).toBe('vi');
    expect(nextUiLanguage('vi-VN')).toBe('zh');
  });
});
