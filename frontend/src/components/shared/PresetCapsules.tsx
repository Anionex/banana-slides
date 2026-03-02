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
// Set 1: Zen 极简演示 (Jobs-style) — both outline & description
// Set 2: SlideDocs 忠于原文 — both outline & description
// Set 3: 智能排版 — description only
const SYSTEM_PRESETS: Record<PresetType, Record<'zh' | 'en', Preset[]>> = {
  outline: {
    zh: [
      { name: '极简演示', content: '采用极简风格：每页只传达一个核心观点，要点精简至1-2条关键词级别，总页数不超过10页，删除一切非必要的过渡页，让每一页都有冲击力' },
      { name: '忠于原文', content: '采用 SlideDocs 风格：完整覆盖原文所有核心要点，不删减不概括，每页允许5-8条详细要点，使用 part 章节分组组织内容，确保信息零丢失' },
    ],
    en: [
      { name: 'Zen Minimal', content: 'Use minimalist style: one core message per page, points reduced to 1-2 keyword-level items, no more than 10 pages total, remove all non-essential transition pages, make every page impactful' },
      { name: 'SlideDocs', content: 'Use SlideDocs style: comprehensively cover all key points from source material, no deletion or over-summarization, allow 5-8 detailed points per page, organize with part sections, ensure zero information loss' },
    ],
  },
  description: {
    zh: [
      { name: '极简演示', content: '采用 Zen 极简风格：每页只输出一个最有冲击力的关键句或核心数字，文字不超过15个字，不要使用 bullet points 列表，用最少的文字传达最强的信息，留白即表达' },
      { name: '忠于原文', content: '采用 SlideDocs 阅读型风格：忠实还原原文内容，保留所有数据、案例和论证逻辑，每条要点展开为完整的一句话，信息完整性优先于简洁性，适合分发阅读' },
      { name: '智能排版', content: '根据本页内容特点选择最佳排版方式，在「其他页面素材」中输出排版建议：含数据对比→表格或图表、有流程步骤→步骤图示、有对比→左右分栏、纯观点→大字居中配图' },
    ],
    en: [
      { name: 'Zen Minimal', content: 'Use Zen minimalist style: output only one impactful key sentence or number per page, no more than 10 words of text, do not use bullet point lists, convey the strongest message with minimum text, whitespace is expression' },
      { name: 'SlideDocs', content: 'Use SlideDocs reading style: faithfully reproduce source content, retain all data, examples and reasoning, expand each point into a complete sentence, prioritize information completeness over brevity, suitable for distribution and reading' },
      { name: 'Smart Layout', content: 'Choose optimal layout based on page content and output layout suggestion in the materials section: data comparison → table or chart, process/steps → step diagram, comparison → two-column layout, pure concept → centered large text with illustration' },
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

  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewName('');
    setNewContent('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPreset();
    } else if (e.key === 'Escape') {
      handleCancelAdd();
    }
  }, [handleAddPreset, handleCancelAdd]);

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
            aria-label="Delete preset"
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
            onClick={handleCancelAdd}
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
