export interface AppVersionMetadata {
  tag?: string;
  shortSha?: string;
  fullSha?: string;
}

export interface AppVersionInfo {
  display: string;
  detail: string;
}

export function formatAppVersion(metadata: AppVersionMetadata): AppVersionInfo {
  const tag = metadata.tag?.trim();
  const fullSha = metadata.fullSha?.trim();
  const shortSha = metadata.shortSha?.trim() || fullSha?.slice(0, 7);
  const display = tag || shortSha || 'unknown';

  return {
    display,
    detail: fullSha && fullSha !== display ? `${display} (${fullSha})` : display,
  };
}

export const appVersion = formatAppVersion({
  tag: import.meta.env.VITE_APP_VERSION_TAG,
  shortSha: import.meta.env.VITE_APP_COMMIT_SHORT_SHA,
  fullSha: import.meta.env.VITE_APP_COMMIT_SHA,
});
