import { beforeEach, describe, expect, it } from 'vitest';
import type { Settings } from '@/types';
import {
  beginSettingsCacheRequest,
  mergeSettingsWithOpenAIOAuthStatus,
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

  it('preserves a newer OAuth status when applying a successful settings save', () => {
    const merged = mergeSettingsWithOpenAIOAuthStatus(
      {
        ...makeSettings('parallel'),
        openai_oauth_connected: false,
        openai_oauth_account_id: null,
      },
      { connected: true, accountId: 'oauth-account' }
    );

    expect(merged.description_generation_mode).toBe('parallel');
    expect(merged.openai_oauth_connected).toBe(true);
    expect(merged.openai_oauth_account_id).toBe('oauth-account');
  });
});
