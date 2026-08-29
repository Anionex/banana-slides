import type { Settings } from '@/types';

const SETTINGS_CACHE_KEY = 'banana-settings';

let nextRequestId = 0;
let latestCommittedRequestId = 0;

export interface OpenAIOAuthCacheStatus {
  connected: boolean;
  accountId: string | null;
  revision: number;
}

export function beginSettingsCacheRequest(): number {
  nextRequestId += 1;
  return nextRequestId;
}

export function readSettingsCache(): Settings | null {
  try {
    const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) as Settings : null;
  } catch {
    return null;
  }
}

export function writeSettingsCache(settings: Settings, requestId?: number): boolean {
  const effectiveRequestId = requestId ?? beginSettingsCacheRequest();
  if (effectiveRequestId < latestCommittedRequestId) return false;

  latestCommittedRequestId = effectiveRequestId;
  try {
    sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to persist settings in sessionStorage:', error);
  }
  return true;
}

export function resolveLatestSettingsResponse(settings: Settings, requestId: number): Settings {
  return writeSettingsCache(settings, requestId)
    ? settings
    : readSettingsCache() || settings;
}

export function mergeSettingsWithOpenAIOAuthStatus(
  settings: Settings,
  oauthStatus: OpenAIOAuthCacheStatus | null,
  requestStartRevision: number
): Settings {
  if (!oauthStatus || oauthStatus.revision === requestStartRevision) return settings;
  return {
    ...settings,
    openai_oauth_connected: oauthStatus.connected,
    openai_oauth_account_id: oauthStatus.accountId,
  };
}
