import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useT } from '@/hooks/useT';

// ─── i18n ────────────────────────────────────────────────────────────────────
const presetI18n = {
  zh: {
    preset: {
      addCustom: '自定义',
      namePlaceholder: '预设名称',
      contentPlaceholder: '提示词内容',
      add: '添加',
      cancel: '取消',
      system: '系统',
      user: '自定义',
    },
  },
  en: {
    preset: {
      addCustom: 'Custom',
      namePlaceholder: 'Preset name',
      contentPlaceholder: 'Prompt content',
      add: 'Add',
      cancel: 'Cancel',
      system: 'System',
      user: 'Custom',
    },
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Preset {
  name: string;
  content: string;
}

export type PresetType = 'outline' | 'description';

// ─── System presets ──────────────────────────────────────────────────────────
const SYSTEM_PRESETS: Record<PresetType, Record<'zh' | 'en', Preset[]>> = {
  outline: {
    zh: [
      { name: '控制页数', content: '限制在10页以内' },
      { name: '简洁要点', content: '每页要点不超过3条，文字简洁' },
      { name: '加封面结尾', content: '第一页为封面，最后一页为总结/致谢页' },
    ],
    en: [
      { name: 'Page limit', content: 'Limit to 10 pages or fewer' },
      { name: 'Concise points', content: 'No more than 3 bullet points per page, keep text concise' },
      { name: 'Cover & ending', content: 'First page as cover, last page as summary/thank you' },
    ],
  },
  description: {
    zh: [
      { name: '精简文字', content: '每页文字控制在50字以内，突出关键信息' },
      { name: '数据驱动', content: '多使用数据、百分比和具体案例支撑观点' },
      { name: '演讲风格', content: '语言口语化，适合现场演讲，避免长句' },
    ],
    en: [
      { name: 'Concise text', content: 'Keep text under 50 words per page, highlight key info' },
      { name: 'Data-driven', content: 'Use data, percentages and concrete examples to support points' },
      { name: 'Speech style', content: 'Use conversational language, suitable for live presentation, avoid long sentences' },
    ],
  },
};

const STORAGE_KEY_PREFIX = 'presetCapsules_';

function loadUserPresets(type: PresetType): Preset[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(type: PresetType, presets: Preset[]) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${type}`, JSON.stringify(presets));
}

// ─── Component ───────────────────────────────────────────────────────────────
interface PresetCapsulesProps {
  type: PresetType;
  onAppend: (text: string) => void;
}

export default function PresetCapsules({ type, onAppend }: PresetCapsulesProps) {
  const t = useT(presetI18n);
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets(type));
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  const systemPresets = SYSTEM_PRESETS[type][currentLang];

  useEffect(() => {
    if (isAdding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isAdding]);

  const handleAddPreset = useCallback(() => {
    const trimmedName = newName.trim();
    const trimmedContent = newContent.trim();
    if (!trimmedName || !trimmedContent) return;

    const updated = [...userPresets, { name: trimmedName, content: trimmedContent }];
    setUserPresets(updated);
    saveUserPresets(type, updated);
    setNewName('');
    setNewContent('');
    setIsAdding(false);
  }, [newName, newContent, userPresets, type]);

  const handleDeletePreset = useCallback((index: number) => {
    const updated = userPresets.filter((_, i) => i !== index);
    setUserPresets(updated);
    saveUserPresets(type, updated);
  }, [userPresets, type]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPreset();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewName('');
      setNewContent('');
    }
  }, [handleAddPreset]);

  const capsuleBase = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors whitespace-nowrap';
  const systemCapsule = `${capsuleBase} bg-gray-100 dark:bg-background-primary text-gray-600 dark:text-foreground-secondary hover:bg-banana-50 dark:hover:bg-banana-900/20 hover:text-banana-700 dark:hover:text-banana-400 border border-gray-200 dark:border-border-primary`;
  const userCapsule = `${capsuleBase} bg-banana-50 dark:bg-banana-900/20 text-banana-700 dark:text-banana-400 hover:bg-banana-100 dark:hover:bg-banana-900/30 border border-banana-200 dark:border-banana-700/40`;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2" data-testid={`${type}-presets`}>
      {/* System presets */}
      {systemPresets.map((preset, i) => (
        <button
          key={`sys-${i}`}
          type="button"
          data-testid={`${type}-system-preset-${i}`}
          className={systemCapsule}
          title={preset.content}
          onClick={() => onAppend(preset.content)}
        >
          {preset.name}
        </button>
      ))}

      {/* User presets */}
      {userPresets.map((preset, i) => (
        <span
          key={`usr-${i}`}
          className={userCapsule}
          title={preset.content}
          data-testid={`${type}-user-preset-${i}`}
        >
          <button
            type="button"
            className="hover:underline"
            onClick={() => onAppend(preset.content)}
          >
            {preset.name}
          </button>
          <button
            type="button"
            data-testid={`${type}-delete-preset-${i}`}
            className="ml-0.5 p-0.5 rounded-full hover:bg-banana-200 dark:hover:bg-banana-800/40 transition-colors"
            onClick={(e) => { e.stopPropagation(); handleDeletePreset(i); }}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {/* Add button / inline form */}
      {isAdding ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            ref={nameInputRef}
            data-testid={`${type}-preset-name-input`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('preset.namePlaceholder')}
            className="w-20 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-border-primary bg-white dark:bg-background-primary text-gray-700 dark:text-foreground-secondary placeholder-gray-400 dark:placeholder-foreground-tertiary/50 focus:outline-none focus:border-banana-300 dark:focus:border-banana-500/40"
          />
          <input
            data-testid={`${type}-preset-content-input`}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('preset.contentPlaceholder')}
            className="w-36 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-border-primary bg-white dark:bg-background-primary text-gray-700 dark:text-foreground-secondary placeholder-gray-400 dark:placeholder-foreground-tertiary/50 focus:outline-none focus:border-banana-300 dark:focus:border-banana-500/40"
          />
          <button
            type="button"
            data-testid={`${type}-preset-confirm`}
            onClick={handleAddPreset}
            disabled={!newName.trim() || !newContent.trim()}
            className="px-2 py-1 text-xs rounded-md bg-banana-500 text-white hover:bg-banana-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('preset.add')}
          </button>
          <button
            type="button"
            data-testid={`${type}-preset-cancel`}
            onClick={() => { setIsAdding(false); setNewName(''); setNewContent(''); }}
            className="px-2 py-1 text-xs rounded-md text-gray-500 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
          >
            {t('preset.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid={`${type}-add-preset`}
          onClick={() => setIsAdding(true)}
          className={`${capsuleBase} bg-white dark:bg-background-primary text-gray-400 dark:text-foreground-tertiary hover:text-banana-600 dark:hover:text-banana-400 hover:border-banana-300 dark:hover:border-banana-600/40 border border-dashed border-gray-300 dark:border-border-primary`}
        >
          <Plus size={10} />
          {t('preset.addCustom')}
        </button>
      )}
    </div>
  );
}
