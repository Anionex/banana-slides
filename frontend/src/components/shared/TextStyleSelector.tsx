import React, { useState, useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Textarea } from './Textarea';
import { PRESET_STYLES } from '@/config/presetStyles';
import { presetStylesI18n } from '@/config/presetStylesI18n';
import { extractStyleFromImage } from '@/api/endpoints';

const i18n = {
  zh: {
    presetStyles: presetStylesI18n.zh,
    stylePlaceholder: '描述您想要的 PPT 风格，例如：简约商务风格，使用蓝色和白色配色，字体清晰大方...',
    presetStylesLabel: '快速选择预设风格：',
    styleTip: '提示：点击预设风格快速填充，或自定义描述风格、配色、布局等要求',
    extractFromImage: '从图片提取风格',
    extracting: '提取中...',
    extractSuccess: '风格提取成功',
    extractFailed: '风格提取失败',
  },
  en: {
    presetStyles: presetStylesI18n.en,
    stylePlaceholder: 'Describe your desired PPT style, e.g., minimalist business style...',
    presetStylesLabel: 'Quick select preset styles:',
    styleTip: 'Tip: Click preset styles to quick fill, or customize',
    extractFromImage: 'Extract from image',
    extracting: 'Extracting...',
    extractSuccess: 'Style extracted successfully',
    extractFailed: 'Style extraction failed',
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

  return (
    <div className="space-y-3">
      <Textarea
        placeholder={t('stylePlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="text-sm border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white dark:placeholder-foreground-tertiary focus:border-banana-400 dark:focus:border-banana transition-colors duration-200"
      />

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
                    <div className="w-3 h-3 bg-white dark:bg-background-secondary border-r-2 border-b-2 border-banana-400 dark:border-banana transform rotate-45"></div>
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
