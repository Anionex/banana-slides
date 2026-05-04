import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImagePlus, Loader2, Save, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Textarea } from './Textarea';
import { PRESET_STYLES } from '@/config/presetStyles';
import { presetStylesI18n } from '@/config/presetStylesI18n';
import {
  extractStyleFromImage,
  listUserStyleTemplates,
  createUserStyleTemplate,
  deleteUserStyleTemplate,
  type UserStyleTemplate,
} from '@/api/endpoints';

const STYLE_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
];

const i18n = {
  zh: {
    presetStyles: presetStylesI18n.zh,
    stylePlaceholder: '描述您想要的 PPT 风格，例如：简约商务风格，使用蓝色和白色配色，字体清晰大方...',
    presetStylesLabel: '预设风格：',
    myStylesLabel: '我的风格：',
    styleTip: '提示：点击预设风格快速填充，或自定义描述风格、配色、布局等要求',
    extractFromImage: '从图片提取风格',
    extracting: '提取中...',
    extractSuccess: '风格提取成功',
    extractFailed: '风格提取失败',
    saveAsTemplate: '保存为模板',
    saveStyle: '保存',
    cancel: '取消',
    styleName: '风格名称',
    styleNamePlaceholder: '输入风格名称...',
    saveSuccess: '风格模板已保存',
    saveFailed: '保存失败',
    deleteSuccess: '风格模板已删除',
    deleteFailed: '删除失败',
    noContent: '请先输入风格描述',
  },
  en: {
    presetStyles: presetStylesI18n.en,
    stylePlaceholder: 'Describe your desired PPT style, e.g., minimalist business style...',
    presetStylesLabel: 'Preset styles:',
    myStylesLabel: 'My styles:',
    styleTip: 'Tip: Click preset styles to quick fill, or customize',
    extractFromImage: 'Extract from image',
    extracting: 'Extracting...',
    extractSuccess: 'Style extracted successfully',
    extractFailed: 'Style extraction failed',
    saveAsTemplate: 'Save as template',
    saveStyle: 'Save',
    cancel: 'Cancel',
    styleName: 'Style name',
    styleNamePlaceholder: 'Enter style name...',
    saveSuccess: 'Style template saved',
    saveFailed: 'Save failed',
    deleteSuccess: 'Style template deleted',
    deleteFailed: 'Delete failed',
    noContent: 'Please enter a style description first',
  },
};

interface TextStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onToast?: (msg: { message: string; type: 'success' | 'error' }) => void;
}

