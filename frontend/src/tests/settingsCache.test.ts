import { beforeEach, describe, expect, it } from 'vitest';
import type { Settings } from '@/types';
import {
  beginSettingsCacheRequest,
  readSettingsCache,
  writeSettingsCache,
} from '@/utils/settingsCache';

const makeSettings = (mode: 'streaming' | 'parallel'): Settings => ({
  description_generation_mode: mode,
} as Settings);

describe('settings cache request ordering', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('does not let an older request overwrite a newer settings response', () => {
    const olderRequest = beginSettingsCacheRequest();
    const newerRequest = beginSettingsCacheRequest();

    expect(writeSettingsCache(makeSettings('parallel'), newerRequest)).toBe(true);
    expect(writeSettingsCache(makeSettings('streaming'), olderRequest)).toBe(false);
    expect(readSettingsCache()?.description_generation_mode).toBe('parallel');
  });

  it('lets a later request replace the current cached settings', () => {
    const firstRequest = beginSettingsCacheRequest();
    expect(writeSettingsCache(makeSettings('streaming'), firstRequest)).toBe(true);

    const laterRequest = beginSettingsCacheRequest();
    expect(writeSettingsCache(makeSettings('parallel'), laterRequest)).toBe(true);
    expect(readSettingsCache()?.description_generation_mode).toBe('parallel');
  });
});
