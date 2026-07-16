export const AVAILABLE_EXTRA_FIELDS_KEY = 'banana-available-extra-fields';

export const DEFAULT_AVAILABLE_EXTRA_FIELDS = [
  '视觉元素',
  '视觉焦点',
  '排版布局',
  '演讲者备注',
] as const;

const MAX_AVAILABLE_EXTRA_FIELDS = 10;

type ExtraFieldStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getBrowserStorage(): ExtraFieldStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeAvailableExtraFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_AVAILABLE_EXTRA_FIELDS];

  const uniqueFields: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const field = entry.trim();
    if (field && !uniqueFields.includes(field)) uniqueFields.push(field);
  }

  for (const field of DEFAULT_AVAILABLE_EXTRA_FIELDS) {
    if (!uniqueFields.includes(field)) uniqueFields.push(field);
  }

  const defaultFields = new Set<string>(DEFAULT_AVAILABLE_EXTRA_FIELDS);
  const customFieldLimit = Math.max(
    0,
    MAX_AVAILABLE_EXTRA_FIELDS - DEFAULT_AVAILABLE_EXTRA_FIELDS.length,
  );
  const customFields = new Set(
    uniqueFields
      .filter((field) => !defaultFields.has(field))
      .slice(0, customFieldLimit),
  );

  return uniqueFields.filter(
    (field) => defaultFields.has(field) || customFields.has(field),
  );
}

export function loadAvailableExtraFields(
  storage: ExtraFieldStorage | null | undefined = getBrowserStorage(),
): string[] {
  if (!storage) return [...DEFAULT_AVAILABLE_EXTRA_FIELDS];

  try {
    const raw = storage.getItem(AVAILABLE_EXTRA_FIELDS_KEY);
    if (raw === null) return [...DEFAULT_AVAILABLE_EXTRA_FIELDS];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const fields = normalizeAvailableExtraFields(parsed);
    const repaired = JSON.stringify(fields);
    if (raw !== repaired) {
      try {
        storage.setItem(AVAILABLE_EXTRA_FIELDS_KEY, repaired);
      } catch {
        // Keep the recovered fields usable for this session.
      }
    }
    return fields;
  } catch {
    return [...DEFAULT_AVAILABLE_EXTRA_FIELDS];
  }
}

export function saveAvailableExtraFields(
  fields: string[],
  storage: ExtraFieldStorage | null | undefined = getBrowserStorage(),
): string[] {
  const normalized = normalizeAvailableExtraFields(fields);
  if (!storage) return normalized;

  try {
    const serialized = JSON.stringify(normalized);
    if (storage.getItem(AVAILABLE_EXTRA_FIELDS_KEY) !== serialized) {
      storage.setItem(AVAILABLE_EXTRA_FIELDS_KEY, serialized);
    }
  } catch {
    // The in-memory selection remains usable when browser storage is blocked.
  }
  return normalized;
}
