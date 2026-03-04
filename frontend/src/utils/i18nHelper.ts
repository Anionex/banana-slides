import i18n from '@/i18n';

type NestedRecord = Record<string, unknown>;
type Translations = { zh: NestedRecord; en: NestedRecord };

function getNestedValue(obj: NestedRecord, path: string): string | undefined {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as NestedRecord)[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Non-React translation helper for stores/utils.
 * Same pattern as useT but without React hooks.
 */
export function getT<T extends Translations>(translations: T) {
  return (key: string, params?: Record<string, string | number>): string => {
    const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
    const dict = translations[lang] || translations['zh'];
    const localValue = getNestedValue(dict, key);

    if (localValue !== undefined) {
      let text = localValue;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        });
      }
      return text;
    }

    // Fallback to global i18n
    return i18n.t(key, params as any);
  };
}
