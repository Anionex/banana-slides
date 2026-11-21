export interface StoredPreset {
  name: string;
  content: string;
}

type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>;

function normalizePresets(value: unknown): StoredPreset[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];

    const { name, content } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof content !== 'string') return [];

    const normalizedName = name.trim();
    const normalizedContent = content.trim();
    if (!normalizedName || !normalizedContent) return [];

    return [{ name: normalizedName, content: normalizedContent }];
  });
}

export function loadStoredPresets(storage: PresetStorage | null | undefined, key: string): StoredPreset[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (raw === null) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }

    const presets = normalizePresets(parsed);
    const repaired = JSON.stringify(presets);
    if (raw !== repaired) {
      try {
        storage.setItem(key, repaired);
      } catch {
        // The validated presets are still usable for this session.
      }
    }
    return presets;
  } catch {
    return [];
  }
}
