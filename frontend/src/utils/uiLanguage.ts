export const UI_LANGUAGE_OPTIONS = [
  { code: 'zh', label: '中文', shortLabel: '中' },
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'vi', label: 'Tiếng Việt', shortLabel: 'VI' },
] as const;

export type UiLanguage = (typeof UI_LANGUAGE_OPTIONS)[number]['code'];

export function resolveUiLanguage(language?: string): UiLanguage {
  if (language?.startsWith('zh')) return 'zh';
  if (language?.startsWith('vi')) return 'vi';
  return 'en';
}

export function nextUiLanguage(language?: string): UiLanguage {
  const current = resolveUiLanguage(language);
  if (current === 'zh') return 'en';
  if (current === 'en') return 'vi';
  return 'zh';
}

export function uiLanguageShortLabel(language: UiLanguage): string {
  return UI_LANGUAGE_OPTIONS.find((option) => option.code === language)?.shortLabel ?? 'EN';
}

export function intlLocaleForUiLanguage(language?: string): string {
  const current = resolveUiLanguage(language);
  if (current === 'zh') return 'zh-CN';
  if (current === 'vi') return 'vi-VN';
  return 'en-US';
}