export const TextStyleSelector: React.FC<TextStyleSelectorProps> = ({ value, onChange, onToast }) => {
  const t = useT(i18n);
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);
  const styleImageInputRef = useRef<HTMLInputElement>(null);

  const [userStyles, setUserStyles] = useState<UserStyleTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveColor, setSaveColor] = useState(STYLE_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredUserStyleId, setHoveredUserStyleId] = useState<string | null>(null);

  const loadUserStyles = useCallback(async () => {
    try {
      const res = await listUserStyleTemplates();
      if (res.data?.templates) setUserStyles(res.data.templates);
    } catch { /* ignore load failure */ }
  }, []);

  useEffect(() => { loadUserStyles(); }, [loadUserStyles]);

  const handleSave = async () => {
    if (!value.trim()) {
      onToast?.({ message: t('noContent'), type: 'error' });
      return;
    }
    if (!saveName.trim()) return;
    setIsSaving(true);
    try {
      await createUserStyleTemplate({ name: saveName.trim(), description: value.trim(), color: saveColor });
      onToast?.({ message: t('saveSuccess'), type: 'success' });
      setShowSaveDialog(false);
      setSaveName('');
      setSaveColor(STYLE_COLORS[0]);
      loadUserStyles();
    } catch {
      onToast?.({ message: t('saveFailed'), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserStyleTemplate(id);
      onToast?.({ message: t('deleteSuccess'), type: 'success' });
      setUserStyles((prev) => prev.filter((s) => s.id !== id));
    } catch {
      onToast?.({ message: t('deleteFailed'), type: 'error' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          placeholder={t('stylePlaceholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="text-sm border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white dark:placeholder-foreground-tertiary focus:border-banana-400 dark:focus:border-banana transition-colors duration-200 pr-24"
        />
        <button
          type="button"
          onClick={() => {
            if (!value.trim()) {
              onToast?.({ message: t('noContent'), type: 'error' });
              return;
            }
            setSaveColor(STYLE_COLORS[Math.floor(Math.random() * STYLE_COLORS.length)]);
            setShowSaveDialog(true);
          }}
          className="absolute right-2 top-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-foreground-tertiary hover:text-banana-600 dark:hover:text-banana rounded-md hover:bg-banana-50 dark:hover:bg-background-hover transition-colors"
        >
          <Save size={12} />
          {t('saveAsTemplate')}
        </button>
      </div>

      {showSaveDialog && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-tertiary rounded-lg border border-gray-200 dark:border-border-primary">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={t('styleNamePlaceholder')}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-border-primary rounded-md bg-white dark:bg-background-secondary dark:text-white focus:outline-none focus:border-banana-400 dark:focus:border-banana"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
          />
          <div className="flex gap-1">
            {STYLE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSaveColor(c)}
                className={`w-5 h-5 rounded-full ring-1 ring-black/10 transition-transform ${saveColor === c ? 'scale-125 ring-2 ring-banana-400 dark:ring-banana' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !saveName.trim()}
            className="px-3 py-1 text-xs font-medium text-white bg-banana-500 hover:bg-banana-600 rounded-md disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : t('saveStyle')}
          </button>
          <button
            type="button"
            onClick={() => { setShowSaveDialog(false); setSaveName(''); }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-foreground-secondary"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {userStyles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-foreground-tertiary">
            {t('myStylesLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            {userStyles.map((style) => (
              <div key={style.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onChange(style.description)}
                  onMouseEnter={() => setHoveredUserStyleId(style.id)}
                  onMouseLeave={() => setHoveredUserStyleId(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border-2 border-banana-200 dark:border-banana/30 text-banana-700 dark:text-banana bg-banana-50 dark:bg-banana/10 hover:border-banana-400 dark:hover:border-banana hover:bg-banana-100 dark:hover:bg-banana/20 transition-all duration-200"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                    style={{ backgroundColor: style.color || '#3B82F6' }}
                  />
                  {style.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(style.id); }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X size={10} />
                </button>
                {hoveredUserStyleId === style.id && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="bg-white dark:bg-background-secondary rounded-lg shadow-xl dark:shadow-none border border-gray-200 dark:border-border-primary p-2.5 w-64 max-w-xs">
                      <p className="text-xs text-gray-600 dark:text-foreground-tertiary line-clamp-4">
                        {style.description}
                      </p>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="w-3 h-3 bg-white dark:bg-background-secondary border-r border-b border-gray-200 dark:border-border-primary transform rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600 dark:text-foreground-tertiary">
          {t('presetStylesLabel')}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_STYLES.map((preset) => (
            <div key={preset.id} className="relative">
              <button
                type="button"
                onClick={() => onChange(t(preset.descriptionKey))}
                onMouseEnter={() => setHoveredPresetId(preset.id)}
                onMouseLeave={() => setHoveredPresetId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border-2 border-gray-200 dark:border-border-primary dark:text-foreground-secondary hover:border-banana-400 dark:hover:border-banana hover:bg-banana-50 dark:hover:bg-background-hover transition-all duration-200 hover:shadow-sm dark:hover:shadow-none"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: preset.color }}
                />
                {t(preset.nameKey)}
              </button>
              {hoveredPresetId === preset.id && preset.previewImage && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="bg-white dark:bg-background-secondary rounded-lg shadow-2xl dark:shadow-none border-2 border-banana-400 dark:border-banana p-2.5 w-72">
                    <img
                      src={preset.previewImage}
                      alt={t(preset.nameKey)}
                      className="w-full h-40 object-cover rounded"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <p className="text-xs text-gray-600 dark:text-foreground-tertiary mt-2 px-1 line-clamp-3">
                      {t(preset.descriptionKey)}
                    </p>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-3 h-3 bg-white dark:bg-background-secondary border-r-2 border-b-2 border-banana-400 dark:border-banana transform rotate-45" />
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => styleImageInputRef.current?.click()}
            disabled={isExtractingStyle}
            className="px-3 py-1.5 text-xs font-medium rounded-full border-2 border-dashed border-gray-300 dark:border-border-primary dark:text-foreground-secondary hover:border-banana-400 dark:hover:border-banana hover:bg-banana-50 dark:hover:bg-background-hover transition-all duration-200 hover:shadow-sm dark:hover:shadow-none flex items-center gap-1"
          >
            {isExtractingStyle ? (
              <><Loader2 size={12} className="animate-spin" />{t('extracting')}</>
            ) : (
              <><ImagePlus size={12} />{t('extractFromImage')}</>
            )}
          </button>
          <input
            ref={styleImageInputRef}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = '';
              setIsExtractingStyle(true);
              try {
                const result = await extractStyleFromImage(file);
                if (result.data?.style_description) {
                  onChange(result.data.style_description);
                  onToast?.({ message: t('extractSuccess'), type: 'success' });
                }
              } catch (error: any) {
                onToast?.({ message: `${t('extractFailed')}: ${error?.message || ''}`, type: 'error' });
              } finally {
                setIsExtractingStyle(false);
              }
            }}
            className="hidden"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-foreground-tertiary">
        💡 {t('styleTip')}
      </p>
    </div>
  );
};
